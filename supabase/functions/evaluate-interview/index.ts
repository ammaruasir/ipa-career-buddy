import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Per-response STAR coaching using Lovable AI (cheaper Gemini Flash).
async function coachResponses(
  responses: any[],
  jobPosition: string,
  jobContext: string,
  fillerPatterns: string[],
  lovableKey: string | undefined,
  supabase: any,
) {
  if (!lovableKey || responses.length === 0) return;

  await Promise.all(
    responses.map(async (r) => {
      const answer = r.answer_text || "";
      if (!answer.trim()) return;

      // Inline filler-word marks (no timestamps yet — Whisper integration is P1)
      const fillerMarks: { word: string; offset: number }[] = [];
      for (const w of fillerPatterns) {
        let idx = -1;
        const re = new RegExp(w, "g");
        let m;
        while ((m = re.exec(answer)) !== null) {
          fillerMarks.push({ word: w, offset: m.index });
        }
      }

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `أنت مدرّب مقابلات وظيفية للقطاع الحكومي السعودي. مهمّتك: تحليل إجابة طالب وتقديم تغذية راجعة تعليمية وفق منهج STAR (Situation / Task / Action / Result). الإجابة قد تكون بالعربية الفصحى أو لهجة سعودية — قيّم بنفس اللغة. لا تجامل ولا تقسو؛ كن تعليمياً.`,
              },
              {
                role: "user",
                content: `الوظيفة: ${jobPosition}${jobContext}\n\nالسؤال: ${r.question_text}\n\nإجابة الطالب:\n${answer}\n\nحلّل وفق STAR ثم قدّم إعادة كتابة محسّنة وإجابة نموذجية قصيرة.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "coach_answer",
                  description: "Return STAR coaching for the answer",
                  parameters: {
                    type: "object",
                    properties: {
                      star: {
                        type: "object",
                        properties: {
                          s: { type: "number", description: "Situation coverage 0-3" },
                          t: { type: "number", description: "Task coverage 0-3" },
                          a: { type: "number", description: "Action coverage 0-3" },
                          r: { type: "number", description: "Result coverage 0-3" },
                        },
                        required: ["s", "t", "a", "r"],
                      },
                      coverage_score: { type: "number", description: "Overall coverage 0-100" },
                      rewrite_ar: {
                        type: "string",
                        description: "نسخة محسّنة من إجابة الطالب نفسه بنفس المعنى لكن بصياغة STAR قوية بالعربية الفصحى",
                      },
                      exemplar_ar: {
                        type: "string",
                        description: "إجابة نموذجية قصيرة (4-6 أسطر) على نفس السؤال — مثال على ما تبدو عليه الإجابة القوية",
                      },
                      tips: {
                        type: "array",
                        items: { type: "string" },
                        description: "2-4 نصائح محددة قابلة للتنفيذ في الجلسة التالية",
                      },
                      strengths_in_answer: {
                        type: "array",
                        items: { type: "string" },
                        description: "نقاط قوة فعلية في إجابة الطالب (مرتبطة بنصّ الطالب)",
                      },
                    },
                    required: ["star", "coverage_score", "rewrite_ar", "exemplar_ar", "tips"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "coach_answer" } },
          }),
        });

        if (!res.ok) {
          console.error("coach response failed", res.status);
          return;
        }
        const data = await res.json();
        const tool = data.choices?.[0]?.message?.tool_calls?.[0];
        if (!tool?.function?.arguments) return;

        const parsed = JSON.parse(tool.function.arguments);
        const coaching = {
          ...parsed,
          filler_marks: fillerMarks,
        };
        await supabase.from("responses").update({ coaching }).eq("id", r.id);
      } catch (err) {
        console.error("coachResponses error", err);
      }
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interview_id } = await req.json();
    if (!interview_id) throw new Error("interview_id is required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    // Decide model + scope by mode (P0.1: practice uses cheap model + formative scope)
    const isPractice = interview.mode === "practice";
    const isMockFinal = interview.mode === "mock_final";
    const useGpt = !isPractice && OPENAI_API_KEY;
    const scope = isPractice ? "formative" : "summative";

    // Load job data from DB
    const { data: vacancy } = await supabase
      .from("job_vacancies")
      .select("title, description, requirements, department")
      .eq("title", interview.job_position)
      .limit(1)
      .maybeSingle();
    const jobData = vacancy;

    const weights = (settings?.scoring_weights as any) || { technical: 40, communication: 30, cultural_fit: 30 };
    const totalWeight = (weights.technical || 40) + (weights.communication || 30) + (weights.cultural_fit || 30);
    const wTech = (weights.technical || 40) / totalWeight;
    const wComm = (weights.communication || 30) / totalWeight;
    const wCult = (weights.cultural_fit || 30) / totalWeight;

    const fillerPatterns: string[] = (settings?.filler_words as any) || [
      "ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة",
    ];

    const transcript = responses
      .map(
        (r: any, i: number) =>
          `سؤال ${i + 1}: ${r.question_text}\nإجابة: ${r.answer_text || "(لم يتم الإجابة)"}`,
      )
      .join("\n\n");

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

    const videoAnalyses = responses
      .filter((r: any) => r.ai_analysis && typeof r.ai_analysis === "object")
      .map((r: any) => r.ai_analysis);

    let videoAnalysisSummary = "";
    let avgEyeContact = 0,
      avgVideoConfidence = 0,
      avgEngagement = 0,
      avgProfAppearance = 0;
    if (videoAnalyses.length > 0) {
      avgEyeContact = Math.round(videoAnalyses.reduce((s: number, a: any) => s + (a.eye_contact_score || 0), 0) / videoAnalyses.length);
      avgVideoConfidence = Math.round(videoAnalyses.reduce((s: number, a: any) => s + (a.confidence_score || 0), 0) / videoAnalyses.length);
      avgEngagement = Math.round(videoAnalyses.reduce((s: number, a: any) => s + (a.engagement_score || 0), 0) / videoAnalyses.length);
      avgProfAppearance = Math.round(videoAnalyses.reduce((s: number, a: any) => s + (a.professional_appearance || 0), 0) / videoAnalyses.length);

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
      : "";

    const modeNote = isPractice
      ? "\n\n(ملاحظة: هذه جلسة تدريب — ركّز التوصيات على التعلّم لا على قرار التوظيف.)"
      : isMockFinal
        ? "\n\n(ملاحظة: هذه مقابلة محاكاة نهائية — قيّم كأنها مقابلة حقيقية.)"
        : "";

    const systemPrompt = `أنت خبير تقييم مقابلات وظيفية في القطاع الحكومي السعودي. قم بتحليل نص المقابلة وتقييم المتدرّب بشكل شامل.

الوظيفة: ${interview.job_position}${jobContext}${modeNote}

معايير التقييم:
1. مهارات التواصل (0-100) — الوزن: ${Math.round(wComm * 100)}%
2. الكفاءة التقنية (0-100) — الوزن: ${Math.round(wTech * 100)}%
3. حل المشكلات (0-100)
4. القيادة (0-100)
5. التوافق الثقافي (0-100) — الوزن: ${Math.round(wCult * 100)}%
6. نوع الشخصية DISC
7. نقاط القوة (3-5)
8. مجالات التطوير (2-3) — صياغة تعليمية محددة قابلة للتنفيذ
9. إشارات تحذيرية (إن وجدت)
10. التوصية النهائية: "توصية قوية بالتوظيف" / "توصية مشروطة" / "غير موصى بالتوظيف"
11. مستوى الثقة (نسبة مئوية)

كلمات الحشو: ${fillerCount} | سرعة الكلام: ${estimatedPace} ك/د
${videoAnalysisSummary}`;

    const toolDef = {
      type: "function" as const,
      function: {
        name: "submit_evaluation",
        description: "Submit the complete interview evaluation",
        parameters: {
          type: "object",
          properties: {
            communication_score: { type: "number" },
            technical_score: { type: "number" },
            problem_solving: { type: "number" },
            leadership: { type: "number" },
            culture_alignment: { type: "number" },
            personality_type: { type: "string", enum: ["D", "I", "S", "C"] },
            sentiment: { type: "string", enum: ["إيجابي", "محايد", "سلبي"] },
            confidence_score: { type: "number" },
            strengths: { type: "array", items: { type: "string" } },
            development_areas: { type: "array", items: { type: "string" } },
            red_flags: { type: "array", items: { type: "string" } },
            final_recommendation: {
              type: "string",
              enum: ["توصية قوية بالتوظيف", "توصية مشروطة", "غير موصى بالتوظيف"],
            },
            confidence_level: { type: "string" },
            ai_feedback: { type: "string" },
          },
          required: [
            "communication_score", "technical_score", "problem_solving", "leadership",
            "culture_alignment", "personality_type", "sentiment", "confidence_score",
            "strengths", "development_areas", "red_flags", "final_recommendation",
            "confidence_level", "ai_feedback",
          ],
          additionalProperties: false,
        },
      },
    };

    let aiData: any;
    if (useGpt) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `نص المقابلة:\n\n${transcript}` },
          ],
          tools: [toolDef],
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
      aiData = await response.json();
    } else {
      // Practice mode (or no OpenAI key) → use Lovable Gemini
      if (!LOVABLE_API_KEY) throw new Error("No AI key available");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `نص المقابلة:\n\n${transcript}` },
          ],
          tools: [toolDef],
          tool_choice: { type: "function", function: { name: "submit_evaluation" } },
        }),
      });
      if (!response.ok) {
        const t = await response.text();
        console.error("Lovable AI error:", response.status, t);
        throw new Error("AI evaluation failed");
      }
      aiData = await response.json();
    }

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No evaluation returned from AI");

    const evaluation = JSON.parse(toolCall.function.arguments);
    const overallScore = Math.round(
      evaluation.communication_score * wComm +
        evaluation.technical_score * wTech +
        evaluation.culture_alignment * wCult,
    );

    const legacyRec =
      evaluation.final_recommendation === "توصية قوية بالتوظيف"
        ? "موصى به بشدة"
        : evaluation.final_recommendation === "توصية مشروطة"
          ? "موصى به"
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
      review_status: isPractice ? "auto_released" : "pending_review",
      scope,
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
        ...(videoAnalyses.length > 0
          ? {
              video_analysis: {
                eye_contact: avgEyeContact,
                video_confidence: avgVideoConfidence,
                engagement: avgEngagement,
                professional_appearance: avgProfAppearance,
                analyses_count: videoAnalyses.length,
              },
            }
          : {}),
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

    // P0.2 — fire per-response STAR coaching in background.
    // In practice mode, always coach (educational priority).
    // In assessment mode, coach too — student review value high.
    coachResponses(responses, interview.job_position, jobContext, fillerPatterns, LOVABLE_API_KEY, supabase).catch(
      (e) => console.error("background coaching error", e),
    );

    return new Response(JSON.stringify(savedEval), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-interview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
