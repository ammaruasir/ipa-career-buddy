// Demo Mode auth helper. Issues a Supabase session for one of the 4 demo
// accounts so the tour can swap context mid-flow.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceIpRateLimit } from "../_shared/demo-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DemoRole = "candidate" | "admin" | "hr" | "instructor";

const DEMO_ACCOUNTS: Record<DemoRole, { email: string; password: string }> = {
  candidate: {
    email: "demo-candidate@ipa-training.sa",
    password: Deno.env.get("DEMO_CANDIDATE_PASSWORD") || "DemoCandidate#2026",
  },
  admin: {
    email: "demo-admin@ipa-training.sa",
    password: Deno.env.get("DEMO_ADMIN_PASSWORD") || "DemoAdmin#2026",
  },
  hr: {
    email: "demo-hr@ipa-training.sa",
    password: Deno.env.get("DEMO_HR_PASSWORD") || "DemoHr#2026",
  },
  instructor: {
    email: "demo-instructor@ipa-training.sa",
    password: Deno.env.get("DEMO_INSTRUCTOR_PASSWORD") || "DemoInstructor#2026",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const limited = await enforceIpRateLimit(req, "demo-session", 12, 3600, corsHeaders);
    if (limited) return limited;

    const { role } = (await req.json()) as { role: DemoRole };
    if (!role || !DEMO_ACCOUNTS[role]) {
      return new Response(JSON.stringify({ error: "invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { email, password } = DEMO_ACCOUNTS[role];
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      console.error("demo-session sign-in failed:", error?.message);
      return new Response(
        JSON.stringify({ error: "demo account unavailable", detail: error?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user_email: data.user?.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("demo-session error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
