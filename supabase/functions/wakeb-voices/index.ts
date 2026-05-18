import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/guards.ts";

// Admin-only endpoint that proxies the Wakeb AI Engine voice catalogue so the
// AdminSettings dropdown can show a live, curated list of voices instead of
// a hardcoded one. Upstream provider credentials are never returned to the
// client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UpstreamVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  category?: string;
  preview_url?: string;
}

interface CuratedVoice {
  voice_id: string;
  name: string;
  language: string | null;
  gender: string | null;
  accent: string | null;
  category: string | null;
  preview_url: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    // --- Admin gate ---
    const authHeader = req.headers.get("Authorization") ?? "";
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
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Defensive rate limit — even an admin shouldn't be able to spam the
    // upstream API.
    const rl = await checkRateLimit(supabaseAdmin, callerId, "wakeb_voices", 30, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[wakeb-voices] upstream error:", resp.status, text);
      return new Response(JSON.stringify({ error: "Failed to fetch voice catalogue" }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const voices: UpstreamVoice[] = Array.isArray(data?.voices) ? data.voices : [];

    const curated: CuratedVoice[] = voices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.labels?.["language"] ?? v.labels?.["accent"] ?? null,
      gender: v.labels?.["gender"] ?? null,
      accent: v.labels?.["accent"] ?? null,
      category: v.category ?? null,
      preview_url: v.preview_url ?? null,
    }));

    return new Response(JSON.stringify({ voices: curated }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[wakeb-voices] handler error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
