// Cohort management helpers — used by both admins and instructors.
// Actions:
//   - enroll_student_by_email   (instructor for own cohort, or admin)
//   - enroll_students           (admin only — bulk by UUID)
//   - promote_to_instructor     (admin only)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getCaller(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return null;
  const { data: hasAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  return { user, isAdmin: !!hasAdmin };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = await getCaller(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "enroll_student_by_email") {
      const { cohort_id, email } = body;
      if (!cohort_id || !email) throw new Error("cohort_id + email required");

      // Authorization: caller must be admin or the cohort instructor
      const { data: cohort } = await service.from("cohorts").select("instructor_id").eq("id", cohort_id).maybeSingle();
      if (!cohort) throw new Error("Cohort not found");
      if (!caller.isAdmin && cohort.instructor_id !== caller.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden — not your cohort" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find user by email via admin API
      const { data: usersList, error: lookupErr } = await service.auth.admin.listUsers({
        page: 1, perPage: 200,
      });
      if (lookupErr) throw lookupErr;
      const match = usersList.users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (!match) {
        return new Response(JSON.stringify({ error: "لا يوجد طالب بهذا البريد — اطلب منه التسجيل أولاً" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insErr } = await service
        .from("enrollments")
        .upsert(
          { cohort_id, student_id: match.id, status: "active" },
          { onConflict: "cohort_id,student_id" },
        );
      if (insErr) throw insErr;

      return new Response(
        JSON.stringify({ success: true, student_id: match.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "enroll_students") {
      if (!caller.isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { cohort_id, student_ids } = body;
      if (!cohort_id || !Array.isArray(student_ids)) throw new Error("cohort_id + student_ids required");
      const rows = student_ids.map((sid: string) => ({ cohort_id, student_id: sid, status: "active" }));
      const { error } = await service.from("enrollments").upsert(rows, { onConflict: "cohort_id,student_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, enrolled: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "promote_to_instructor") {
      if (!caller.isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id } = body;
      if (!user_id) throw new Error("user_id required");
      const { error } = await service
        .from("user_roles")
        .upsert({ user_id, role: "instructor" }, { onConflict: "user_id,role" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-cohort error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
