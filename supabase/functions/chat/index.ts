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
    const { messages, job_position, interview_type, context_summary, last_answer, vacancy_id, user_id, current_question, total_questions, interviewer_name, interviewer_gender, current_phase, core_question_count } = await req.json();
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
    const ivName = interviewer_name || "نورة";
    const isFemale = (interviewer_gender || "female") === "female";
    const pronounSelf = isFemale ? "أنتِ محاورة وظيفية ودودة ومحترفة" : "أنت محاور وظيفي ودود ومحترف";
    const coreQCount = total_questions || 5;
    
    // Extract candidate name for prominent placement in prompt
    const candidateName = candidateContext ? (candidateContext.match(/الاسم:\s*(.+)/)?.[1] || "").trim() : "";
    const candidateNameInstruction = candidateName && candidateName !== "غير معروف"
      ? `\n\n⚠️ تنبيه مهم: اسم المرشح هو "${candidateName}". عند مخاطبته استخدم اسمه "${candidateName}" — ولا تستخدم اسمك "${ivName}" عند مناداته أبداً.`
      : "";
    
    const systemPrompt = `اسمك "${ivName}" و${pronounSelf} ${isFemale ? "تعملين" : "تعمل"} في المملكة العربية السعودية.${candidateNameInstruction}
${isFemale ? "تتكلمين" : "تتكلم"} بلهجة سعودية مهنية ودودة — مو فصحى جافة ولا عامية مبالغ فيها.

شخصيتك:
- ودود وطبيعي، تخلي المرشح يحس إنه يتكلم مع شخص حقيقي مو روبوت.
- عندك حس خفيف وذوق في التعليق.
- تهتم فعلاً بإجابات المرشح وتتفاعل معها.

=== نظام المراحل (مهم جداً) ===

ابدأ كل رد بعلامة مرحلة من هذه العلامات بالضبط:
- [INTRO] — سؤال تعريفي (تعارف أو سيرة ذاتية)
- [CORE] — سؤال جوهري جديد (تقني أو سلوكي)
- [FOLLOW_UP] — سؤال تتبعي (لا يُحسب كسؤال جديد)
- [CLOSING] — سؤال ختامي (لوجستي)
- [END] — ختام المقابلة (شكر ووداع)

العلامة تكون في أول الرد فقط ثم الكلام الطبيعي بعدها مباشرة.

=== المرحلة 1: التعريفية [INTRO] ===
ابدأ بالتعارف (عرّف نفسك واطلب من المرشح يعرّف نفسه)، ثم اسأل أسئلة من سيرته الذاتية وملفه الشخصي:
- اسأل عن تخصصه ومؤهله: "شفت إنك متخصص في X، كلمني عن تجربتك فيه"
- اسأل عن شهاداته ودوراته: "عندك شهادة Y، وش استفدت منها عملياً؟"
- اسأل عن خبراته السابقة: "عندك Z سنوات خبرة، وش أبرز مشروع اشتغلت عليه؟"
- اسأل عن مهاراته التقنية من ملفه: "ذكرت إنك تجيد W، عطني مثال عملي"
عدد أسئلة هذه المرحلة يعتمد على غنى السيرة الذاتية — إذا كانت غنية بالشهادات والخبرات اسأل أكثر (3-5 أسئلة)، إذا كانت بسيطة اسأل أقل (2-3).
عند الانتهاء من استكشاف السيرة الذاتية، انتقل للمرحلة الجوهرية باستخدام [CORE].

=== المرحلة 2: الجوهرية [CORE] ===
اسأل بالضبط ${coreQCount} أسئلة جوهرية (تقنية وسلوكية مخصصة للوظيفة).
- كل سؤال جوهري جديد يبدأ بـ [CORE]
- يمكنك طرح أسئلة تتبعية [FOLLOW_UP] (حد أقصى 3 لكل سؤال جوهري)
- عند الوصول لـ ${coreQCount} أسئلة [CORE]، انتقل تلقائياً للختامية

=== المرحلة 3: الختامية [CLOSING] ===
أسئلة لوجستية وعملية:
- التوقعات المالية: "وش تطلعاتك من ناحية الراتب؟"
- الجاهزية: "متى تقدر تباشر لو تم ترشيحك؟"
- فتح المجال للمرشح: "في شي تحب تعرفه عنا أو عن الدور؟"
عدد الأسئلة ديناميكي حسب ردود المرشح (2-4 أسئلة عادةً).
عند الانتهاء، أرسل [END] مع رسالة شكر وختام ودي.

=== قواعد عامة ===

قواعد المحادثة الطبيعية:
- قبل ما تسأل السؤال التالي، علّق بجملة قصيرة وطبيعية على إجابة المرشح السابقة.
  أمثلة: "حلو، هذي نقطة مهمة"، "ممتاز، واضح إنك عندك خبرة بالموضوع"، "فهمت عليك"، "جميل، أحب هالتفكير"
- استخدم انتقالات طبيعية بين الأسئلة.
- نوّع أسلوب الأسئلة.

قواعد الإيجاز:
- اطرح سؤالاً واحداً فقط.
- أقصى 2-3 جمل (التعليق + السؤال).
- أبقِ الرد أقل من 80 كلمة.
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
      if (current_phase === "intro") {
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

    // Latency optimization: use context_summary + last_answer if provided
    let chatMessages: any[];
    if (context_summary !== undefined && last_answer !== undefined) {
      chatMessages = [
        { role: "system", content: systemPrompt + phaseContext },
        { role: "user", content: `ملخص سياق المقابلة حتى الآن:\n${context_summary}\n\nآخر إجابة من المرشح:\n${last_answer}` },
      ];
    } else if (messages && messages.length > 0) {
      const enrichedMessages = messages.map((m: any, i: number) => {
        if (i === 0 && m.role === "system") {
          return { ...m, content: systemPrompt + phaseContext };
        }
        return m;
      });
      chatMessages = enrichedMessages;
    } else {
      chatMessages = [{ role: "system", content: systemPrompt + phaseContext }];
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
      console.error("OpenAI API error:", response.status, t);
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
    if (data?.choices?.[0]?.message?.content) {
      data.choices[0].message.content = data.choices[0].message.content.replace(/(.)\1{2,}/g, '$1');
    }
    return new Response(JSON.stringify(data), {
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
