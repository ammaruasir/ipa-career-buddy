// P0.4-AI: improve-cv-summary
// Polishes (or generates) the CV summary section with bilingual output + justifications.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse, safeParseJson } from "../_shared/guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RULES_AR = `قواعد الـ Summary الإلزامية:
- ٣-٥ جمل، لا أكثر.
- الافتتاح: المهنة + سنوات الخبرة + التخصّص.
- الوسط: ٢-٣ إنجازات مميِّزة مع أرقام.
- الختام: الهدف المهني بإيجاز (ليس قائمة أمنيات).
- لا قائمة صفات شخصية ("شغوف"، "محترف"، "موجَّه نحو الفريق") بدون دليل.
- لا "أبحث عن وظيفة تتيح لي..." — هذه قاتل للسيرة.
- لا ضمير "أنا" مباشرة في البداية.
- عربية فصحى رسمية.
- تواضع مهني سعودي — تجنّب الترويج العدواني.`;

const RULES_EN = `Summary mandatory rules:
- 3-5 sentences, no more.
- Opening: profession + years of experience + specialization.
- Middle: 2-3 distinguishing achievements with numbers.
- Closing: career objective, briefly (not a wish list).
- No list of personal adjectives ("passionate", "professional", "team-oriented") without evidence.
- No "Seeking a role that allows me to..." — this kills a CV.
- No leading "I" pronoun.
- American English unless target is UK.
- Professional humility — avoid aggressive self-promotion.`;

const SYSTEM_BASE = `أنت مدرّب سير ذاتية محترف لمعهد الإدارة العامة (IPA) في السعودية.
You are a professional CV coach for Saudi Arabia's Institute of Public Administration (IPA).

مهمّتك: تحسين أو توليد ملخّص السيرة الذاتية.
Task: Improve or generate a CV summary.

لكل نسخة، قدّم justifications تشرح القرارات الكتابية للمستخدم ليتعلّم.
For each version, provide justifications explaining writing decisions so the user learns.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_summary",
    description: "Return improved CV summary with justifications",
    parameters: {
      type: "object",
      properties: {
        ar: {
          type: ["object", "null"],
          properties: {
            improved: { type: "string" },
            sentence_count: { type: "number" },
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
          },
          required: ["improved", "sentence_count", "justifications"],
          additionalProperties: false,
        },
        en: {
          type: ["object", "null"],
          properties: {
            improved: { type: "string" },
            sentence_count: { type: "number" },
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
          },
          required: ["improved", "sentence_count", "justifications"],
          additionalProperties: false,
        },
      },
      required: [],
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

function sanitizeForPrompt(text: string): string {
  return (text || "")
    .replace(/ignore (all |the )?(previous|above) instructions?/gi, "[blocked]")
    .replace(/تجاهل (كل )?(التعليمات|التوجيهات)( السابقة)?/g, "[محظور]")
    .replace(/system:?\s*/gi, "")
    .replace(/<\|.*?\|>/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // SECURITY: require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(adminClient, user.id, "cv_summary", 10, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    const body = await req.json();
    const currentSummary: string = sanitizeForPrompt(body.current_summary ?? "");
    const fullProfile: any = body.full_profile ?? {};
    const targetRole: string = body.target_role ?? "";
    const language: "ar" | "en" | "bilingual" = body.language ?? "ar";

    const { apiKey, apiUrl, model } = pickProvider();

    const languageInstruction =
      language === "ar"
        ? `${RULES_AR}\n\nأرجع ar فقط، اترك en = null.`
        : language === "en"
        ? `${RULES_EN}\n\nReturn en only, leave ar = null.`
        : `${RULES_AR}\n\n${RULES_EN}\n\nReturn BOTH ar and en. Each language's content must be natively phrased, not translated.`;

    const userContent = `
الملخّص الحالي / Current summary:
${currentSummary || "(فارغ / empty — توليد كامل / generate from scratch)"}

الوظيفة المستهدفة / Target role: ${targetRole || "(غير محدّد / unspecified)"}

بيانات الملف الشخصي / Profile data:
${JSON.stringify(fullProfile, null, 2).slice(0, 3000)}

اكتب الملخّص المحسَّن متّبعاً القواعد بدقّة.
Write the improved summary strictly following the rules.
`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${SYSTEM_BASE}\n\n${languageInstruction}` },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_summary" } },
        stream: false,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // Validate sentence count constraint
    const checkLength = (v?: { improved: string; sentence_count: number }) => {
      if (!v) return;
      if (v.sentence_count > 5) {
        console.warn(`Summary exceeds 5 sentences (${v.sentence_count})`);
      }
    };
    checkLength(parsed.ar);
    checkLength(parsed.en);

    return new Response(
      JSON.stringify({
        ...parsed,
        model,
        tokens_used: data.usage?.total_tokens ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("improve-cv-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
