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
    const { interview_id } = await req.json();
    if (!interview_id) throw new Error("interview_id is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch interview + responses
    const { data: interview, error: intErr } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", interview_id)
      .single();
    if (intErr || !interview) throw new Error("Interview not found");

    const { data: responses, error: respErr } = await supabase
      .from("responses")
      .select("*")
      .eq("interview_id", interview_id)
      .order("created_at", { ascending: true });
    if (respErr) throw new Error("Failed to fetch responses");

    // Build transcript for AI evaluation
    const transcript = (responses || [])
      .map((r: any, i: number) => `سؤال ${i + 1}: ${r.question_text}\nإجابة: ${r.answer_text || "(لم يتم الإجابة)"}`)
      .join("\n\n");

    // Count filler words
    const allAnswers = (responses || []).map((r: any) => r.answer_text || "").join(" ");
    const fillerPatterns = ["ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة", "الله يعطيك العافية"];
    let fillerCount = 0;
    for (const filler of fillerPatterns) {
      const regex = new RegExp(filler, "g");
      const matches = allAnswers.match(regex);
      if (matches) fillerCount += matches.length;
    }

    // Estimate speech pace (words per minute, rough estimate)
    const totalWords = allAnswers.split(/\s+/).filter(Boolean).length;
    const totalResponses = (responses || []).length;
    const avgWordsPerResponse = totalResponses > 0 ? totalWords / totalResponses : 0;
    const estimatedPace = Math.round(avgWordsPerResponse * 2); // rough WPM estimate

    // Call Lovable AI with tool calling for structured evaluation
    const systemPrompt = `أنت خبير تقييم مقابلات وظيفية في معهد الإدارة العامة بالمملكة العربية السعودية. 
قم بتحليل نص المقابلة التالية وتقييم المرشح بشكل شامل.

الوظيفة المطلوبة: ${interview.job_position}

معايير التقييم:
1. مهارات التواصل (0-100): وضوح الأفكار، التعبير باللغة العربية، تنظيم الإجابات
2. الكفاءة التقنية (0-100): مطابقة المهارات مع متطلبات الوظيفة، عمق المعرفة
3. التوافق الثقافي (0-100): التوافق مع قيم معهد الإدارة العامة (التميز، الابتكار، الاحترافية)
4. نوع الشخصية DISC: (D-مسيطر / I-مؤثر / S-ثابت / C-متقن)
5. التوصية النهائية: "موصى به بشدة" (80+) / "موصى به" (60-79) / "غير موصى به" (<60)

تحليل إضافي:
- تحليل المشاعر العام: إيجابي / محايد / سلبي
- مستوى الثقة (0-100)
- نقاط القوة (3-5 نقاط بالعربية)
- نقاط التحسين (2-3 نقاط بالعربية)
- ملاحظات عامة بالعربية

عدد كلمات الحشو المكتشفة: ${fillerCount}
سرعة الكلام التقديرية: ${estimatedPace} كلمة في الدقيقة`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `نص المقابلة:\n\n${transcript}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submit the complete interview evaluation with scores and feedback in Arabic",
              parameters: {
                type: "object",
                properties: {
                  communication_score: { type: "number", description: "Communication skills score 0-100" },
                  technical_score: { type: "number", description: "Technical competency score 0-100" },
                  cultural_fit_score: { type: "number", description: "Cultural fit score 0-100" },
                  personality_type: { type: "string", enum: ["D", "I", "S", "C"], description: "DISC personality type" },
                  recommendation: { type: "string", enum: ["موصى به بشدة", "موصى به", "غير موصى به"] },
                  sentiment: { type: "string", enum: ["إيجابي", "محايد", "سلبي"] },
                  confidence_score: { type: "number", description: "Confidence level 0-100" },
                  strengths: { type: "array", items: { type: "string" }, description: "3-5 strengths in Arabic" },
                  improvements: { type: "array", items: { type: "string" }, description: "2-3 improvements in Arabic" },
                  ai_feedback: { type: "string", description: "Comprehensive Arabic feedback paragraph" },
                },
                required: [
                  "communication_score", "technical_score", "cultural_fit_score",
                  "personality_type", "recommendation", "sentiment", "confidence_score",
                  "strengths", "improvements", "ai_feedback"
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI evaluation failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No evaluation returned from AI");

    const evaluation = JSON.parse(toolCall.function.arguments);
    const overallScore = Math.round(
      (evaluation.communication_score * 0.3) +
      (evaluation.technical_score * 0.4) +
      (evaluation.cultural_fit_score * 0.3)
    );

    // Save to database
    const evalRecord = {
      interview_id,
      communication_score: evaluation.communication_score,
      technical_score: evaluation.technical_score,
      personality_match: evaluation.cultural_fit_score,
      overall_score: overallScore,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      ai_feedback_ar: evaluation.ai_feedback,
      recommendation: evaluation.recommendation,
      personality_type: evaluation.personality_type,
      filler_words_count: fillerCount,
      sentiment: evaluation.sentiment,
      speech_pace: estimatedPace,
      confidence_score: evaluation.confidence_score,
      detailed_scores: {
        communication: evaluation.communication_score,
        technical: evaluation.technical_score,
        cultural_fit: evaluation.cultural_fit_score,
        confidence: evaluation.confidence_score,
        filler_words: fillerCount,
        speech_pace: estimatedPace,
      },
    };

    const { data: savedEval, error: saveErr } = await supabase
      .from("evaluations")
      .insert(evalRecord)
      .select()
      .single();

    if (saveErr) {
      console.error("Save evaluation error:", saveErr);
      throw new Error("Failed to save evaluation");
    }

    return new Response(JSON.stringify(savedEval), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-interview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
