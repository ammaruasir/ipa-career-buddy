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
    type: "textarea",
    label_ar: "بيانات التواصل: البريد، الجوّال، المدينة، LinkedIn (سطر لكل واحد)",
    label_en: "Contact: email, phone, city, LinkedIn (one per line)",
    hint_ar: "العنوان التفصيلي غير ضروري، المدينة كافية.",
    hint_en: "Detailed address not needed, city is enough.",
  },
  {
    id: "experience_history",
    step: 6,
    field: "experience",
    required: true,
    type: "textarea",
    label_ar: "اكتب وظائفك السابقة (الأحدث أوّلاً). لكل وظيفة: المسمّى، الجهة، التواريخ، وملخّص ما فعلت.",
    label_en: "List your work history (most recent first). For each: title, employer, dates, what you did.",
    hint_ar: "لا تقلق بشأن الصياغة — AI سيحوّلها لـ STAR bullets قويّة لاحقاً.",
    hint_en: "Don't worry about phrasing — AI will polish to STAR bullets later.",
  },
  {
    id: "key_achievements",
    step: 7,
    field: "key_achievements",
    required: true,
    type: "textarea",
    label_ar: "أكبر ٣-٥ إنجازات في مسيرتك المهنية (بالأرقام إن أمكن).",
    label_en: "Your top 3-5 career achievements (with numbers if possible).",
    hint_ar: "مثال: 'خفّضت تكلفة عمليّة بـ ٢٥٪'، 'قُدت فريق ١٢ شخص'، 'حصلت على جائزة...'",
    hint_en: "Example: 'Cut process cost by 25%', 'Led 12-person team', 'Won award...'",
  },
  {
    id: "education",
    step: 8,
    field: "education",
    required: true,
    type: "textarea",
    label_ar: "مؤهّلاتك التعليمية (الأحدث أوّلاً): الدرجة، التخصّص، الجامعة، السنة.",
    label_en: "Your education (most recent first): degree, major, university, year.",
    hint_ar: "اذكر GPA فقط إذا ≥ ٤.٠/٥.٠ أو ٣.٥/٤.٠.",
    hint_en: "Only include GPA if ≥ 4.0/5.0 or 3.5/4.0.",
  },
  {
    id: "technical_skills",
    step: 9,
    field: "skills.technical",
    required: true,
    type: "textarea",
    label_ar: "مهاراتك التقنية / الأدوات (افصل بفاصلة).",
    label_en: "Your technical skills / tools (comma-separated).",
    hint_ar: "AI سيقترح المزيد بناءً على خبراتك.",
    hint_en: "AI will suggest additional skills based on your experience.",
  },
  {
    id: "languages",
    step: 10,
    field: "skills.languages",
    required: true,
    type: "textarea",
    label_ar: "اللغات التي تتقنها ومستواك في كل لغة.",
    label_en: "Languages and your proficiency in each.",
    hint_ar: "مثال: 'العربية (الأم)، الإنجليزية (طلاقة C1)'.",
    hint_en: "Example: 'Arabic (native), English (fluent C1)'.",
  },
  {
    id: "certifications",
    step: 11,
    field: "certifications",
    required: false,
    type: "textarea",
    label_ar: "شهادات مهنية أو دورات معتمدة (اختياري).",
    label_en: "Professional certifications or accredited courses (optional).",
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
  // Only suggest for free-text and textarea questions
  if (q.type === "choice" || q.type === "text") return null;

  try {
    const { apiKey, apiUrl, model } = pickProvider();
    const sysPrompt =
      language === "en"
        ? "You are a CV coach. Suggest a concise starter draft (3-5 lines) for the user's current question, based on their prior answers. Be specific to their context."
        : "أنت مدرّب سير ذاتية. اقترح مسوّدة موجزة (٣-٥ أسطر) للسؤال الحالي بناءً على إجاباته السابقة. كن محدّداً لسياقه.";

    const userPrompt =
      `Question: ${language === "en" ? q.label_en : q.label_ar}\n\n` +
      `Prior answers:\n${JSON.stringify(answersSoFar, null, 2).slice(0, 2000)}`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        stream: false,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn("Suggestion failed:", e);
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

  // Naive parsing — the user can refine in /cv/builder afterwards
  const personalInfo: Record<string, string> = {
    full_name: answers.full_name?.answer ?? "",
  };
  const contactLines = parseLines(answers.contact?.answer ?? "");
  for (const line of contactLines) {
    if (line.includes("@")) personalInfo.email = line;
    else if (/^\+?\d/.test(line)) personalInfo.phone = line;
    else if (line.toLowerCase().includes("linkedin")) personalInfo.linkedin = line;
    else if (!personalInfo.city) personalInfo.city = line;
  }

  const summaryText = answers.value_proposition?.answer ?? "";

  // Experience: each blank-line-separated chunk = one job
  const expChunks = (answers.experience_history?.answer ?? "")
    .split(/\n\s*\n/)
    .map((c: string) => c.trim())
    .filter(Boolean);
  const experience = expChunks.map((chunk: string) => {
    const lines = chunk.split("\n").map((l) => l.trim());
    return {
      position: lines[0] ?? "",
      company: lines[1] ?? "",
      start: lines[2] ?? "",
      end: "",
      bullets: lines.slice(3),
    };
  });

  const eduChunks = (answers.education?.answer ?? "")
    .split(/\n\s*\n/)
    .map((c: string) => c.trim())
    .filter(Boolean);
  const education = eduChunks.map((chunk: string) => {
    const lines = chunk.split("\n").map((l) => l.trim());
    return {
      degree: lines[0] ?? "",
      major: lines[1] ?? "",
      institution: lines[2] ?? "",
      start: "",
      end: lines[3] ?? "",
    };
  });

  const technical = parseLines((answers.technical_skills?.answer ?? "").replace(/،/g, ","))
    .flatMap((l) => l.split(",").map((s) => s.trim()))
    .filter(Boolean);
  const languages = parseLines(answers.languages?.answer ?? "");
  const certs = parseLines(answers.certifications?.answer ?? "").map((c) => ({ name: c }));

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

    // ----- action: finalize — generate cv_drafts row -----
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
