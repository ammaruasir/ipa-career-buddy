import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, model } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default to first user-provided Arabic voice. Admin can override per request.
    const selectedVoiceId = voiceId || "QsV9PCczMIklRM6xLPAS";
    // Flash v2.5 → ~75ms first-byte, supports Arabic. Falls back to multilingual_v2 on error.
    const primaryModel = model || "eleven_flash_v2_5";

    console.log(`[TTS] voice=${selectedVoiceId} model=${primaryModel} chars=${text?.length ?? 0}`);

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
