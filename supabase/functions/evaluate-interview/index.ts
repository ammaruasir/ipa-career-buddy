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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [interviewRes, responsesRes, settingsRes] = await Promise.all([
      supabase.from("interviews").select("*").eq("id", interview_id).single(),
      supabase.from("responses").select("*").eq("interview_id", interview_id).order("created_at", { ascending: true }),
      supabase.from("system_settings").select("*").limit(1).single(),
    ]);

    if (interviewRes.error || !interviewRes.data) throw new Error("Interview not found");
    if (responsesRes.error) throw new Error("Failed to fetch responses");

    const interview = interviewRes.data;
    const responses = responsesRes.data || [];
    const settings = settingsRes.data;

    // P0.1: mode-conditional behavior
    // practice: cheaper model, no HR notification, no job lookup required
    // assessment / mock_final: full evaluation + HR pipeline updates
    const mode = (interview as any).mode || "assessment";
    const isPractice = mode === "practice";

    // Load job data only when relevant
    let jobData: any = null;
    if (!isPractice && interview.job_position) {
      const { data: vacancy } = await supabase
        .from("job_vacancies")
        .select("title, description, requirements, department")
        .eq("title", interview.job_position)
        .limit(1)
        .maybeSingle();
      jobData = vacancy;
    }

    const weights = settings?.scoring_weights as any || { technical: 40, communication: 30, cultural_fit: 30 };
    const totalWeight = (weights.technical || 40) + (weights.communication || 30) + (weights.cultural_fit || 30);
    const wTech = (weights.technical || 40) / totalWeight;
    const wComm = (weights.communication || 30) / totalWeight;
    const wCult = (weights.cultural_fit || 30) / totalWeight;

    const thresholds = settings?.evaluation_thresholds as any || { highly_recommended: 80, recommended: 60 };
    const fillerPatterns: string[] = (settings?.filler_words as any) || ["ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة"];

    // Build transcript
    const transcript = responses
      .map((r: any, i: number) => `سؤال ${i + 1}: ${r.question_text}\nإجابة: ${r.answer_text || "(لم يتم الإجابة)"}`)
      .join("\n\n");

    // Count filler words
    const allAnswers = responses.map((r: any) => r.answer_text || "").join(" ");
    let fillerCount = 0;
    for (const filler of fillerPatterns) {
      const matches = allAnswers.match(new RegExp(filler, "g"));
      if (matches) fillerCount += matches.length;
    }

    const totalWords = allAnswers.split(/\s+/).filter(Boolean).length;
    const totalResponses = responses.length;
    const avgWordsPerResponse = totalResponses > 0 ? totalWords / totalResponses : 0;
    const estimatedPace = Math.round(avgWordsPerResponse * 2);

    // Video analysis aggregation
    const videoAnalyses = responses
      .filter((r: any) => r.ai_analysis && typeof r.ai_analysis === "object")
      .map((r: any) => r.ai_analysis);

    let videoAnalysisSummary = "";
    let avgEyeContact = 0, avgVideoConfidence = 0, avgEngagement = 0, avgProfAppearance = 0;

    if (videoAnalyses.length > 0) {
      avgEyeContact = Math.round(videoAnalyses.reduce((sum: number, a: any) => sum + (a.eye_contact_score || 0), 0) / videoAnalyses.length);
      avgVideoConfidence = Math.round(videoAnalyses.reduce((sum: number, a: any) => sum + (a.confidence_score || 0), 0) / videoAnalyses.length);
      avgEngagement = Math.round(videoAnalyses.reduce((sum: number, a: any) => sum + (a.engagement_score || 0), 0) / videoAnalyses.length);
      avgProfAppearance = Math.round(videoAnalyses.reduce((sum: number, a: any) => sum + (a.professional_appearance || 0), 0) / videoAnalyses.length);

      videoAnalysisSummary = `
تحليل الفيديو:
- التواصل البصري: ${avgEyeContact}/100
- الثقة: ${avgVideoConfidence}/100
- الانخراط: ${avgEngagement}/100
- المظهر المهني: ${avgProfAppearance}/100`;
    }

    const jobContext = jobData
      ? `\nبيانات الوظيفة:
- المسمى: ${jobData.title}
- الوصف: ${jobData.description || "—"}
- القسم: ${jobData.department || "—"}
- المتطلبات: ${JSON.stringify(jobData.requirements || [])}`
      : isPractice
        ? "\nهذه جلسة تدريب حرّة — ركّز على الكفاءات السلوكية العامة (STAR) وليس على مطابقة وظيفة محدّدة."
        : "";

    const roleDescriptor = isPractice
      ? "أنت مدرّب مقابلات تكويني (formative coach). الهدف تعليمي، ليس تقييمياً."
      : "أنت خبير تقييم مقابلات وظيفية رسمي. قم بتحليل نص المقابلة وتقييم المرشح بشكل شامل.";

    const systemPrompt = `${roleDescriptor}

الوظيفة: ${interview.job_position || "—"}${jobContext}

معايير التقييم:
1. مهارات التواصل (0-100) — الوزن: ${Math.round(wComm * 100)}%
2. الكفاءة التقنية (0-100) — الوزن: ${Math.round(wTech * 100)}%
3. حل المشكلات (0-100)
4. القيادة (0-100)
5. التوافق الثقافي (0-100) — الوزن: ${Math.round(wCult * 100)}%
6. نوع الشخصية DISC
7. نقاط القوة (3-5)
8. مجالات التطوير (2-3)
9. إشارات تحذيرية (إن وجدت)
10. التوصية النهائية: "توصية قوية بالتوظيف" / "توصية مشروطة" / "غير موصى بالتوظيف"
11. مستوى الثقة (نسبة مئوية)

كلمات الحشو: ${fillerCount} | سرعة الكلام: ${estimatedPace} ك/د
${videoAnalysisSummary}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // P0.1: tiered model cost — practice uses cheaper mini model
        model: isPractice ? "gpt-4.1-mini" : "gpt-4.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `نص المقابلة:\n\n${transcript}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submit the complete interview evaluation",
              parameters: {
                type: "object",
                properties: {
                  communication_score: { type: "number", description: "Communication skills 0-100" },
                  technical_score: { type: "number", description: "Technical competency 0-100" },
                  problem_solving: { type: "number", description: "Problem solving 0-100" },
                  leadership: { type: "number", description: "Leadership 0-100" },
                  culture_alignment: { type: "number", description: "Cultural alignment 0-100" },
                  personality_type: { type: "string", enum: ["D", "I", "S", "C"] },
                  sentiment: { type: "string", enum: ["إيجابي", "محايد", "سلبي"] },
                  confidence_score: { type: "number", description: "Confidence level 0-100" },
                  strengths: { type: "array", items: { type: "string" } },
                  development_areas: { type: "array", items: { type: "string" } },
                  red_flags: { type: "array", items: { type: "string" } },
                  final_recommendation: { type: "string", enum: ["توصية قوية بالتوظيف", "توصية مشروطة", "غير موصى بالتوظيف"] },
                  confidence_level: { type: "string", description: "Confidence percentage e.g. 85%" },
                  ai_feedback: { type: "string", description: "Comprehensive Arabic feedback" },
                },
                required: [
                  "communication_score", "technical_score", "problem_solving", "leadership",
                  "culture_alignment", "personality_type", "sentiment", "confidence_score",
                  "strengths", "development_areas", "red_flags", "final_recommendation",
                  "confidence_level", "ai_feedback"
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
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI evaluation failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No evaluation returned from AI");

    const evaluation = JSON.parse(toolCall.function.arguments);
    const overallScore = Math.round(
      (evaluation.communication_score * wComm) +
      (evaluation.technical_score * wTech) +
      (evaluation.culture_alignment * wCult)
    );

    // Map final_recommendation to legacy recommendation field
    const legacyRec = evaluation.final_recommendation === "توصية قوية بالتوظيف" ? "موصى به بشدة"
      : evaluation.final_recommendation === "توصية مشروطة" ? "موصى به"
      : "غير موصى به";

    const evalRecord: Record<string, any> = {
      interview_id,
      communication_score: evaluation.communication_score,
      technical_score: evaluation.technical_score,
      personality_match: evaluation.culture_alignment,
      problem_solving: evaluation.problem_solving,
      leadership: evaluation.leadership,
      culture_alignment: evaluation.culture_alignment,
      overall_score: overallScore,
      strengths: evaluation.strengths,
      improvements: evaluation.development_areas,
      ai_feedback_ar: evaluation.ai_feedback,
      recommendation: legacyRec,
      final_recommendation: evaluation.final_recommendation,
      personality_type: evaluation.personality_type,
      filler_words_count: fillerCount,
      sentiment: evaluation.sentiment,
      speech_pace: estimatedPace,
      confidence_score: evaluation.confidence_score,
      confidence_level: evaluation.confidence_level,
      red_flags: evaluation.red_flags || [],
      review_status: "pending_review",
      detailed_scores: {
        communication: evaluation.communication_score,
        technical: evaluation.technical_score,
        problem_solving: evaluation.problem_solving,
        leadership: evaluation.leadership,
        culture_alignment: evaluation.culture_alignment,
        confidence: evaluation.confidence_score,
        filler_words: fillerCount,
        speech_pace: estimatedPace,
        weights: { technical: wTech, communication: wComm, cultural_fit: wCult },
        ...(videoAnalyses.length > 0 ? {
          video_analysis: {
            eye_contact: avgEyeContact,
            video_confidence: avgVideoConfidence,
            engagement: avgEngagement,
            professional_appearance: avgProfAppearance,
            analyses_count: videoAnalyses.length,
          },
        } : {}),
      },
    };

    // P0.1: in practice mode, evaluation is auto-released to the student (no HR review gate)
    if (isPractice) {
      evalRecord.review_status = "released";
    }

    const { data: savedEval, error: saveErr } = await supabase
      .from("evaluations")
      .insert(evalRecord)
      .select()
      .single();

    if (saveErr) {
      console.error("Save evaluation error:", saveErr);
      throw new Error("Failed to save evaluation");
    }

    // P0.2: fire-and-forget per-answer coaching for practice mode (where it matters most)
    if (isPractice) {
      try {
        const coachUrl = `${SUPABASE_URL}/functions/v1/coach-response`;
        await fetch(coachUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ interview_id }),
        }).catch((err) => console.warn("coach-response invocation failed:", err));
      } catch (err) {
        console.warn("coach-response trigger error:", err);
      }
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
