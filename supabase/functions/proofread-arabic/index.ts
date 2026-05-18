// proofread-arabic: Arabic spelling + light grammar correction
// Returns auto_corrected_text (single-option fixes applied) + corrections[] with multi-option ambiguities.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse, safeParseJson } from "../_shared/guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مدقّق لغوي عربي محترف. مهمّتك تصحيح الأخطاء الإملائية والنحوية الأساسية فقط.

قواعد صارمة:
1) صحّح الإملاء فقط: الهمزات (أ، إ، ء، ؤ، ئ)، التاء المربوطة والمفتوحة، الألف المقصورة والممدودة، اللام الشمسية/القمرية، الأخطاء المطبعية الواضحة.
2) صحّح النحو الأساسي فقط: وصل/فصل واو العطف، التنوين، تذكير/تأنيث الأفعال والصفات، الفاعل/المفعول البديهي.
3) **لا تُعِد صياغة الأسلوب**. لا تُغيّر اختيار الكلمات. لا تُحسّن البلاغة. لا تُضيف أو تحذف معلومات.
4) أسماء الأعلام والعلامات التجارية والمدن والأشخاص: لا تُغيّرها أبداً.
5) النصوص الإنجليزية أو الأرقام أو الرموز: تجاهلها كلياً.
6) إذا كان التصحيح بديهياً ووحيداً (مثل "مهندث" → "مهندس")، ضعه في options كعنصر واحد.
7) إذا تعدّدت الاحتمالات الصحيحة (مثل "تطوير و إدارة" قد تكون "تطوير وإدارة" أو "تطوير، وإدارة")، اذكرها كلها في options.
8) إذا كان النص سليماً تماماً، أرجِع needs_correction=false وقائمة corrections فارغة.
9) لا تُصلح أكثر من ٨ أخطاء في الاستدعاء الواحد — اختر الأهم.

أرجع النتيجة عبر الـ tool فقط.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_proofread",
    description: "Return the proofread Arabic text with corrections",
    parameters: {
      type: "object",
      properties: {
        needs_correction: { type: "boolean" },
        auto_corrected_text: {
          type: "string",
          description: "The text with all single-option (unambiguous) corrections applied. If no corrections, return the original text unchanged.",
        },
        corrections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              original: { type: "string", description: "The exact substring from the input" },
              options: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                description: "One option = auto-applied. Multiple = user chooses.",
              },
              type: { type: "string", enum: ["spelling", "grammar", "punctuation"] },
              explanation: { type: "string", description: "Short Arabic explanation (≤ 12 words)" },
            },
            required: ["original", "options", "type", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["needs_correction", "auto_corrected_text", "corrections"],
      additionalProperties: false,
    },
  },
};

function pickProvider() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    return {
      apiKey: LOVABLE_API_KEY,
      apiUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "google/gemini-2.5-flash-lite",
    };
  }
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (OPENAI_API_KEY) {
    return {
      apiKey: OPENAI_API_KEY,
      apiUrl: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4.1-mini",
    };
  }
  throw new Error("No AI provider configured");
}

// Skip texts that obviously don't need proofreading
function shouldSkip(text: string, context: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  // Mostly non-Arabic? Skip.
  const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) ?? []).length;
  if (arabicChars / trimmed.length < 0.4) return true;
  // Names: be very conservative — skip short names
  if (context === "name" && trimmed.split(/\s+/).length <= 4) return true;
  return false;
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? "").toString();
    const context: string = (body?.context ?? "general").toString();

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ needs_correction: false, auto_corrected_text: text, corrections: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (shouldSkip(text, context)) {
      return new Response(
        JSON.stringify({ needs_correction: false, auto_corrected_text: text, corrections: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap input size
    const capped = text.slice(0, 4000);

    // Rate limit: generous — 60/min (fields can be many)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(admin, user.id, "ar_proofread", 60, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    const { apiKey, apiUrl, model } = pickProvider();

    const userContent = `سياق الحقل: ${context}
النص:
"""
${capped}
"""

دقّق النص وأرجع النتيجة عبر الـ tool.`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_proofread" } },
        stream: false,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("proofread AI error:", resp.status, t);
      // Silent failure: return text unchanged
      return new Response(
        JSON.stringify({ needs_correction: false, auto_corrected_text: text, corrections: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = safeParseJson<any>(toolCall?.function?.arguments);
    if (!parsed) {
      return new Response(
        JSON.stringify({ needs_correction: false, auto_corrected_text: text, corrections: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize: ensure auto_corrected_text falls back to original if missing
    const result = {
      needs_correction: !!parsed.needs_correction,
      auto_corrected_text: typeof parsed.auto_corrected_text === "string"
        ? parsed.auto_corrected_text
        : text,
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("proofread-arabic error:", e);
    // Silent failure: return text unchanged so UI doesn't break
    const body = await req.json().catch(() => ({}));
    return new Response(
      JSON.stringify({
        needs_correction: false,
        auto_corrected_text: body?.text ?? "",
        corrections: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
