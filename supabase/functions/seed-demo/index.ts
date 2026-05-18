// One-shot demo data seeder, ported from scripts/seed-demo-data.ts.
// Invoked once via supabase--curl_edge_functions to bootstrap demo accounts +
// content. Idempotent. Delete after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_USERS = {
  candidate: { email: "demo-candidate@ipa-training.sa", password: Deno.env.get("DEMO_CANDIDATE_PASSWORD") || "DemoCandidate#2026", fullName: "سارة الراشد" },
  admin: { email: "demo-admin@ipa-training.sa", password: Deno.env.get("DEMO_ADMIN_PASSWORD") || "DemoAdmin#2026", fullName: "محمد التركي" },
  hr: { email: "demo-hr@ipa-training.sa", password: Deno.env.get("DEMO_HR_PASSWORD") || "DemoHr#2026", fullName: "ريم العتيبي" },
  instructor: { email: "demo-instructor@ipa-training.sa", password: Deno.env.get("DEMO_INSTRUCTOR_PASSWORD") || "DemoInstructor#2026", fullName: "د. خالد العنزي" },
};
const SECONDARY = { email: "demo-candidate2@ipa-training.sa", password: "DemoCandidate2#2026", fullName: "خالد المطيري" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const log: string[] = [];
  const warn = (m: string) => { console.warn(m); log.push("WARN " + m); };
  const info = (m: string) => { console.log(m); log.push(m); };
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    async function upsertUser(email: string, password: string, fullName: string): Promise<string> {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find((u) => u.email === email);
      if (existing) {
        await admin.auth.admin.updateUserById(existing.id, {
          password, user_metadata: { full_name: fullName, is_demo: true }, email_confirm: true,
        });
        return existing.id;
      }
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName, is_demo: true },
      });
      if (error) throw error;
      return data.user!.id;
    }

    async function upsertProfile(userId: string, fields: Record<string, unknown>) {
      const { error } = await admin.from("profiles").upsert({ user_id: userId, is_demo: true, ...fields }, { onConflict: "user_id" });
      if (error) warn(`profile ${userId}: ${error.message}`);
    }

    async function assignRole(userId: string, role: "admin" | "hr" | "instructor") {
      const { error } = await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (error) warn(`assignRole(${role}) ${userId}: ${error.message}`);
    }

    info("creating demo users…");
    const candidateId = await upsertUser(DEMO_USERS.candidate.email, DEMO_USERS.candidate.password, DEMO_USERS.candidate.fullName);
    const adminId = await upsertUser(DEMO_USERS.admin.email, DEMO_USERS.admin.password, DEMO_USERS.admin.fullName);
    const hrId = await upsertUser(DEMO_USERS.hr.email, DEMO_USERS.hr.password, DEMO_USERS.hr.fullName);
    const instructorId = await upsertUser(DEMO_USERS.instructor.email, DEMO_USERS.instructor.password, DEMO_USERS.instructor.fullName);
    const khalidId = await upsertUser(SECONDARY.email, SECONDARY.password, SECONDARY.fullName);

    info("assigning roles…");
    await assignRole(adminId, "admin");
    await assignRole(hrId, "hr");
    await assignRole(instructorId, "instructor");

    info("writing demo profiles…");
    await upsertProfile(candidateId, {
      full_name: DEMO_USERS.candidate.fullName, major: "علوم حاسب", education_level: "بكالوريوس",
      experience_years: 3, city: "الرياض",
      resume_skills: {
        technical_skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Accessibility"],
        soft_skills: ["تواصل", "حل المشكلات", "عمل جماعي"],
        languages: ["العربية", "الإنجليزية"],
        summary: "مهندسة واجهات أمامية بثلاث سنوات خبرة في شركة فينتك. مهتمّة بالأداء والوصولية وبناء أنظمة تصميم قابلة للتطوير.",
      },
    });
    await upsertProfile(khalidId, {
      full_name: SECONDARY.fullName, major: "هندسة برمجيات", education_level: "بكالوريوس",
      experience_years: 5, city: "جدة",
      resume_skills: {
        technical_skills: ["Java", "Spring Boot", "PostgreSQL", "Kubernetes"],
        soft_skills: ["قيادة فرق", "تخطيط"], languages: ["العربية", "الإنجليزية"],
        summary: "مهندس برمجيات backend بخمس سنوات خبرة في الأنظمة الماليّة.",
      },
    });
    await upsertProfile(adminId, { full_name: DEMO_USERS.admin.fullName });
    await upsertProfile(hrId, { full_name: DEMO_USERS.hr.fullName });
    await upsertProfile(instructorId, { full_name: DEMO_USERS.instructor.fullName });

    info("writing demo job vacancy…");
    {
      const { error } = await admin.from("job_vacancies").upsert({
        id: "00000000-0000-0000-0000-00000000d000",
        title: "مهندسة واجهات أمامية — تجريبي",
        description: "وظيفة تجريبية مرتبطة بالعرض التفاعلي. تُعرض فقط للحسابات التجريبية.",
        department: "الهندسة الرقمية",
        requirements: ["React", "TypeScript", "Accessibility", "Design Systems"],
        is_demo: true, is_active: true, created_by: adminId,
      }, { onConflict: "id" });
      if (error) warn(`job_vacancies: ${error.message}`);
    }

    info("writing demo question bank…");
    const demoQuestions = [
      { category: "behavioral", difficulty: "medium", question_text: "احكي لي عن موقف عملت فيه ضمن فريق وكان فيه خلاف." },
      { category: "behavioral", difficulty: "medium", question_text: "ما أكبر تحدّي تقني واجهتيه السنة الماضية؟" },
      { category: "technical",  difficulty: "medium", question_text: "وضّحي الفرق بين SSR و CSR ومتى تستخدمين كل واحد." },
      { category: "technical",  difficulty: "hard",   question_text: "كيف تحسّنين Largest Contentful Paint في تطبيق React؟" },
      { category: "cultural",   difficulty: "easy",   question_text: "ليش تحبّين الانضمام للقطاع العام السعودي؟" },
    ];
    for (const q of demoQuestions) {
      // question_templates.id is uuid → generate deterministic uuid v5-ish via crypto digest
      const seed = `dq-${q.category}-${q.difficulty}-${q.question_text.length}`;
      const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(seed));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
      const { error } = await admin.from("question_templates").upsert({
        id, ...q, is_demo: true, interview_type: "voice", created_by: adminId,
      }, { onConflict: "id" });
      if (error) warn(`question ${seed}: ${error.message}`);
    }

    info("writing demo cohort…");
    const cohortId = "00000000-0000-0000-0000-00000000c000";
    {
      const { error } = await admin.from("cohorts").upsert({
        id: cohortId, name: "دفعة تجريبية — IPA Demo 2026", track: "frontend",
        capacity: 20, start_date: "2026-04-01", end_date: "2026-07-01",
        instructor_id: instructorId, is_demo: true, status: "active",
      }, { onConflict: "id" });
      if (error) warn(`cohort: ${error.message}`);
    }

    info("enrolling demo candidates…");
    for (const cid of [candidateId, khalidId]) {
      const { error } = await admin.from("enrollments").upsert(
        { cohort_id: cohortId, student_id: cid, status: "active", is_demo: true },
        { onConflict: "cohort_id,student_id" },
      );
      if (error) warn(`enrollment ${cid}: ${error.message}`);
    }

    info("done.");
    return new Response(JSON.stringify({
      ok: true, log,
      users: { candidateId, adminId, hrId, instructorId, khalidId },
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
