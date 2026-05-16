import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function deleteInterviewCascade(admin: any, ids: string[]) {
  if (ids.length === 0) return;
  await admin.from("cheat_events").delete().in("interview_id", ids);
  await admin.from("hr_notes").delete().in("interview_id", ids);
  await admin.from("responses").delete().in("interview_id", ids);
  await admin.from("evaluations").delete().in("interview_id", ids);
  // unlink applications referencing these interviews
  await admin.from("job_applications").update({ interview_id: null }).in("interview_id", ids);
  await admin.from("interviews").delete().in("id", ids);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const callerId = claimsData.claims.sub;
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json();
    const { action } = body;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "update") {
      const { id, updates } = body;
      if (!id || !updates) return json({ error: "Missing id or updates" }, 400);
      const allowed: Record<string, any> = {};
      for (const k of ["job_position", "type", "status"]) {
        if (k in updates) allowed[k] = updates[k];
      }
      const { error } = await admin.from("interviews").update(allowed).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      await deleteInterviewCascade(admin, [id]);
      return json({ success: true });
    }

    if (action === "bulk_delete") {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) return json({ error: "Missing ids" }, 400);
      await deleteInterviewCascade(admin, ids);
      return json({ success: true, deleted: ids.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
