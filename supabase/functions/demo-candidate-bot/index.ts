// Generates "سارة" answer to interviewer/CV-chat questions. Persona-grounded,
// STAR-aware, Arabic-only. Auth-free, IP-rate-limited.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceIpRateLimit } from "../_shared/demo-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  question: string;
  history?: { q: string; a: string }[];
  context: "cv_chat" | "practice_interview" | "assessment_interview";
  questionIndex: number;
  totalQuestions: number;
  persona: unknown;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const limited = await enforceIpRateLimit(req, "demo-candidate-bot", 60, 3600, corsHeaders);
    if (limited) return limited;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const body = (await req.json()) as Body;
    const question = (body.question ?? "").trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "missing question" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextLabel = {
      cv_chat: "بناء سيرة ذاتية بالمحادثة (١٥ سؤال)",
      practice_interview: "مقابلة تدريبية آمنة للفشل",
      assessment_interview: "مقابلة تقييمية رسمية لوظيفة حقيقية",
    }[body.context];

    const useStar = body.context === "practice_interview" || body.context === "assessment_interview";
    const styleGuide = useStar
      ? "استخدمي صيغة STAR (الموقف، المهمّة، الإجراء، النتيجة) عند الإجابة على أسئلة سلوكية. الجواب ٦٠–١٤٠ كلمة."
      : "إجابات مختصرة طبيعية، ٢٠–٧٠ كلمة، وكأنّك تجيبين في محادثة بناء سيرة ذاتية ودودة.";

    const systemPrompt = `أنتِ تلعبين دور المرشّحة "سارة الراشد" في عرض تجريبي لمنصّة معهد الإدارة العامة.
- تجيبين فقط باللغة العربية، بلهجة سعودية مهنية واثقة.
- لا تذكري أنّك ذكاء اصطناعي — أنتِ سارة.
- الالتزام بشخصية سارة (المهارات، المشاريع، الخلفية) فقط — لا تخترعي خبرات خارج البيانات.
- السياق: ${contextLabel}.
- السؤال ${body.questionIndex} من ${body.totalQuestions}.
- ${styleGuide}

بطاقة شخصية سارة (المرجع الوحيد):
${JSON.stringify(body.persona, null, 2)}

أعيدي JSON خالص: {"answer": "..."}.`;

    const transcript = (body.history ?? []).slice(-6).flatMap((t) => [
      { role: "assistant" as const, content: t.q },
      { role: "user" as const, content: t.a },
    ]);

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...transcript,
          { role: "user", content: question },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[demo-candidate-bot] Wakeb upstream error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Wakeb AI Engine error", status: aiResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: { answer?: string } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { answer: raw }; }

    return new Response(JSON.stringify({ answer: parsed.answer ?? "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("demo-candidate-bot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
