// P0.4-AI: generate-cv-bullets
// Converts a free-form description of an achievement into 1-3 polished STAR bullets.
// Bilingual: returns ar / en / both as requested.
// Returns justifications so the user learns the "why".

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_AR = `أنت مدرّب سير ذاتية محترف لمعهد الإدارة العامة (IPA) في السعودية.

مهمّتك: تحويل وصف حرّ لإنجاز إلى ١-٣ نقاط (bullets) احترافية بصيغة STAR (الموقف، المهمّة، الإجراء، النتيجة).

قواعد إلزامية:
1) ابدأ بفعل قوي بالماضي (قاد، أدار، طوّر، صمّم، حقّق، رفع، خفّض، حسّن، أعاد هيكلة، أطلق، فاوض، درّب، أشرف، حلّل، أتمتم).
2) كمّم كل ما يُقاس (نسبة، عدد، مبلغ، زمن، حجم فريق). إذا لم يذكر المستخدم أرقاماً، اسأل ضمنياً بدلاً من اختلاقها.
3) كل bullet ≤ سطرين.
4) عربية فصحى فقط. لا عامّية، لا ترجمة حرفية من الإنجليزية، لا حشو.
5) بدون ضمائر شخصية (أنا، لي، نفسي).
6) تواضع مهني — لا "أفضل"، "ممتاز"، "استثنائي" بدون دليل.
7) إذا كانت الوظيفة حكومية وأمكن، اربط بـ ركائز رؤية 2030 (التحوّل الرقمي، خدمة المواطن، الكفاءة) بدليل ملموس.

لكل bullet، قدّم justification يشرح لماذا اخترت هذه الصياغة (للتعليم).`;

const SYSTEM_PROMPT_EN = `You are a professional CV coach for Saudi Arabia's Institute of Public Administration (IPA).

Task: Transform a free-form achievement description into 1-3 polished STAR bullets (Situation, Task, Action, Result).

Mandatory rules:
1) Lead with a strong past-tense action verb (Led, Managed, Built, Designed, Implemented, Achieved, Increased, Reduced, Improved, Restructured, Launched, Negotiated, Trained, Supervised, Analyzed, Automated).
2) Quantify everything quantifiable (%, $, #, time, team size). If user didn't provide numbers, ask implicitly rather than inventing.
3) Each bullet ≤ 2 lines.
4) No personal pronouns (I, my, myself).
5) Professional humility — no "best", "excellent", "exceptional" without evidence.
6) For Saudi government roles, where applicable, link to Vision 2030 pillars (Digital Transformation, Citizen Service, Efficiency) with concrete evidence.
7) American English unless target role is UK-based.

For each bullet, provide a justification explaining your phrasing choices (for learning).`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_bullets",
    description: "Return generated CV bullets with justifications",
    parameters: {
      type: "object",
      properties: {
        ar: {
          type: ["object", "null"],
          properties: {
            bullets: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
            },
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
          required: ["bullets", "justifications"],
          additionalProperties: false,
        },
        en: {
          type: ["object", "null"],
          properties: {
            bullets: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
            },
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
          required: ["bullets", "justifications"],
          additionalProperties: false,
        },
        missing_information: {
          type: "array",
          items: { type: "string" },
          description: "Numbers/details the user should add for stronger bullets",
        },
      },
      required: ["missing_information"],
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
  throw new Error("No AI provider configured (LOVABLE_API_KEY or OPENAI_API_KEY)");
}

// SECURITY: sanitize user-controlled text before injecting into prompts
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

    const body = await req.json();
    const role: string = body.role ?? "";
    const raw: string = sanitizeForPrompt(body.raw_description ?? "");
    const language: "ar" | "en" | "bilingual" = body.language ?? "ar";

    if (!raw || raw.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "اكتب وصفاً لا يقل عن ١٠ أحرف / Description must be ≥ 10 chars" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { apiKey, apiUrl, model } = pickProvider();

    // System prompt selection
    let systemContent: string;
    if (language === "ar") {
      systemContent = SYSTEM_PROMPT_AR + "\n\nأرجع ar فقط، اترك en = null.";
    } else if (language === "en") {
      systemContent = SYSTEM_PROMPT_EN + "\n\nReturn en only, leave ar = null.";
    } else {
      systemContent =
        SYSTEM_PROMPT_AR +
        "\n\n---\n\n" +
        SYSTEM_PROMPT_EN +
        "\n\nReturn BOTH ar and en. Same content, language-appropriate phrasing for each.";
    }

    const userContent =
      `الدور المهني / Target role: ${role || "(غير محدّد / unspecified)"}\n\n` +
      `وصف المستخدم / User description:\n${raw.slice(0, 3000)}`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_bullets" } },
        stream: false,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحدّ / Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error("AI gateway error");
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");

    const parsed = JSON.parse(toolCall.function.arguments);

    // Soft validation: ensure bullets are within length limits
    const validateBullets = (bullets?: string[]) =>
      (bullets ?? []).map((b) => {
        const trimmed = b.trim();
        // Soft warn if > 200 chars (likely > 2 lines)
        if (trimmed.length > 200) {
          console.warn(`Bullet exceeds ~2 lines: ${trimmed.slice(0, 60)}...`);
        }
        return trimmed;
      });

    if (parsed.ar) parsed.ar.bullets = validateBullets(parsed.ar.bullets);
    if (parsed.en) parsed.en.bullets = validateBullets(parsed.en.bullets);

    return new Response(
      JSON.stringify({
        ...parsed,
        model,
        tokens_used: data.usage?.total_tokens ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-cv-bullets error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
