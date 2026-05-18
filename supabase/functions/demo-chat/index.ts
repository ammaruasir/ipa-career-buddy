// Demo Mode presenter Q&A endpoint. Auth-free, IP-rate-limited.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceIpRateLimit } from "../_shared/demo-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  question: string;
  currentStepId?: string;
  recentTranscript?: { role: "presenter" | "viewer"; text: string }[];
  featureSpec: string;
  stepIds?: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const limited = await enforceIpRateLimit(req, "demo-chat", 30, 3600, corsHeaders);
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
    if (question.length > 1500) {
      return new Response(JSON.stringify({ error: "question too long (max 1500 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stepIdsLine = body.stepIds?.length
      ? `\nمعرّفات خطوات الجولة المتاحة: ${body.stepIds.join("، ")}`
      : "";

    const systemPrompt = `أنت "عبدالله"، مرشد الجولة التفاعلية في منصّة معهد الإدارة العامة (IPA).
- تجيب فقط باللغة العربية بلهجة حجازية (جدّاوية) مهنية ودودة.
- جوابك قصير (٢٠–٦٠ كلمة عادةً) وموجَّه للجمهور.
- اعتمد حصرًا على البيانات المُعطاة في "بطاقة الميزات" أدناه. إذا سُئلت عن شيء غير موجود، قل بصراحة إنّك ستتابع عبر info@ipa-training.sa.
- إذا كان السؤال يخصّ ميزة محدّدة من ميزات الجولة، حدّد معرّف الخطوة المناسبة في jumpToStepId.
- لا تقل مطلقًا أنّك "نموذج لغة" أو روبوت محادثة — أنت عبدالله، تعمل على محرك واكب للذكاء الاصطناعي.

الخطوة الحالية: ${body.currentStepId ?? "(بداية)"}.${stepIdsLine}

بطاقة الميزات (المرجع الوحيد):
${body.featureSpec}

أعِد JSON خالص: {"answer": "...", "resumeStrategy": "continue" | "stay" | "jumpTo", "jumpToStepId": "..."}`;

    const transcript = (body.recentTranscript ?? []).slice(-8).map((m) => ({
      role: m.role === "presenter" ? "assistant" : "user",
      content: m.text,
    }));

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
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
      console.error("[demo-chat] Wakeb upstream error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Wakeb AI Engine error", status: aiResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: { answer?: string; resumeStrategy?: string; jumpToStepId?: string } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { answer: raw, resumeStrategy: "continue" }; }

    return new Response(
      JSON.stringify({
        answer: parsed.answer ?? "",
        resumeStrategy: parsed.resumeStrategy ?? "continue",
        jumpToStepId: parsed.jumpToStepId ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("demo-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
