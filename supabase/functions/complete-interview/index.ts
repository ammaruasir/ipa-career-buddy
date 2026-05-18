import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interview_id, recording_url, recording_status, end_reason } = await req.json();
    if (!interview_id) {
      return new Response(JSON.stringify({ error: "interview_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // SECURITY: verify ownership. Allow either authenticated user OR service-role beacon (sendBeacon
    // on tab close cannot easily attach auth — we accept service-role as a fallback for that path).
    const authHeader = req.headers.get("Authorization") ?? "";
    const isServerCall = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load interview to verify it exists and capture owner
    const { data: iv, error: ivErr } = await adminClient
      .from("interviews")
      .select("id, user_id, status, recording_url")
      .eq("id", interview_id)
      .single();
    if (ivErr || !iv) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isServerCall) {
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await userClient.auth.getUser(token);
      if (!user || user.id !== (iv as any).user_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // SECURITY: validate recording_url is in the owner's storage path
    let safeRecordingUrl: string | undefined;
    if (recording_url && typeof recording_url === "string") {
      const ownerPrefix = `${(iv as any).user_id}/`;
      if (recording_url.startsWith(ownerPrefix) && !recording_url.includes("..")) {
        safeRecordingUrl = recording_url;
      } else {
        console.warn("Rejected suspicious recording_url:", recording_url.slice(0, 80));
      }
    }

    const updateData: Record<string, unknown> = { status: "completed" };
    if (safeRecordingUrl) {
      updateData.recording_url = safeRecordingUrl;
    }
    if (recording_status && ["pending", "recording", "complete", "incomplete", "failed"].includes(recording_status)) {
      updateData.recording_status = recording_status;
    }
    if (end_reason && ["completed", "cancelled", "terminated_by_proctor", "disconnected"].includes(end_reason)) {
      updateData.end_reason = end_reason;
    }

    // First attempt: only update from in_progress → completed atomically so
    // a late beacon doesn't reopen a finished interview.
    const { data: stillRunning, error: txnErr } = await adminClient
      .from("interviews")
      .update(updateData)
      .eq("id", interview_id)
      .eq("status", "in_progress")
      .select("id");
    let error = txnErr;

    // Second attempt: if the row was already completed (common: client
    // updated status synchronously inside endInterview() before the beacon
    // fired), still record end_reason / recording_status without touching
    // status. Without this fallback the "disconnected" flag is silently lost.
    if (!error && (!stillRunning || stillRunning.length === 0)) {
      const beaconOnly: Record<string, unknown> = {};
      if (recording_status && ["pending", "recording", "complete", "incomplete", "failed"].includes(recording_status)) {
        beaconOnly.recording_status = recording_status;
      }
      if (end_reason && ["completed", "cancelled", "terminated_by_proctor", "disconnected"].includes(end_reason)) {
        beaconOnly.end_reason = end_reason;
      }
      if (safeRecordingUrl) beaconOnly.recording_url = safeRecordingUrl;
      if (Object.keys(beaconOnly).length > 0) {
        const r = await adminClient
          .from("interviews")
          .update(beaconOnly)
          .eq("id", interview_id);
        error = r.error;
      }
    }

    if (error) {
      console.error("Failed to complete interview:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
