// P0.4-AI: chat-with-cv
// Multi-turn chat grounded in an uploaded CV. Returns assistant message + justifications.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse, safeParseJson } from "../_shared/guards.ts";

// SECURITY: strip injection patterns from user-controlled text before LLM
function sanitizeForPrompt(text: string): string {
  return (text || "")
    .replace(/ignore (all |the )?(previous|above) instructions?/gi, "[blocked]")
    .replace(/تجاهل (كل )?(التعليمات|التوجيهات)( السابقة)?/g, "[محظور]")
    .replace(/system:?\s*/gi, "")
    .replace(/<\|.*?\|>/g, "");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_AR = `أنت مدرّب سير ذاتية صبور لمعهد الإدارة العامة (IPA) في السعودية.
المستخدم يسألك أسئلة حول سيرته الذاتية. هدفك تعليمي قبل كل شيء.

قواعد:
1) كل ملاحظة أو نصيحة يجب أن ترفقها بـ justification (لماذا).
2) استشهد بأمثلة حرفية من السيرة كلّما أمكن.
3) لا تعطي الإجابة الكاملة فوراً — اشرح المنطق، ثم اقترح خطوة.
4) عربية فصحى رسمية. تجنّب العامّية.
5) تواضع مهني سعودي — لا تشجّع على المبالغة.
6) إذا اقترحت إعادة كتابة، اعرض النسختين (الأصلي + المحسَّن) واشرح الفرق.

عند الإجابة، استخدم الـ tool لتنظيم: رسالة محادثة + قائمة justifications منفصلة.`;

const SYSTEM_PROMPT_EN = `You are a patient CV coach for Saudi Arabia's Institute of Public Administration (IPA).
The user is asking questions about their CV. Your goal is educational above all.

Rules:
1) Every observation or tip must include a justification (the why).
2) Quote literal examples from the CV whenever possible.
3) Don't give the complete answer immediately — explain the reasoning, then propose a step.
4) Professional American English.
5) Saudi professional humility — don't encourage exaggeration.
6) When suggesting a rewrite, show both versions (original + improved) and explain the difference.

When responding, use the tool to organize: a conversation message + a separate list of justifications.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "chat_response",
    description: "Conversational response with separated justifications",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The conversational reply to show to the user" },
        justifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              observation: { type: "string" },
              rule: { type: "string" },
              why_it_matters: { type: "string" },
              example_better: { type: "string" },
              severity: { type: "string", enum: ["info", "warning", "important"] },
            },
            required: ["observation", "rule", "why_it_matters", "example_better", "severity"],
            additionalProperties: false,
          },
        },
        suggested_actions: {
          type: "array",
          items: { type: "string" },
          description: "Concrete next steps the user can take",
        },
      },
      required: ["message", "justifications", "suggested_actions"],
      additionalProperties: false,
    },
  },
};

function pickProvider() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (LOVABLE_API_KEY) {
    return {
      apiKey: LOVABLE_API_KEY,
      apiUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "google/gemini-2.5-flash",
    };
  }
  if (OPENAI_API_KEY) {
    return {
      apiKey: OPENAI_API_KEY,
      apiUrl: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4.1-mini",
    };
  }
  throw new Error("No AI provider configured");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const cvDocumentId: string | undefined = body.cv_document_id;
    let conversationId: string | undefined = body.conversation_id;
    const userMessage: string = sanitizeForPrompt(body.message ?? "");
    const language: "ar" | "en" | "bilingual" = body.language ?? "ar";

    if (!userMessage.trim()) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: chat is interactive; 15/min is generous but prevents spam loops
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(adminClient, user.id, "cv_chat", 15, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    // Load CV grounding (the extraction + evaluation snapshot)
    let cvGrounding = "";
    if (cvDocumentId) {
      const { data: cvDoc } = await supabase
        .from("cv_documents")
        .select("extraction, section_scores, weaknesses, rewrites, saudi_compliance, file_name")
        .eq("id", cvDocumentId)
        .eq("user_id", user.id)
        .single();

      if (cvDoc) {
        cvGrounding = `
السيرة المرفوعة / The user's uploaded CV (analysis):
${JSON.stringify(cvDoc, null, 2).slice(0, 5000)}
`;
      }
    }

    // Load or create conversation
    let conversation: any;
    if (conversationId) {
      const { data } = await supabase
        .from("cv_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();
      conversation = data;
    }

    if (!conversation) {
      const { data: created, error: createErr } = await supabase
        .from("cv_conversations")
        .insert({
          user_id: user.id,
          cv_document_id: cvDocumentId ?? null,
          language,
          messages: [],
        })
        .select()
        .single();
      if (createErr) throw new Error(`Conversation create failed: ${createErr.message}`);
      conversation = created;
      conversationId = created.id;
    }

    const history: any[] = (conversation.messages as any[]) ?? [];

    // Append user message
    history.push({
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    });

    // Compose LLM messages
    const systemPrompt =
      (language === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_AR) +
      "\n\n" +
      cvGrounding;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-12).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const { apiKey, apiUrl, model } = pickProvider();

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: llmMessages,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "chat_response" } },
        stream: false,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      throw new Error("AI gateway error");
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output");

    const parsed = safeParseJson<any>(toolCall.function.arguments);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "AI output unparseable — retry" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Append assistant message with justifications
    const assistantMessage = {
      role: "assistant",
      content: parsed.message,
      justifications: parsed.justifications ?? [],
      suggested_actions: parsed.suggested_actions ?? [],
      created_at: new Date().toISOString(),
    };
    history.push(assistantMessage);

    // Persist
    await supabase
      .from("cv_conversations")
      .update({
        messages: history,
        last_message_at: new Date().toISOString(),
        total_messages: history.length,
        total_tokens: (conversation.total_tokens ?? 0) + (data.usage?.total_tokens ?? 0),
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        conversation_id: conversationId,
        message: assistantMessage,
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chat-with-cv error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
