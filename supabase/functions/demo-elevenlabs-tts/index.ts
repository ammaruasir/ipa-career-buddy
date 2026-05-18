// Public, IP-rate-limited TTS for /demo (Lina + Sara voices).
// Mirrors elevenlabs-tts but drops the auth gate and locks voiceId to the
// known demo voices so this can't be used as a free TTS proxy.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceIpRateLimit } from "../_shared/demo-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Keep in sync with src/demo/voices.ts. Until Khaleeji clones land, all three
// resolve to the platform's default Arabic voice.
const ALLOWED_VOICE_IDS = new Set<string>([
  "QsV9PCczMIklRM6xLPAS",
]);

const MAX_TEXT_LENGTH = 1500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ~120 TTS calls / hr / IP. A full 39-step tour + Sara answers fits comfortably.
    const limited = await enforceIpRateLimit(req, "demo-elevenlabs-tts", 120, 3600, corsHeaders);
    if (limited) return limited;

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { text, voiceId } = body as { text?: string; voiceId?: string };

    if (typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: `text exceeds ${MAX_TEXT_LENGTH} chars` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedVoiceId =
      typeof voiceId === "string" && ALLOWED_VOICE_IDS.has(voiceId)
        ? voiceId
        : "QsV9PCczMIklRM6xLPAS";

    const callElevenLabs = (modelId: string) =>
      fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.8,
              style: 0.0,
              use_speaker_boost: false,
              speed: 1.05,
            },
          }),
        },
      );

    let response = await callElevenLabs("eleven_multilingual_v2");
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[demo-tts] multilingual_v2 failed (${response.status}): ${errText}. Retrying flash_v2_5`);
      response = await callElevenLabs("eleven_flash_v2_5");
    }

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => "");
      console.error("ElevenLabs error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("demo-elevenlabs-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
