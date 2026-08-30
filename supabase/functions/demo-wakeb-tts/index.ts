// Public, IP-rate-limited TTS for /demo (presenter + candidate voices).
// Mirrors wakeb-tts but drops the auth gate and locks voiceId to the
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
  "yXEnnEln9armDCyhkXcA",
  "gVzwmdZzRgBrNjXaTmi5",
  "usjDi9nBY6UHvtKrL4ba",
  "QsV9PCczMIklRM6xLPAS",
]);

const MAX_TEXT_LENGTH = 1500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ~120 TTS calls / hr / IP. A full 39-step tour + Sara answers fits comfortably.
    const limited = await enforceIpRateLimit(req, "demo-wakeb-tts", 120, 3600, corsHeaders);
    if (limited) return limited;

    const WAKEB_TTS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!WAKEB_TTS_API_KEY) {
      return new Response(JSON.stringify({ error: "Wakeb TTS API key not set" }), {
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
        : "yXEnnEln9armDCyhkXcA";

    // Premade voices are available on every plan (including free). Library
    // voices are not — so a 402 "paid_plan_required" falls back to these.
    const PREMADE_FALLBACK_VOICES = ["9BWtsMINqrJLrRacOk9x", "21m00Tcm4TlvDq8ikWAM"];

    const callUpstreamTts = (modelId: string, vId: string) =>
      fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vId}/stream?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": WAKEB_TTS_API_KEY,
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

    const attempts: Array<[string, string]> = [
      ["eleven_multilingual_v2", selectedVoiceId],
      ["eleven_flash_v2_5", selectedVoiceId],
      ...PREMADE_FALLBACK_VOICES.flatMap((v): Array<[string, string]> => [
        ["eleven_multilingual_v2", v],
        ["eleven_flash_v2_5", v],
      ]),
    ];

    let response: Response | null = null;
    for (const [modelId, vId] of attempts) {
      response = await callUpstreamTts(modelId, vId);
      if (response.ok && response.body) break;
      const errText = await response.text().catch(() => "");
      console.warn(`[demo-wakeb-tts] ${modelId}/${vId} failed (${response.status}): ${errText}`);
      response = null;
    }

    if (!response || !response.body) {
      console.error("[demo-wakeb-tts] all TTS attempts failed");
      return new Response(JSON.stringify({ error: "Wakeb TTS generation failed" }), {
        status: 502,
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
    console.error("demo-wakeb-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
