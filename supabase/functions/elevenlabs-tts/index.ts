import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Voice IDs are validated by shape, not whitelist. The admin can now pick any
// voice in the org's ElevenLabs account via elevenlabs-voices; locking this
// function to a hard-coded list would defeat that. Auth gate + rate limit
// are the real abuse defense.
const VOICE_ID_RE = /^[A-Za-z0-9_-]{16,32}$/;

const ALLOWED_MODELS = new Set([
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
]);

const DEFAULT_VOICE_ID = "QsV9PCczMIklRM6xLPAS";
const MAX_TEXT_LENGTH = 1500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth gate: require a signed-in user (or service-role for server calls) ---
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const isServerCall = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    let userId: string | null = null;
    if (!isServerCall) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = data.user.id;
    }

    // --- Body parse + input validation ---
    const body = await req.json().catch(() => ({}));
    const { text, voiceId, model } = body as { text?: string; voiceId?: string; model?: string };

    if (typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: `text exceeds ${MAX_TEXT_LENGTH} chars` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedVoiceId =
      typeof voiceId === "string" && VOICE_ID_RE.test(voiceId) ? voiceId : DEFAULT_VOICE_ID;
    const primaryModel = model && ALLOWED_MODELS.has(model) ? model : "eleven_flash_v2_5";

    // --- Rate limit per signed-in user (skipped for server calls) ---
    if (userId) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // 60 TTS requests per minute is generous (≈1/sec) but blocks runaway scripts.
      const rl = await checkRateLimit(supabaseAdmin, userId, "tts", 60, 60);
      if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);
    }

    console.log(`[TTS] user=${userId ?? "server"} voice=${selectedVoiceId} model=${primaryModel} chars=${text.length}`);

    const callElevenLabs = async (modelId: string) =>
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
        }
      );

    let response = await callElevenLabs(primaryModel);

    // Fallback to multilingual_v2 if flash fails (e.g. voice not supported on flash)
    if (!response.ok && primaryModel !== "eleven_multilingual_v2") {
      const errText = await response.text();
      console.warn(`[TTS] ${primaryModel} failed (${response.status}): ${errText}. Retrying with multilingual_v2`);
      response = await callElevenLabs("eleven_multilingual_v2");
    }

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => "");
      console.error("ElevenLabs TTS API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response body straight back to the client for lowest latency.
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in TTS function:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
