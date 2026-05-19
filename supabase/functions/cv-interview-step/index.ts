// P0.4-AI: cv-interview-step
// Stateful from-scratch CV wizard.
// - GET-style action: "get_next_question" returns next question + suggestions based on answers so far
// - POST-style action: "submit_answer" persists answer and returns next question
// - "finalize" generates the cv_drafts row from accumulated answers and links it back

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// Question bank — order matters. Bilingual labels.
// ============================================================
interface SubFieldDef {
  key: string;
  label_ar: string;
  label_en: string;
  type: "text" | "email" | "tel" | "url" | "date" | "textarea" | "choice";
  required?: boolean;
  placeholder_ar?: string;
  placeholder_en?: string;
  choices?: { value: string; label_ar: string; label_en: string }[];
  span?: 1 | 2; // grid columns
}

interface QuestionDef {
  id: string;
  step: number;
  field: string;
  required: boolean;
  type:
    | "text"
    | "textarea"
    | "list_text"
    | "structured_list"
    | "choice"
    | "form"
    | "repeater"
    | "repeater_simple"
    | "chips";
  choices?: { value: string; label_ar: string; label_en: string }[];
  fields?: SubFieldDef[]; // for form & repeater
  item_label_ar?: string; // for repeaters
  item_label_en?: string;
  label_ar: string;
  label_en: string;
  hint_ar: string;
  hint_en: string;
}

const QUESTIONS: QuestionDef[] = [
  {
    id: "experience_level",
    step: 1,
    field: "experience_level",
    required: true,
    type: "choice",
    choices: [
      { value: "fresh_graduate", label_ar: "خرّيج حديث", label_en: "Fresh graduate" },
      { value: "mid_career", label_ar: "متوسّط الخبرة (٢-٧ سنوات)", label_en: "Mid-career (2-7 yrs)" },
      { value: "senior", label_ar: "خبرة عالية (٧-١٥ سنة)", label_en: "Senior (7-15 yrs)" },
      { value: "executive", label_ar: "قيادي / تنفيذي (١٥+ سنة)", label_en: "Executive (15+ yrs)" },
    ],
    label_ar: "ما مستوى خبرتك المهنية؟",
    label_en: "What is your professional experience level?",
    hint_ar: "هذا يساعدنا في ضبط أسلوب السيرة (خرّيج جديد ≠ مدير تنفيذي).",
    hint_en: "This shapes the CV tone (fresh grad ≠ executive).",
  },
  {
    id: "target_role",
    step: 2,
    field: "target_role",
    required: true,
    type: "text",
    label_ar: "ما الوظيفة المستهدفة؟",
    label_en: "What role are you targeting?",
    hint_ar: "كن محدّداً: 'محلّل بيانات في القطاع الحكومي' أفضل من 'وظيفة في التقنية'.",
    hint_en: "Be specific: 'Data analyst in government' beats 'a tech job'.",
  },
  {
    id: "target_industry",
    step: 3,
    field: "target_industry",
    required: false,
    type: "text",
    label_ar: "أي قطاع تستهدف؟ (اختياري)",
    label_en: "Which industry? (optional)",
    hint_ar: "حكومي، خاص، شبه حكومي، startup، إلخ.",
    hint_en: "Government, private, semi-government, startup, etc.",
  },
  {
    id: "full_name",
    step: 4,
    field: "personal_info.full_name",
    required: true,
    type: "text",
    label_ar: "الاسم الكامل (كما يظهر في الهوية)",
    label_en: "Full name (as on your ID)",
    hint_ar: "استخدم الاسم الذي تقدّم به للجهات الرسمية.",
    hint_en: "Use the name you use for official submissions.",
  },
  {
    id: "contact",
    step: 5,
    field: "personal_info.contact",
    required: true,
    type: "form",
    fields: [
      { key: "email", label_ar: "البريد الإلكتروني", label_en: "Email", type: "email", required: true, placeholder_ar: "name@example.com", placeholder_en: "name@example.com" },
      { key: "phone", label_ar: "رقم الجوّال", label_en: "Phone", type: "tel", required: true, placeholder_ar: "+9665XXXXXXXX", placeholder_en: "+9665XXXXXXXX" },
      { key: "city", label_ar: "المدينة", label_en: "City", type: "text", required: true, placeholder_ar: "الرياض", placeholder_en: "Riyadh" },
      { key: "linkedin", label_ar: "رابط LinkedIn (اختياري)", label_en: "LinkedIn URL (optional)", type: "url", placeholder_ar: "https://linkedin.com/in/...", placeholder_en: "https://linkedin.com/in/..." },
    ],
    label_ar: "بيانات التواصل",
    label_en: "Contact information",
    hint_ar: "العنوان التفصيلي غير ضروري — المدينة كافية.",
    hint_en: "Detailed address not needed — city is enough.",
  },
  {
    id: "experience_history",
    step: 6,
    field: "experience",
    required: true,
    type: "repeater",
    item_label_ar: "وظيفة",
    item_label_en: "Job",
    fields: [
      { key: "title", label_ar: "المسمّى الوظيفي", label_en: "Job title", type: "text", required: true, span: 2 },
      { key: "company", label_ar: "الجهة / الشركة", label_en: "Company", type: "text", required: true, span: 2 },
      { key: "from", label_ar: "من (شهر/سنة)", label_en: "From (Mon/Year)", type: "text", placeholder_ar: "01/2022", placeholder_en: "01/2022" },
      { key: "to", label_ar: "إلى (أو 'حالياً')", label_en: "To (or 'Present')", type: "text", placeholder_ar: "حالياً", placeholder_en: "Present" },
      { key: "summary", label_ar: "ملخّص ما فعلت", label_en: "Summary of what you did", type: "textarea", span: 2 },
    ],
    label_ar: "خبراتك الوظيفية (الأحدث أوّلاً)",
    label_en: "Work experience (most recent first)",
    hint_ar: "لا تقلق بشأن الصياغة — واكب AI سيحوّلها لـ STAR bullets قويّة لاحقاً.",
    hint_en: "Don't worry about phrasing — Wakeb AI will polish to STAR bullets later.",
  },
  {
    id: "key_achievements",
    step: 7,
    field: "key_achievements",
    required: true,
    type: "repeater_simple",
    item_label_ar: "إنجاز",
    item_label_en: "Achievement",
    label_ar: "أكبر ٣-٥ إنجازات في مسيرتك المهنية",
    label_en: "Your top 3-5 career achievements",
    hint_ar: "مثال: 'خفّضت تكلفة عمليّة بـ ٢٥٪'، 'قُدت فريق ١٢ شخص'.",
    hint_en: "Example: 'Cut process cost by 25%', 'Led 12-person team'.",
  },
  {
    id: "education",
    step: 8,
    field: "education",
    required: true,
    type: "repeater",
    item_label_ar: "مؤهّل",
    item_label_en: "Degree",
    fields: [
      { key: "degree", label_ar: "الدرجة", label_en: "Degree", type: "text", required: true, placeholder_ar: "بكالوريوس", placeholder_en: "Bachelor's" },
      { key: "major", label_ar: "التخصّص", label_en: "Major", type: "text", required: true, placeholder_ar: "علوم حاسب", placeholder_en: "Computer Science" },
      { key: "university", label_ar: "الجامعة", label_en: "University", type: "text", required: true, span: 2 },
      { key: "year", label_ar: "سنة التخرّج", label_en: "Graduation year", type: "text", placeholder_ar: "2024", placeholder_en: "2024" },
      { key: "gpa", label_ar: "المعدّل (اختياري — فقط إذا ممتاز)", label_en: "GPA (optional — only if excellent)", type: "text", placeholder_ar: "4.5/5.0", placeholder_en: "4.5/5.0" },
    ],
    label_ar: "مؤهّلاتك التعليمية (الأحدث أوّلاً)",
    label_en: "Your education (most recent first)",
    hint_ar: "اذكر GPA فقط إذا ≥ ٤.٠/٥.٠ أو ٣.٥/٤.٠.",
    hint_en: "Only include GPA if ≥ 4.0/5.0 or 3.5/4.0.",
  },
  {
    id: "technical_skills",
    step: 9,
    field: "skills.technical",
    required: true,
    type: "chips",
    label_ar: "مهاراتك التقنية / الأدوات",
    label_en: "Your technical skills / tools",
    hint_ar: "اكتب المهارة واضغط Enter لإضافتها. مثال: Excel، SQL، Power BI.",
    hint_en: "Type a skill and press Enter to add. e.g., Excel, SQL, Power BI.",
  },
  {
    id: "languages",
    step: 10,
    field: "skills.languages",
    required: true,
    type: "repeater",
    item_label_ar: "لغة",
    item_label_en: "Language",
    fields: [
      { key: "name", label_ar: "اللغة", label_en: "Language", type: "text", required: true, placeholder_ar: "الإنجليزية", placeholder_en: "English" },
      {
        key: "level",
        label_ar: "المستوى",
        label_en: "Proficiency",
        type: "choice",
        required: true,
        choices: [
          { value: "native", label_ar: "اللغة الأم", label_en: "Native" },
          { value: "fluent", label_ar: "طلاقة (C1-C2)", label_en: "Fluent (C1-C2)" },
          { value: "advanced", label_ar: "متقدّم (B2)", label_en: "Advanced (B2)" },
          { value: "intermediate", label_ar: "متوسّط (B1)", label_en: "Intermediate (B1)" },
          { value: "beginner", label_ar: "مبتدئ (A1-A2)", label_en: "Beginner (A1-A2)" },
        ],
      },
    ],
    label_ar: "اللغات ومستواك في كل لغة",
    label_en: "Languages and your proficiency",
    hint_ar: "أضف كل لغة بشكل منفصل.",
    hint_en: "Add each language separately.",
  },
  {
    id: "certifications",
    step: 11,
    field: "certifications",
    required: false,
    type: "repeater",
    item_label_ar: "شهادة",
    item_label_en: "Certification",
    fields: [
      { key: "name", label_ar: "اسم الشهادة", label_en: "Certificate name", type: "text", required: true, span: 2 },
      { key: "issuer", label_ar: "الجهة المانحة", label_en: "Issuing body", type: "text", required: true },
      { key: "year", label_ar: "السنة", label_en: "Year", type: "text", placeholder_ar: "2024", placeholder_en: "2024" },
      { key: "link", label_ar: "رابط التحقّق (اختياري)", label_en: "Verification link (optional)", type: "url", span: 2 },
    ],
    label_ar: "الشهادات المهنية (اختياري)",
    label_en: "Professional certifications (optional)",
    hint_ar: "تجاهل دورات Udemy العامّة — فقط الشهادات المعتمدة من جهات معروفة.",
    hint_en: "Skip generic Udemy courses — only accredited certifications.",
  },
  {
    id: "value_proposition",
    step: 12,
    field: "value_proposition",
    required: true,
    type: "textarea",
    label_ar: "في جملتين: لماذا أنت الخيار الأفضل لهذه الوظيفة؟",
    label_en: "In two sentences: why are you the best fit for this role?",
    hint_ar: "هذه ستصبح أساس الـ Summary. كن صادقاً ومدعَّماً بدليل.",
    hint_en: "This becomes the basis for the Summary. Be honest and evidence-backed.",
  },
  {
    id: "military_service",
    step: 13,
    field: "military_service",
    required: false,
    type: "choice",
    choices: [
      { value: "completed", label_ar: "مُؤدّاة", label_en: "Completed" },
      { value: "exempted", label_ar: "مُعفى", label_en: "Exempted" },
      { value: "not_applicable", label_ar: "غير منطبقة", label_en: "Not applicable" },
      { value: "skip", label_ar: "تخطّي", label_en: "Skip" },
    ],
    label_ar: "خدمة العلم (للذكور السعوديين ٢١-٣٠)",
    label_en: "Military service (Saudi males 21-30)",
    hint_ar: "مفيد للجهات الحكومية.",
    hint_en: "Useful for government roles.",
  },
  {
    id: "jadarat",
    step: 14,
    field: "jadarat_link",
    required: false,
    type: "text",
    label_ar: "رابط ملفّك في جدارات (اختياري)",
    label_en: "Your Jadarat profile link (optional)",
    hint_ar: "يضيف مصداقية إضافية للجهات الحكومية.",
    hint_en: "Adds credibility for government roles.",
  },
  {
    id: "language_preference",
    step: 15,
    field: "language",
    required: true,
    type: "choice",
    choices: [
      { value: "ar", label_ar: "عربية فقط", label_en: "Arabic only" },
      { value: "en", label_ar: "إنجليزية فقط", label_en: "English only" },
      { value: "bilingual", label_ar: "ثنائية اللغة", label_en: "Bilingual" },
    ],
    label_ar: "بأي لغة تريد سيرتك الذاتية؟",
    label_en: "In which language(s) do you want your CV?",
    hint_ar: "ثنائية اللغة = ملفّان منفصلان (عربي + إنجليزي).",
    hint_en: "Bilingual = two separate PDFs (Arabic + English).",
  },
];

function pickProvider() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (LOVABLE_API_KEY) {
    return {
      apiKey: LOVABLE_API_KEY,
      apiUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "google/gemini-2.5-flash",
    };
  }
  if (OPENAI_API_KEY) {
    return {
      apiKey: OPENAI_API_KEY,
      apiUrl: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4.1-mini",
    };
  }
  throw new Error("No AI provider configured");
}

// Ask AI for a contextual suggestion for the current question, given prior answers
async function suggestForQuestion(
  q: QuestionDef,
  answersSoFar: Record<string, any>,
  language: string,
) {
  // No suggestions for pure choice questions — answer is a selection
  if (q.type === "choice") return null;

  try {
    const { apiKey, apiUrl, model } = pickProvider();

    // Per-type guidance so the AI returns something the user can paste verbatim
    let formatHint_ar = "اكتب مسوّدة موجزة (٣-٥ أسطر) جاهزة للنسخ.";
    let formatHint_en = "Write a concise draft (3-5 lines) ready to paste.";
    if (q.type === "repeater_simple") {
      formatHint_ar = "اكتب ٣ إنجازات قويّة، كل واحد في سطر منفصل، بأرقام واضحة وأفعال قويّة (بنمط STAR مختصر).";
      formatHint_en = "Write 3 strong achievements, one per line, with numbers and strong verbs (compact STAR style).";
    } else if (q.type === "repeater") {
      formatHint_ar = "اكتب مثال بند واحد فقط (وظيفة/مؤهّل/شهادة/لغة) بصياغة احترافية على شكل أسطر مفصولة.";
      formatHint_en = "Write a single sample item (job/degree/cert/language) in professional form, line-separated.";
    } else if (q.type === "chips") {
      formatHint_ar = "اقترح ٦-١٠ مهارات تقنية ملائمة للوظيفة المستهدفة، مفصولة بفواصل.";
      formatHint_en = "Suggest 6-10 technical skills relevant to the target role, comma-separated.";
    } else if (q.type === "form") {
      formatHint_ar = "اكتب مثالاً نموذجياً لكل حقل من حقول النموذج، كل حقل في سطر بصيغة 'المفتاح: القيمة'.";
      formatHint_en = "Write a sample value for each field, one per line as 'key: value'.";
    } else if (q.type === "text") {
      formatHint_ar = "اقترح إجابة محدّدة قصيرة (سطر واحد) ملائمة لسياق المستخدم.";
      formatHint_en = "Suggest a short, specific one-line answer fitting the user's context.";
    }

    const sysPrompt =
      language === "en"
        ? `You are a professional CV coach for Saudi Arabia's IPA. Output ONLY the suggestion text the user can paste, no preface, no markdown, no quotes. ${formatHint_en}`
        : `أنت مدرّب سير ذاتية محترف لمعهد الإدارة العامة. أعِد فقط نصّ الاقتراح القابل للنسخ، بدون مقدّمة ولا تنسيق markdown ولا علامات تنصيص. ${formatHint_ar}`;

    const contextSummary = {
      experience_level: answersSoFar?.experience_level?.answer,
      target_role: answersSoFar?.target_role?.answer,
      target_industry: answersSoFar?.target_industry?.answer,
    };

    const userPrompt =
      `Question: ${language === "en" ? q.label_en : q.label_ar}\n` +
      `Hint: ${language === "en" ? q.hint_en : q.hint_ar}\n` +
      `User context: ${JSON.stringify(contextSummary)}\n` +
      `All prior answers (truncated):\n${JSON.stringify(answersSoFar, null, 2).slice(0, 1500)}`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        stream: false,
      }),
    });

    if (!resp.ok) {
      console.warn("Suggestion HTTP", resp.status, await resp.text().catch(() => ""));
      return null;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch (e) {
    console.warn("Suggestion failed:", e);
    return null;
  }
}

// Try to parse a structured (JSON) answer; returns null if it's plain text
function tryParseStructured(raw: any): any | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Convert accumulated answers into a cv_drafts row
function buildDraftFromAnswers(answers: Record<string, any>) {
  const parseLines = (s: string) =>
    (s || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  // ---- personal info ----
  const personalInfo: Record<string, string> = {
    full_name: answers.full_name?.answer ?? "",
  };
  const contactStructured = tryParseStructured(answers.contact?.answer);
  if (contactStructured && typeof contactStructured === "object") {
    if (contactStructured.email) personalInfo.email = contactStructured.email;
    if (contactStructured.phone) personalInfo.phone = contactStructured.phone;
    if (contactStructured.city) personalInfo.city = contactStructured.city;
    if (contactStructured.linkedin) personalInfo.linkedin = contactStructured.linkedin;
  } else {
    // Legacy: line-separated free text
    const contactLines = parseLines(answers.contact?.answer ?? "");
    for (const line of contactLines) {
      if (line.includes("@")) personalInfo.email = line;
      else if (/^\+?\d/.test(line)) personalInfo.phone = line;
      else if (line.toLowerCase().includes("linkedin")) personalInfo.linkedin = line;
      else if (!personalInfo.city) personalInfo.city = line;
    }
  }

  const summaryText = answers.value_proposition?.answer ?? "";

  // ---- experience ----
  let experience: any[] = [];
  const expStructured = tryParseStructured(answers.experience_history?.answer);
  if (Array.isArray(expStructured)) {
    experience = expStructured.map((item: any) => ({
      position: item.title ?? "",
      company: item.company ?? "",
      start: item.from ?? "",
      end: item.to ?? "",
      bullets: (item.summary ?? "")
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean),
    }));
  } else {
    const expChunks = (answers.experience_history?.answer ?? "")
      .split(/\n\s*\n/)
      .map((c: string) => c.trim())
      .filter(Boolean);
    experience = expChunks.map((chunk: string) => {
      const lines = chunk.split("\n").map((l) => l.trim());
      return {
        position: lines[0] ?? "",
        company: lines[1] ?? "",
        start: lines[2] ?? "",
        end: "",
        bullets: lines.slice(3),
      };
    });
  }

  // ---- key achievements: attach as bullets on first job, or as standalone list ----
  const achievementsStructured = tryParseStructured(answers.key_achievements?.answer);
  const achievementsList: string[] = Array.isArray(achievementsStructured)
    ? achievementsStructured.map((a: any) => (typeof a === "string" ? a : a?.text ?? "")).filter(Boolean)
    : parseLines(answers.key_achievements?.answer ?? "");
  if (achievementsList.length && experience[0]) {
    experience[0].bullets = [...(experience[0].bullets ?? []), ...achievementsList];
  }

  // ---- education ----
  let education: any[] = [];
  const eduStructured = tryParseStructured(answers.education?.answer);
  if (Array.isArray(eduStructured)) {
    education = eduStructured.map((item: any) => ({
      degree: item.degree ?? "",
      major: item.major ?? "",
      institution: item.university ?? "",
      start: "",
      end: item.year ?? "",
      gpa: item.gpa ?? "",
    }));
  } else {
    const eduChunks = (answers.education?.answer ?? "")
      .split(/\n\s*\n/)
      .map((c: string) => c.trim())
      .filter(Boolean);
    education = eduChunks.map((chunk: string) => {
      const lines = chunk.split("\n").map((l) => l.trim());
      return {
        degree: lines[0] ?? "",
        major: lines[1] ?? "",
        institution: lines[2] ?? "",
        start: "",
        end: lines[3] ?? "",
      };
    });
  }

  // ---- technical skills ----
  let technical: string[] = [];
  const techStructured = tryParseStructured(answers.technical_skills?.answer);
  if (Array.isArray(techStructured)) {
    technical = techStructured.map((s: any) => String(s).trim()).filter(Boolean);
  } else {
    technical = parseLines((answers.technical_skills?.answer ?? "").replace(/،/g, ","))
      .flatMap((l) => l.split(",").map((s) => s.trim()))
      .filter(Boolean);
  }

  // ---- languages ----
  let languages: string[] = [];
  const langStructured = tryParseStructured(answers.languages?.answer);
  if (Array.isArray(langStructured)) {
    const levelLabels: Record<string, string> = {
      native: "Native",
      fluent: "Fluent",
      advanced: "Advanced",
      intermediate: "Intermediate",
      beginner: "Beginner",
    };
    languages = langStructured
      .map((l: any) => {
        const name = l?.name ?? "";
        const level = levelLabels[l?.level] ?? l?.level ?? "";
        return name ? (level ? `${name} (${level})` : name) : "";
      })
      .filter(Boolean);
  } else {
    languages = parseLines(answers.languages?.answer ?? "");
  }

  // ---- certifications ----
  let certs: any[] = [];
  const certStructured = tryParseStructured(answers.certifications?.answer);
  if (Array.isArray(certStructured)) {
    certs = certStructured.map((c: any) => ({
      name: c?.name ?? "",
      issuer: c?.issuer ?? "",
      year: c?.year ?? "",
      link: c?.link ?? "",
    })).filter((c) => c.name);
  } else {
    certs = parseLines(answers.certifications?.answer ?? "").map((c) => ({ name: c }));
  }

  return {
    personal_info: personalInfo,
    summary: { ar: summaryText, en: "" },
    experience,
    education,
    skills: { technical, soft: [], languages },
    certifications: certs,
    template: "modern",
    language: answers.language_preference?.answer ?? "ar",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action: "start" | "submit" | "back" | "finalize" = body.action;
    const sessionId: string | undefined = body.session_id;
    const language: "ar" | "en" | "bilingual" = body.language ?? "ar";

    // ----- action: start -----
    if (action === "start") {
      const { data: created, error } = await supabase
        .from("cv_interview_sessions")
        .insert({
          user_id: user.id,
          status: "in_progress",
          current_step: 0,
          total_steps: QUESTIONS.length,
          language,
          answers: {},
        })
        .select()
        .single();

      if (error || !created) throw new Error(`Session create failed: ${error?.message}`);

      const firstQ = QUESTIONS[0];
      return new Response(
        JSON.stringify({
          session_id: created.id,
          current_step: 0,
          total_steps: QUESTIONS.length,
          question: firstQ,
          suggestion: null,
          done: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load session
    const { data: session, error: sessionErr } = await supabase
      .from("cv_interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (sessionErr || !session) throw new Error("Session not found");

    // ----- action: submit -----
    if (action === "submit") {
      const answer: string = body.answer ?? "";
      const stepIdx: number = session.current_step;
      const currentQ = QUESTIONS[stepIdx];

      if (!currentQ) throw new Error("Invalid step");
      if (currentQ.required && !answer.trim()) {
        return new Response(
          JSON.stringify({
            error: language === "en" ? "This question is required" : "هذا السؤال إلزامي",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const updatedAnswers = {
        ...((session.answers as any) ?? {}),
        [currentQ.id]: { answer, ts: new Date().toISOString() },
      };

      const nextStep = stepIdx + 1;
      const isDone = nextStep >= QUESTIONS.length;

      // Capture special fields up the session for convenience
      const sessionPatch: Record<string, any> = {
        current_step: nextStep,
        answers: updatedAnswers,
      };
      if (currentQ.id === "target_role") sessionPatch.target_role = answer;
      if (currentQ.id === "target_industry") sessionPatch.target_industry = answer;
      if (currentQ.id === "experience_level") sessionPatch.experience_level = answer;
      if (currentQ.id === "language_preference") sessionPatch.language = answer;

      await supabase
        .from("cv_interview_sessions")
        .update(sessionPatch)
        .eq("id", sessionId);

      if (isDone) {
        return new Response(
          JSON.stringify({
            session_id: sessionId,
            current_step: nextStep,
            total_steps: QUESTIONS.length,
            question: null,
            suggestion: null,
            done: true,
            ready_to_finalize: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const nextQ = QUESTIONS[nextStep];
      const suggestion = body.want_suggestion === true
        ? await suggestForQuestion(nextQ, updatedAnswers, sessionPatch.language ?? session.language)
        : null;

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          current_step: nextStep,
          total_steps: QUESTIONS.length,
          question: nextQ,
          suggestion,
          done: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- action: back — go to previous question -----
    if (action === "back") {
      const stepIdx: number = session.current_step;
      const prevStep = Math.max(0, stepIdx - 1);
      const prevQ = QUESTIONS[prevStep];
      if (!prevQ) throw new Error("No previous step");

      await supabase
        .from("cv_interview_sessions")
        .update({ current_step: prevStep })
        .eq("id", sessionId);

      const savedAnswers = (session.answers as any) ?? {};
      const previousAnswer = savedAnswers[prevQ.id]?.answer ?? "";

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          current_step: prevStep,
          total_steps: QUESTIONS.length,
          question: prevQ,
          previous_answer: previousAnswer,
          suggestion: null,
          done: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- action: suggest — AI hint for current question -----
    if (action === "suggest") {
      const stepIdx: number = session.current_step;
      const currentQ = QUESTIONS[stepIdx];
      if (!currentQ) throw new Error("Invalid step");

      const answers = (session.answers as any) ?? {};
      const lang = session.language ?? language;
      const suggestion = await suggestForQuestion(currentQ, answers, lang);

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          current_step: stepIdx,
          question: currentQ,
          suggestion,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    if (action === "finalize") {
      const draftRecord = buildDraftFromAnswers((session.answers as any) ?? {});

      const { data: createdDraft, error: draftErr } = await supabase
        .from("cv_drafts")
        .insert({
          user_id: user.id,
          ...draftRecord,
        })
        .select()
        .single();

      if (draftErr || !createdDraft) throw new Error(`Draft create failed: ${draftErr?.message}`);

      await supabase
        .from("cv_interview_sessions")
        .update({
          status: "completed",
          generated_draft_id: createdDraft.id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          draft_id: createdDraft.id,
          done: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cv-interview-step error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
