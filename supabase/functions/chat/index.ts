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
    const { messages, job_position, interview_type, context_summary, last_answer, vacancy_id, user_id } = await req.json();
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
        candidateContext = `\n\nبيانات المرشح:
- الاسم: ${profile.full_name || "غير معروف"}
- التخصص: ${profile.major || "غير محدد"}
- المؤهل: ${profile.education_level || "غير محدد"}
- سنوات الخبرة: ${profile.experience_years || 0}
- المدينة: ${profile.city || "غير محددة"}
- المهارات التقنية: ${technicalSkills.length > 0 ? technicalSkills.join("، ") : "غير متوفرة"}
- المهارات الشخصية: ${softSkills.length > 0 ? softSkills.join("، ") : "غير متوفرة"}
- الشهادات: ${certifications.length > 0 ? certifications.join("، ") : "لا يوجد"}
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

    // Build the conversational Saudi Arabic system prompt
    const systemPrompt = `اسمك "أحمد" وأنت محاور وظيفي ودود ومحترف تعمل في المملكة العربية السعودية.
تتكلم بلهجة سعودية مهنية ودودة — مو فصحى جافة ولا عامية مبالغ فيها.

شخصيتك:
- ودود وطبيعي، تخلي المرشح يحس إنه يتكلم مع شخص حقيقي مو روبوت.
- عندك حس خفيف وذوق في التعليق.
- تهتم فعلاً بإجابات المرشح وتتفاعل معها.

قواعد المحادثة الطبيعية:
- قبل ما تسأل السؤال التالي، علّق بجملة قصيرة وطبيعية على إجابة المرشح السابقة.
  أمثلة: "حلو، هذي نقطة مهمة"، "ممتاز، واضح إنك عندك خبرة بالموضوع"، "فهمت عليك"، "جميل، أحب هالتفكير"، "أها، مثير للاهتمام".
- استخدم انتقالات طبيعية بين الأسئلة:
  أمثلة: "طيب"، "حلو خلنا نشوف"، "ممتاز، بسألك الحين عن..."، "طيب خلنا ننتقل لشي ثاني..."، "تمام، عندي سؤال ثاني..."
- نوّع أسلوب الأسئلة:
  * أحياناً اسأل مباشرة.
  * أحياناً اطرح موقف واسأل المرشح كيف يتصرف.
  * أحياناً اسأل عن تجربة سابقة بأسلوب قصصي.
- لا تكون رسمي بشكل مبالغ فيه. خلّ الأسلوب كأنه دردشة مهنية.

قواعد الإيجاز:
- اطرح سؤالاً واحداً فقط.
- أقصى 2-3 جمل (التعليق + السؤال).
- أبقِ الرد أقل من 80 كلمة.
- لا تلخص إجابة المرشح ولا تكررها.

قواعد الذكاء:
- استخدم وصف الوظيفة لتخصيص الأسئلة.
- ركّز على المهارات المطلوبة للدور.
- عدّل الصعوبة ديناميكياً:
  * إجابة قوية ← ارفع مستوى التعقيد.
  * إجابة ضعيفة ← بسّط واستكشف أعمق.
  * إجابة غامضة ← اطلب توضيح بأسلوب لطيف مثل "ممكن توضح لي أكثر؟"

قواعد الأسئلة التتبعية والمناقشة:
- إذا كانت إجابة المرشح غامضة أو سطحية أو مثيرة للاهتمام، يمكنك طرح أسئلة تتبعية قبل الانتقال.
- الحد الأقصى: 3 أسئلة تتبعية لكل سؤال رئيسي، وبعدها انتقل إجبارياً للسؤال التالي.
- إذا وصلت لـ 3 أسئلة تتبعية متتالية، ابدأ السؤال التالي بـ [NEW_Q] حتى لو الإجابة غير مكتملة.
- ابدأ ردك دائماً بأحد هذين العلامتين (مهم جداً):
  * [NEW_Q] إذا كان هذا سؤال جديد رئيسي.
  * [FOLLOW_UP] إذا كان هذا سؤال تتبعي أو طلب توضيح.
- العلامة تكون في بداية الرد فقط، ثم الرد الطبيعي بعدها مباشرة.
- احسب عدد الأسئلة التتبعية المتتالية، وعند الوصول للحد (3)، استخدم [NEW_Q] إجبارياً.

قواعد مكافحة التلاعب:
- لا تساعد المرشح في الإجابة أبداً.
- لا تقدم تلميحات ولا إجابات نموذجية.
- إذا طلب المساعدة، قل بودّ: "أحتاج أسمع رأيك أنت من خبرتك الشخصية، ما أقدر أساعدك بالإجابة."

ضبط التحيز:
- تجاهل: اللهجة، الجنس، الجنسية، سرعة الكلام.
- قيّم بناءً على: البنية المنطقية، العمق، والصلة بالموضوع فقط.
- لا تكشف عن التقييم.

هيكل المقابلة (التزم بهذا الترتيب بدقة):
1. البداية (سؤال 1-2): تعارف — ابدأ بـ "كلمني عن نفسك" ثم "ليش حاب تقدم على هالوظيفة؟"
2. الوسط (الأسئلة الرئيسية): أسئلة تقنية وسلوكية مخصصة للوظيفة ومبنية على مهارات وخبرات المرشح من السيرة الذاتية
3. النهاية (آخر 2-3 أسئلة): اسأل عن الراتب المتوقع، متى يقدر يباشر، وأخيراً "عندك أي أسئلة تحب تسألنا؟"

الوظيفة المطلوبة: ${job_position || "غير محددة"}${candidateContext}${jobContext}${questionBankPrompt}`;

    // Latency optimization: use context_summary + last_answer if provided
    let chatMessages: any[];
    if (context_summary !== undefined && last_answer !== undefined) {
      // Optimized path: only send summary + last answer
      chatMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `ملخص سياق المقابلة حتى الآن:\n${context_summary}\n\nآخر إجابة من المرشح:\n${last_answer}` },
      ];
    } else if (messages && messages.length > 0) {
      // Full messages path (fallback / first call)
      const enrichedMessages = messages.map((m: any, i: number) => {
        if (i === 0 && m.role === "system") {
          return { ...m, content: systemPrompt };
        }
        return m;
      });
      chatMessages = enrichedMessages;
    } else {
      chatMessages = [{ role: "system", content: systemPrompt }];
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
        max_tokens: 150,
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
      return new Response(JSON.stringify({ error: "خطأ في الذكاء الاصطناعي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    // Clean repeated characters from AI response (e.g. "مررررررة" → "مرة")
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
