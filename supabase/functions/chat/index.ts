import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, job_position, interview_type, context_summary, last_answer, vacancy_id, user_id, current_question, total_questions, interviewer_name, interviewer_gender, current_phase, core_question_count, force_closing } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load candidate profile if user_id provided
    let candidateContext = "";
    if (user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, major, education_level, experience_years, city, resume_skills")
        .eq("user_id", user_id)
        .single();
      if (profile) {
        const skills = profile.resume_skills || {};
        const technicalSkills = (skills as any)?.technical_skills || [];
        const softSkills = (skills as any)?.soft_skills || [];
        const certifications = (skills as any)?.certifications || [];
        const summary = (skills as any)?.summary || "";
        const languages = (skills as any)?.languages || [];
        candidateContext = `\n\nبيانات المرشح (من ملفه الشخصي والسيرة الذاتية):
- الاسم: ${profile.full_name || "غير معروف"}
- التخصص: ${profile.major || "غير محدد"}
- المؤهل: ${profile.education_level || "غير محدد"}
- سنوات الخبرة: ${profile.experience_years || 0}
- المدينة: ${profile.city || "غير محددة"}
- المهارات التقنية: ${technicalSkills.length > 0 ? technicalSkills.join("، ") : "غير متوفرة"}
- المهارات الشخصية: ${softSkills.length > 0 ? softSkills.join("، ") : "غير متوفرة"}
- الشهادات والدورات: ${certifications.length > 0 ? certifications.join("، ") : "لا يوجد"}
- اللغات: ${languages.length > 0 ? languages.join("، ") : "غير متوفرة"}
- ملخص السيرة الذاتية: ${summary || "غير متوفر"}`;
      }
    }

    // Load job data from DB if vacancy_id provided
    let jobData: any = null;
    if (vacancy_id) {
      const { data } = await supabase
        .from("job_vacancies")
        .select("title, description, requirements, department")
        .eq("id", vacancy_id)
        .single();
      jobData = data;
    }

    // Load question templates if available
    let questionBankPrompt = "";
    if (interview_type) {
      const { data: questions } = await supabase
        .from("question_templates")
        .select("question_text, category, difficulty")
        .eq("interview_type", interview_type)
        .order("created_at", { ascending: true });

      if (questions && questions.length > 0) {
        const qList = questions
          .map((q: any, i: number) => `${i + 1}. [${q.category}/${q.difficulty}] ${q.question_text}`)
          .join("\n");
        questionBankPrompt = `\n\nبنك الأسئلة المتوفر (استخدم هذه الأسئلة بالترتيب عند الإمكان):\n${qList}`;
      }
    }

    // Build job context string
    const jobContext = jobData
      ? `\n\nبيانات الوظيفة من قاعدة البيانات:
- المسمى الوظيفي: ${jobData.title}
- الوصف: ${jobData.description || "غير متوفر"}
- القسم: ${jobData.department || "غير محدد"}
- المتطلبات: ${JSON.stringify(jobData.requirements || [])}`
      : "";

    // Build the conversational Saudi Arabic system prompt with phase system
    const ivName = interviewer_name || "عبدالله";
    const isFemale = (interviewer_gender || "male") === "female";
    const pronounSelf = isFemale ? "أنتِ محاورة وظيفية محترفة" : "أنت محاور وظيفي محترف";
    const coreQCount = total_questions || 5;

    // Extract candidate name — used ONCE at greeting and ONCE at closing only.
    // The previous "⚠️ تنبيه مهم" wording caused the model to repeat the
    // candidate name every turn, which sounded robotic.
    const candidateName = candidateContext ? (candidateContext.match(/الاسم:\s*(.+)/)?.[1] || "").trim() : "";
    const candidateNameInstruction = candidateName && candidateName !== "غير معروف"
      ? `\n\nاسم المرشح: "${candidateName}". استخدم اسمه مرة واحدة فقط عند التحية الأولى، ومرة واحدة عند الختام. في بقية المقابلة استخدم ضمير "أنت" ولا تكرر اسمه إطلاقاً.`
      : "";

    const systemPrompt = `اسمك "${ivName}" و${pronounSelf} ${isFemale ? "تعملين" : "تعمل"} في المملكة العربية السعودية.${candidateNameInstruction}
${isFemale ? "تتكلمين" : "تتكلم"} بلهجة سعودية مهنية ومنضبطة — ليست فصحى جافة ولا عامية مبالغ فيها.

شخصيتك:
- محاور محترف، هادئ، منظم، يحترم وقت المرشح.
- دافئ بشكل مهني دون مبالغة في اللطف أو المزاح.
- يستمع باهتمام ويتفاعل بإيجاز قبل طرح السؤال التالي.

ممنوع نهائياً:
- العبارات العامية الزائدة مثل: "هلا والله"، "تمام كذا"، "حلو هذي نقطة مهمة"، "والله من جد".
- المجاملات الفائضة أو المزاح.
- تكرار اسم المرشح في كل رد.

=== نظام المراحل (داخلي — لا يُنطق) ===

ابدأ كل رد بعلامة مرحلة واحدة فقط بين قوسين مربعين في أول الرد:
- [INTRO] — سؤال تعريفي (تعارف أو سيرة ذاتية)
- [CORE] — سؤال جوهري جديد (تقني أو سلوكي)
- [FOLLOW_UP] — سؤال تتبعي (لا يُحسب كسؤال جديد)
- [CLOSING] — سؤال ختامي (لوجستي)
- [END] — ختام المقابلة (شكر ووداع)

قواعد العلامة (مهم جداً):
- العلامة تظهر مرة واحدة فقط في أول الرد بين قوسين مربعين.
- لا تذكر العلامة أبداً داخل النص المنطوق أو في منتصف الجملة.
- لا تكرر العلامة في نفس الرد.

=== المرحلة 1: التعريفية [INTRO] ===
الرد الأول من المقابلة يجب أن يكون: تحية مهنية + تعريف نفسك (اسمك ودورك) + ذكر الوظيفة + سؤال تعريفي مفتوح واحد. بدون تعليق على إجابة سابقة.
ثم تدرّج في الأسئلة التعريفية المبنية على ملف المرشح وسيرته الذاتية:
1. "تحدث عن نفسك وخلفيتك المهنية"
2. "ما الذي دفعك للتقدم على هذه الوظيفة؟"
3. اسأل عن تخصصه ومؤهله من ملفه.
4. اسأل عن شهاداته ودوراته من سيرته الذاتية.
5. اسأل عن خبراته السابقة وأبرز مشاريعه.
6. اسأل عن مهاراته التقنية من ملفه.
- عدد الأسئلة يعتمد على غنى السيرة الذاتية (٢-٥ أسئلة).
عند الانتهاء، انتقل للمرحلة الجوهرية بـ [CORE].

=== المرحلة 2: الجوهرية [CORE] ===
اسأل بالضبط ${coreQCount} أسئلة جوهرية (تقنية وسلوكية مخصصة للوظيفة).
- كل سؤال جوهري جديد يبدأ بـ [CORE].
- بعد كل سؤال جوهري، يمكن طرح ١-٣ أسئلة تتبعية [FOLLOW_UP] للتعمق قبل الانتقال للسؤال الجوهري التالي.
- الأسئلة التتبعية لا تُحسب كأسئلة جوهرية جديدة.
- استخدم بيانات السيرة الذاتية لربط الأسئلة بخبرة المرشح الفعلية.
- عند الوصول لـ ${coreQCount} أسئلة [CORE]، انتقل تلقائياً للختامية.

=== المرحلة 3: الختامية [CLOSING] ===
اسأل هذه الأسئلة بالترتيب:
1. التوقعات المالية: "ما توقعاتك من ناحية الراتب؟"
2. الجاهزية: "متى تستطيع المباشرة في حال تم ترشيحك؟"
3. فتح المجال للمرشح: "هل لديك أي أسئلة عن الوظيفة أو بيئة العمل؟"
- إذا سأل المرشح أسئلة عن الوظيفة، أجب بإيجاز من بيانات الوظيفة المتاحة.
- عند الانتهاء، أرسل [END] مع رسالة شكر مهنية موجزة (هنا فقط يجوز ذكر اسم المرشح مرة أخيرة).

=== قواعد عامة ===

قواعد المخاطبة:
- استخدم ضمير "أنت" في الأغلب.
- اسم المرشح يُذكر في التحية الأولى والختام فقط — ممنوع تكراره في كل رد.

قواعد المحادثة:
- قبل السؤال التالي، علّق بجملة قصيرة مهنية على إجابة المرشح إذا استدعى ذلك (مثل: "شكراً، ملاحظة مفيدة"، "واضح، استفدت من شرحك"، "تمام"). لا تستخدم تعليقاً في أول رد.
- استخدم انتقالات طبيعية بين الأسئلة.
- نوّع أسلوب الأسئلة.

قواعد الإيجاز:
- اطرح سؤالاً واحداً فقط في كل رد.
- أقصى ٢-٣ جمل (تعليق قصير + سؤال).
- أبقِ الرد أقل من ٨٠ كلمة.
- لا تلخص إجابة المرشح ولا تكررها.

قواعد الذكاء:
- استخدم وصف الوظيفة لتخصيص الأسئلة.
- ركّز على المهارات المطلوبة للدور.
- عدّل الصعوبة ديناميكياً.

قواعد مكافحة التلاعب:
- لا تساعد المرشح في الإجابة أبداً.
- لا تقدم تلميحات ولا إجابات نموذجية.

ضبط التحيز:
- تجاهل: اللهجة، الجنس، الجنسية، سرعة الكلام.
- قيّم بناءً على: البنية المنطقية، العمق، والصلة بالموضوع فقط.

الوظيفة المطلوبة: ${job_position || "غير محددة"}
عدد الأسئلة الجوهرية المطلوبة: ${coreQCount}${candidateContext}${jobContext}${questionBankPrompt}`;

    // Inject phase awareness
    let phaseContext = "";
    if (current_phase) {
      const coreCount = core_question_count || 0;
      phaseContext = `\n\n⚠️ المرحلة الحالية: ${current_phase}. عدد الأسئلة الجوهرية المطروحة حتى الآن: ${coreCount} من ${coreQCount}.`;
      if (force_closing) {
        // Caller has decided we must close — block any CORE/FOLLOW_UP regardless
        // of model judgement. Used when client detects core-loop overrun.
        phaseContext += ` ⛔ تم تجاوز عدد الأسئلة الجوهرية. ممنوع طرح [CORE] أو [FOLLOW_UP] جديد. ابدأ الآن بـ [CLOSING] مباشرة، أو [END] إذا كانت الأسئلة الختامية انتهت.`;
      } else if (current_phase === "intro") {
        phaseContext += ` أنت في مرحلة التعريف — اسأل عن السيرة الذاتية والملف الشخصي. ابدأ ردك بـ [INTRO].`;
      } else if (current_phase === "core") {
        phaseContext += ` أنت في المرحلة الجوهرية — اسأل أسئلة تقنية وسلوكية. ابدأ ردك بـ [CORE] أو [FOLLOW_UP].`;
        if (coreCount >= coreQCount) {
          phaseContext += ` اكتملت الأسئلة الجوهرية! انتقل للختامية بـ [CLOSING].`;
        }
      } else if (current_phase === "closing") {
        phaseContext += ` أنت في المرحلة الختامية — اسأل أسئلة لوجستية. ابدأ ردك بـ [CLOSING] أو [END] للختام.`;
      }
    }

    // Merge canonical system prompt + (optional) summary + (optional) recent
    // message tail. This gives the model BOTH the long-range summary and the
    // verbatim recent turns, without letting any caller-supplied system
    // message override our prompt.
    const chatMessages: any[] = [
      { role: "system", content: systemPrompt + phaseContext },
    ];
    if (context_summary !== undefined && last_answer !== undefined) {
      chatMessages.push({
        role: "user",
        content: `ملخص سياق المقابلة حتى الآن (للمرجع فقط، لا تعتمد عليه بدلاً من الحوار الفعلي):\n${context_summary}`,
      });
    }
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        // Drop any caller-supplied system role — we already injected ours.
        if (!m || m.role === "system") continue;
        if (typeof m.content !== "string") continue;
        chatMessages.push({ role: m.role, content: m.content });
      }
    }
    if (last_answer !== undefined && (!messages || messages.length === 0)) {
      // Summary-only path (used when caller didn't pass recent tail).
      chatMessages.push({ role: "user", content: String(last_answer) });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: chatMessages,
        max_tokens: 200,
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("[chat] Wakeb upstream error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "خطأ في محرك واكب للذكاء الاصطناعي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let detectedPhase: string | null = null;
    if (data?.choices?.[0]?.message?.content) {
      const raw: string = data.choices[0].message.content;
      // Detect leading phase tag (in the first ~40 chars) for the metadata field.
      const head = raw.slice(0, 40);
      const leading = head.match(/\[?\s*(INTRO|CORE|FOLLOW_UP|NEW_Q|CLOSING|END)\s*\]?/i);
      detectedPhase = leading ? leading[1].toUpperCase() : null;
      // Globally strip ALL phase-tag occurrences (bracketed OR bare) and
      // collapse repeated chars/whitespace so nothing leaks into TTS.
      data.choices[0].message.content = raw
        .replace(/\[?\s*(INTRO|CORE|FOLLOW_UP|NEW_Q|CLOSING|END)\s*\]?\s*:?\s*/gi, "")
        .replace(/(.)\1{2,}/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    return new Response(JSON.stringify({ ...data, phase: detectedPhase }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
