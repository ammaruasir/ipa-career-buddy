// P0.2: coach-response — generates per-answer STAR coaching, rewrite, and exemplar.
// Called from evaluate-interview (practice mode) or on-demand from the UI.
// Writes to responses.coaching JSONB column.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COACH_SYSTEM_PROMPT = `أنت مدرّب مقابلات محترف متخصّص في القطاع الحكومي السعودي ومعهد الإدارة العامة (IPA).
مهمّتك: تحليل إجابة الطالب وفق إطار STAR (الموقف Situation، المهمّة Task، الإجراء Action، النتيجة Result) ثم تقديم تغذية راجعة تعليمية.

لكل عنصر من STAR:
- covered: هل ذكره الطالب بوضوح؟ (true/false)
- evidence: الجملة الحرفية من إجابة الطالب التي تدلّ على ذلك (null إن لم تُذكر)
- score: درجة الجودة من 0 إلى 1

ثم اقترح:
- rewrite: نسخة معاد كتابتها بعربية فصحى رسمية مناسبة للمقابلات الحكومية. احتفظ بأسلوب الطالب وحقائقه؛ نظّم البنية وفق STAR. لا تبالغ.
- exemplar: إجابة نموذجية مثالية لنفس السؤال (ليس إعادة كتابة لإجابة الطالب) تُظهر "كيف تبدو الإجابة القوية".

تجنّب:
- التعالي أو السخرية
- الترويج العدواني للذات (غير ملائم ثقافياً في السياق السعودي)
- التعميمات الإنجليزية أو الترجمة الحرفية
- اقتراح حقائق لم يذكرها الطالب
- إطالة الإجابة النموذجية بأكثر من ضعف طول إجابة الطالب

ركّز على نبرة: التواضع المهني، احترام التسلسل الإداري، اتساق رؤية 2030 السعودية.`;

const COACH_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_coaching",
    description: "Submit per-answer coaching analysis",
    parameters: {
      type: "object",
      properties: {
        star: {
          type: "object",
          properties: {
            situation: {
              type: "object",
              properties: {
                covered: { type: "boolean" },
                evidence: { type: ["string", "null"] },
                score: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["covered", "evidence", "score"],
              additionalProperties: false,
            },
            task: {
              type: "object",
              properties: {
                covered: { type: "boolean" },
                evidence: { type: ["string", "null"] },
                score: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["covered", "evidence", "score"],
              additionalProperties: false,
            },
            action: {
              type: "object",
              properties: {
                covered: { type: "boolean" },
                evidence: { type: ["string", "null"] },
                score: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["covered", "evidence", "score"],
              additionalProperties: false,
            },
            result: {
              type: "object",
              properties: {
                covered: { type: "boolean" },
                evidence: { type: ["string", "null"] },
                score: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["covered", "evidence", "score"],
              additionalProperties: false,
            },
          },
          required: ["situation", "task", "action", "result"],
          additionalProperties: false,
        },
        rewrite: { type: "string", description: "النسخة المحسّنة بالعربية الفصحى" },
        exemplar: { type: "string", description: "الإجابة النموذجية" },
      },
      required: ["star", "rewrite", "exemplar"],
      additionalProperties: false,
    },
  },
};

interface ResponseRow {
  id: string;
  question_text: string;
  answer_text: string | null;
  coaching: any | null;
}

function countFillerWords(text: string, fillers: string[]) {
  const result: { word: string; count: number }[] = [];
  for (const filler of fillers) {
    // Escape special regex chars in the filler (e.g., spaces)
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = text.match(new RegExp(escaped, "g"));
    if (matches && matches.length > 0) {
      result.push({ word: filler, count: matches.length });
    }
  }
  return result;
}

async function coachOne(
  apiKey: string,
  apiUrl: string,
  model: string,
  question: string,
  answer: string,
  fillerWords: string[],
) {
  const userMsg = `السؤال: ${question}\n\nإجابة الطالب: ${answer}\n\nحلّل الإجابة وفق STAR، ثم اقترح rewrite و exemplar.`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      tools: [COACH_TOOL],
      tool_choice: { type: "function", function: { name: "submit_coaching" } },
      stream: false,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI coaching call failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No coaching returned from AI");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  const star = parsed.star;
  const overallCoverage =
    (star.situation.score + star.task.score + star.action.score + star.result.score) / 4;

  return {
    star: { ...star, overall_coverage: Math.round(overallCoverage * 100) / 100 },
    filler_words: countFillerWords(answer, fillerWords),
    rewrite: parsed.rewrite,
    exemplar: parsed.exemplar,
    model,
    tokens_used: data.usage?.total_tokens ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interview_id, response_id } = await req.json();
    if (!interview_id && !response_id) {
      throw new Error("interview_id or response_id required");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Prefer Lovable AI gateway (cheaper Gemini for practice); fall back to OpenAI.
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiKey: string;
    let apiUrl: string;
    let model: string;
    if (LOVABLE_API_KEY) {
      apiKey = LOVABLE_API_KEY;
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = "google/gemini-2.5-flash";
    } else if (OPENAI_API_KEY) {
      apiKey = OPENAI_API_KEY;
      apiUrl = "https://api.openai.com/v1/chat/completions";
      model = "gpt-4.1-mini";
    } else {
      throw new Error("Neither LOVABLE_API_KEY nor OPENAI_API_KEY is configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load filler words from system_settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("filler_words")
      .limit(1)
      .maybeSingle();
    const fillerWords: string[] =
      (settings?.filler_words as string[]) ||
      ["ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة"];

    // Build the list of responses to coach
    let query = supabase
      .from("responses")
      .select("id, question_text, answer_text, coaching");

    if (response_id) {
      query = query.eq("id", response_id);
    } else {
      query = query.eq("interview_id", interview_id).is("coaching", null);
    }

    const { data: responses, error: respErr } = await query;
    if (respErr) throw new Error(`Failed to fetch responses: ${respErr.message}`);

    const toCoach = (responses || []).filter(
      (r: ResponseRow) => r.answer_text && r.answer_text.trim().length > 0,
    );

    const results: { id: string; ok: boolean; error?: string }[] = [];

    // Coach sequentially to avoid rate-limit storms (max ~10 questions/interview)
    for (const r of toCoach) {
      try {
        const coaching = await coachOne(
          apiKey,
          apiUrl,
          model,
          r.question_text,
          r.answer_text!,
          fillerWords,
        );
        const { error: updateErr } = await supabase
          .from("responses")
          .update({ coaching, coached_at: new Date().toISOString() })
          .eq("id", r.id);
        if (updateErr) {
          results.push({ id: r.id, ok: false, error: updateErr.message });
        } else {
          results.push({ id: r.id, ok: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        console.error(`coach-response failed for ${r.id}:`, msg);
        results.push({ id: r.id, ok: false, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        coached_count: results.filter((r) => r.ok).length,
        failed_count: results.filter((r) => !r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("coach-response error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
