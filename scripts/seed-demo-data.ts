/**
 * Demo Mode data seeder. Creates / refreshes the 4 demo accounts and the demo
 * content (Sara, Khalid, question bank, demo job, demo cohort) that the tour
 * relies on. All seeded rows carry is_demo=true.
 *
 * Idempotent: re-running updates existing demo content in place.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/seed-demo-data.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Role = "candidate" | "admin" | "hr" | "instructor";

const DEMO_USERS: Record<Role, { email: string; password: string; fullName: string }> = {
  candidate: { email: "demo-candidate@ipa-training.sa", password: process.env.DEMO_CANDIDATE_PASSWORD || "DemoCandidate#2026", fullName: "سارة الراشد" },
  admin: { email: "demo-admin@ipa-training.sa", password: process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin#2026", fullName: "محمد التركي" },
  hr: { email: "demo-hr@ipa-training.sa", password: process.env.DEMO_HR_PASSWORD || "DemoHr#2026", fullName: "ريم العتيبي" },
  instructor: { email: "demo-instructor@ipa-training.sa", password: process.env.DEMO_INSTRUCTOR_PASSWORD || "DemoInstructor#2026", fullName: "د. خالد العنزي" },
};

const SECONDARY_CANDIDATE = { email: "demo-candidate2@ipa-training.sa", password: "DemoCandidate2#2026", fullName: "خالد المطيري" };

async function upsertUser(email: string, password: string, fullName: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { full_name: fullName, is_demo: true },
      email_confirm: true,
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
  const payload = { user_id: userId, is_demo: true, ...fields };
  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

async function assignRole(userId: string, role: "admin" | "hr" | "instructor") {
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (error) console.warn(`assignRole(${role}) for ${userId} failed:`, error.message);
}

async function seed() {
  console.log("[seed] creating demo users…");
  const candidateId = await upsertUser(DEMO_USERS.candidate.email, DEMO_USERS.candidate.password, DEMO_USERS.candidate.fullName);
  const adminId = await upsertUser(DEMO_USERS.admin.email, DEMO_USERS.admin.password, DEMO_USERS.admin.fullName);
  const hrId = await upsertUser(DEMO_USERS.hr.email, DEMO_USERS.hr.password, DEMO_USERS.hr.fullName);
  const instructorId = await upsertUser(DEMO_USERS.instructor.email, DEMO_USERS.instructor.password, DEMO_USERS.instructor.fullName);
  const khalidId = await upsertUser(SECONDARY_CANDIDATE.email, SECONDARY_CANDIDATE.password, SECONDARY_CANDIDATE.fullName);

  console.log("[seed] assigning roles…");
  await assignRole(adminId, "admin");
  await assignRole(hrId, "hr");
  await assignRole(instructorId, "instructor");

  console.log("[seed] writing demo profiles…");
  await upsertProfile(candidateId, {
    full_name: DEMO_USERS.candidate.fullName,
    major: "علوم حاسب",
    education_level: "بكالوريوس",
    experience_years: 3,
    city: "الرياض",
    resume_skills: {
      technical_skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Accessibility"],
      soft_skills: ["تواصل", "حل المشكلات", "عمل جماعي"],
      languages: ["العربية", "الإنجليزية"],
      summary: "مهندسة واجهات أمامية بثلاث سنوات خبرة في شركة فينتك. مهتمّة بالأداء والوصولية وبناء أنظمة تصميم قابلة للتطوير.",
    },
  });

  await upsertProfile(khalidId, {
    full_name: SECONDARY_CANDIDATE.fullName,
    major: "هندسة برمجيات",
    education_level: "بكالوريوس",
    experience_years: 5,
    city: "جدة",
    resume_skills: {
      technical_skills: ["Java", "Spring Boot", "PostgreSQL", "Kubernetes"],
      soft_skills: ["قيادة فرق", "تخطيط"],
      languages: ["العربية", "الإنجليزية"],
      summary: "مهندس برمجيات backend بخمس سنوات خبرة في الأنظمة الماليّة.",
    },
  });

  await upsertProfile(adminId, { full_name: DEMO_USERS.admin.fullName });
  await upsertProfile(hrId, { full_name: DEMO_USERS.hr.fullName });
  await upsertProfile(instructorId, { full_name: DEMO_USERS.instructor.fullName });

  console.log("[seed] writing demo job vacancy…");
  await admin.from("job_vacancies").upsert({
    id: "00000000-0000-0000-0000-00000000d000",
    title: "مهندسة واجهات أمامية — تجريبي",
    description: "وظيفة تجريبية مرتبطة بالعرض التفاعلي. تُعرض فقط للحسابات التجريبية.",
    department: "الهندسة الرقمية",
    requirements: ["React", "TypeScript", "Accessibility", "Design Systems"],
    is_demo: true,
    status: "active",
  }, { onConflict: "id" });

  console.log("[seed] writing demo question bank…");
  const demoQuestions = [
    { category: "behavioral", difficulty: "medium", question_text: "احكي لي عن موقف عملت فيه ضمن فريق وكان فيه خلاف." },
    { category: "behavioral", difficulty: "medium", question_text: "ما أكبر تحدّي تقني واجهتيه السنة الماضية؟" },
    { category: "technical",  difficulty: "medium", question_text: "وضّحي الفرق بين SSR و CSR ومتى تستخدمين كل واحد." },
    { category: "technical",  difficulty: "hard",   question_text: "كيف تحسّنين Largest Contentful Paint في تطبيق React؟" },
    { category: "cultural",   difficulty: "easy",   question_text: "ليش تحبّين الانضمام للقطاع العام السعودي؟" },
  ];
  for (const q of demoQuestions) {
    const id = `dq-${q.category}-${q.difficulty}-${q.question_text.length}`;
    await admin.from("question_templates").upsert({ id, ...q, is_demo: true, interview_type: "voice" }, { onConflict: "id" });
  }

  console.log("[seed] writing demo cohort…");
  const cohortId = "00000000-0000-0000-0000-00000000c000";
  const { error: cohortErr } = await admin.from("cohorts").upsert({
    id: cohortId,
    name: "دفعة تجريبية — IPA Demo 2026",
    track: "frontend",
    capacity: 20,
    start_date: "2026-04-01",
    end_date: "2026-07-01",
    instructor_id: instructorId,
    is_demo: true,
  }, { onConflict: "id" });
  if (cohortErr) console.warn("[seed] cohort upsert warning:", cohortErr.message);

  console.log("[seed] enrolling demo candidates…");
  for (const cid of [candidateId, khalidId]) {
    const { error: enErr } = await admin.from("enrollments").upsert(
      { cohort_id: cohortId, user_id: cid, status: "active", is_demo: true },
      { onConflict: "cohort_id,user_id" },
    );
    if (enErr) console.warn("[seed] enrollment warning:", enErr.message);
  }

  console.log("[seed] done.");
  console.log("Demo credentials (also used by demo-session edge function):");
  Object.entries(DEMO_USERS).forEach(([role, u]) => {
    console.log(`  ${role.padEnd(11)} ${u.email}  password=${u.password}`);
  });
}

seed().catch((e) => {
  console.error("[seed] FAILED:", e);
  process.exit(1);
});
