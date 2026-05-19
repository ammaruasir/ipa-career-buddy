// Streaming CV coach chat — AI SDK + Lovable AI Gateway.
// Replaces the old non-streaming chat-with-cv (which hit 504 IDLE_TIMEOUT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "npm:ai";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "*",
};

function sanitizeForPrompt(text: string): string {
  return (text || "")
    .replace(/ignore (all |the )?(previous|above) instructions?/gi, "[blocked]")
    .replace(/تجاهل (كل )?(التعليمات|التوجيهات)( السابقة)?/g, "[محظور]")
    .replace(/system:?\s*/gi, "")
    .replace(/<\|.*?\|>/g, "");
}

const SYSTEM_AR = `أنت "واكب AI"، مدرّب سير ذاتية صبور وودود لمعهد الإدارة العامة (IPA) في السعودية.
المستخدم يسألك أسئلة حول سيرته الذاتية. هدفك تعليمي قبل كل شيء.

التزم بهذه القواعد:
1) عربية فصحى رسمية واضحة — تجنّب العامّية.
2) كل ملاحظة أو نصيحة يجب أن ترفقها بسبب واضح (لماذا).
3) استشهد بأمثلة حرفية من السيرة كلّما أمكن (بين علامتي اقتباس).
4) إذا اقترحت إعادة كتابة جملة موجودة، اعرض الأصلي ثم البديل في تنسيق Markdown واضح.
5) استخدم Markdown: قوائم، **عريض**، \`code\` عند الحاجة.
6) تواضع مهني سعودي — لا تشجّع المبالغة.
7) ردود مركّزة (٣–٦ فقرات قصيرة كحدّ أقصى ما لم يُطلب التفصيل).`;

const SYSTEM_EN = `You are "Wakeb AI", a patient and friendly CV coach for Saudi Arabia's Institute of Public Administration (IPA).
The user asks questions about their CV. Your goal is educational above all.

Rules:
1) Professional clear English.
2) Every observation must include a clear reason (the why).
3) Quote literal examples from the CV when possible.
4) When suggesting a rewrite, show the original then the improved version in clear Markdown.
5) Use Markdown: lists, **bold**, \`code\` when useful.
6) Saudi professional humility — don't encourage exaggeration.
7) Keep replies focused (max 3–6 short paragraphs unless detail is requested).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!Array.isArray(body?.messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: UIMessage[] = body.messages;
    const cvDocumentId: string | undefined = body.cv_document_id;
    const language: "ar" | "en" = body.language === "en" ? "en" : "ar";

    // Rate limit (15/min)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(adminClient, user.id, "cv_chat", 15, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    // Sanitize user-supplied text parts
    for (const m of messages) {
      if (m.role === "user" && Array.isArray((m as any).parts)) {
        for (const p of (m as any).parts) {
          if (p?.type === "text" && typeof p.text === "string") {
            p.text = sanitizeForPrompt(p.text);
          }
        }
      }
    }

    // Load CV grounding (compact)
    let cvGrounding = "";
    if (cvDocumentId) {
      const { data: cvDoc } = await supabase
        .from("cv_documents")
        .select("extraction, section_scores, weaknesses, saudi_compliance, file_name")
        .eq("id", cvDocumentId)
        .eq("user_id", user.id)
        .single();

      if (cvDoc) {
        cvGrounding =
          "\n\n=== السيرة الذاتية للمستخدم (تحليل مُلخّص) ===\n" +
          JSON.stringify(cvDoc, null, 2).slice(0, 4000);
      }
    }

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const model = gateway("google/gemini-2.5-flash");

    const system =
      (language === "en" ? SYSTEM_EN : SYSTEM_AR) + cvGrounding;

    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
    });

    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
      onError: (err) => {
        console.error("stream error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429")) {
          return language === "en"
            ? "Rate limit reached. Please wait a moment."
            : "تم تجاوز الحدّ. يرجى الانتظار لحظة.";
        }
        if (msg.includes("402")) {
          return language === "en"
            ? "AI credits exhausted. Please contact support."
            : "نفدت رصيد الذكاء الاصطناعي. يرجى التواصل مع الدعم.";
        }
        return language === "en"
          ? "Something went wrong. Please try again."
          : "حدث خطأ. حاول مرّة أخرى.";
      },
    });
  } catch (e) {
    console.error("cv-chat-stream fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
