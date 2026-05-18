import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import fixWebmDuration from "npm:fix-webm-duration@1.0.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Repairs a legacy single-file WebM recording by writing a proper Duration
 * element into its Segment header. Without this element, HTML5 video stops
 * playback at the first parsed cluster (typically ~60-120s) even though the
 * full file data is on disk. The repair re-uploads as
 * {user_id}/{interview_id}/repaired.webm and points interviews.recording_url
 * at the repaired file.
 *
 * For new chunked recordings the manifest+chunks pipeline avoids this issue
 * entirely; those rows already have recording_chunks_path set and don't need
 * to call this function.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const callerId = claimsData.claims.sub;
    const isServerKey = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    if (!isServerKey) {
      const { data: isAdmin } = await userClient.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);
    }

    const { interview_id } = await req.json();
    if (!interview_id) return json({ error: "interview_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: iv, error: ivErr } = await admin
      .from("interviews")
      .select("id, user_id, type, recording_url, recording_chunks_path, recording_status")
      .eq("id", interview_id)
      .single();
    if (ivErr || !iv) return json({ error: "Interview not found" }, 404);

    // Chunked recordings don't need repair.
    if ((iv as any).recording_chunks_path) {
      return json({ skipped: true, reason: "already chunked" });
    }

    const recordingUrl: string | null = (iv as any).recording_url;
    if (!recordingUrl) return json({ skipped: true, reason: "no recording_url" });

    // Normalize to storage path (strip any full URL prefix).
    let path = recordingUrl;
    const match = recordingUrl.match(/interview-recordings\/(.+)$/);
    if (match) path = match[1];
    if (path.startsWith("http")) {
      return json({ error: "Could not resolve storage path" }, 400);
    }

    // Download.
    const { data: blob, error: dlErr } = await admin.storage
      .from("interview-recordings")
      .download(path);
    if (dlErr || !blob) return json({ error: `Download failed: ${dlErr?.message ?? "unknown"}` }, 500);

    const sizeBytes = blob.size;
    if (sizeBytes === 0) return json({ error: "Empty recording" }, 400);

    // Estimate duration from file size. MediaRecorder defaults are ~1.5 Mbps
    // for video + audio, ~64 kbps for audio-only. Overshoot is safer than
    // undershoot — an over-estimated duration plays the full file then stops
    // at the real end of data; under-estimating truncates playback.
    const bytesPerSecond = (iv as any).type === "video" ? 200_000 : 12_000;
    const estimatedSeconds = Math.max(60, Math.ceil(sizeBytes / bytesPerSecond) + 10);
    const estimatedMs = estimatedSeconds * 1000;

    let repairedBlob: Blob;
    try {
      repairedBlob = await fixWebmDuration(blob, estimatedMs);
    } catch (e) {
      console.error("[Repair] fixWebmDuration threw:", e);
      return json({ error: "fixWebmDuration failed" }, 500);
    }

    const userId = (iv as any).user_id;
    const repairedPath = `${userId}/${interview_id}/repaired.webm`;
    const { error: upErr } = await admin.storage
      .from("interview-recordings")
      .upload(repairedPath, repairedBlob, {
        contentType: blob.type || "video/webm",
        upsert: true,
      });
    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

    const { error: updErr } = await admin
      .from("interviews")
      .update({
        recording_url: repairedPath,
        recording_status: "complete",
        recording_duration_ms: estimatedMs,
      } as any)
      .eq("id", interview_id);
    if (updErr) return json({ error: `DB update failed: ${updErr.message}` }, 500);

    return json({
      ok: true,
      repaired_path: repairedPath,
      original_size_bytes: sizeBytes,
      repaired_size_bytes: repairedBlob.size,
      estimated_duration_ms: estimatedMs,
    });
  } catch (err) {
    console.error("[repair-recording] error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
