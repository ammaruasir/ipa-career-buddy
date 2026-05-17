// P0.4-AI: suggest-cv-skills
// Suggests skill groupings based on experience + education + target role.
// Bilingual; returns rationale per skill so user can decide what to keep.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_BASE = `أنت مدرّب سير ذاتية محترف لمعهد الإدارة العامة (IPA) في السعودية.
You are a professional CV coach for Saudi Arabia's Institute of Public Administration (IPA).

مهمّتك: اقتراح مهارات منظَّمة بناءً على خبرة المستخدم وتعليمه والوظيفة المستهدفة.
Task: Suggest organized skills based on user's experience, education, and target role.

قواعد إلزامية / Mandatory rules:
1) مجموعات منطقية فقط: technical / soft / languages
2) ٥-١٠ لكل مجموعة. لا قائمة طويلة عشوائية. / 5-10 per group. No random long lists.
3) مرتّبة حسب الأهمية للوظيفة المستهدفة. / Sorted by relevance to target role.
4) لا تكرار. لا تخمين مهارات لم يَذكرها المستخدم في الخبرات. / No duplicates. Don't invent skills not implied by user's experience.
5) للّغات: استخدم CEFR (A1-C2) أو "أمّ / طلاقة / متوسّط / مبتدئ". / Languages use CEFR or proficiency labels.
6) لكل مهارة، rationale: لماذا اقترحتها (مصدر في الخبرة + ملاءمة الوظيفة). / Each skill needs a rationale (source in experience + role fit).

شرط: لا تضع buzzwords فارغة ("Synergy"، "Agile mindset" بدون مشروع). / No empty buzzwords without project evidence.`;

const SKILL_OBJECT = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    proficiency: { type: "string", description: "beginner / intermediate / advanced / expert OR CEFR for languages" },
    rationale: { type: "string", description: "لماذا اقتُرحت / why suggested" },
  },
  required: ["name", "rationale"],
  additionalProperties: false,
};

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_skills",
    description: "Return suggested skills with rationale",
    parameters: {
      type: "object",
      properties: {
        ar: {
          type: ["object", "null"],
          properties: {
            technical: { type: "array", items: SKILL_OBJECT, maxItems: 10 },
            soft: { type: "array", items: SKILL_OBJECT, maxItems: 10 },
            languages: { type: "array", items: SKILL_OBJECT, maxItems: 6 },
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
          required: ["technical", "soft", "languages", "justifications"],
          additionalProperties: false,
        },
        en: {
          type: ["object", "null"],
          properties: {
            technical: { type: "array", items: SKILL_OBJECT, maxItems: 10 },
            soft: { type: "array", items: SKILL_OBJECT, maxItems: 10 },
            languages: { type: "array", items: SKILL_OBJECT, maxItems: 6 },
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
          required: ["technical", "soft", "languages", "justifications"],
          additionalProperties: false,
        },
        gaps: {
          type: "array",
          items: { type: "string" },
          description: "Skills the user is missing for the target role / مهارات ينقصها المستخدم للوظيفة",
        },
      },
      required: ["gaps"],
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
    const experience: any[] = body.experience ?? [];
    const education: any[] = body.education ?? [];
    const targetRole: string = body.target_role ?? "";
    const language: "ar" | "en" | "bilingual" = body.language ?? "ar";

    const { apiKey, apiUrl, model } = pickProvider();

    const languageInstruction =
      language === "ar"
        ? "أرجع ar فقط، اترك en = null."
        : language === "en"
        ? "Return en only, leave ar = null."
        : "Return BOTH ar and en with locally-appropriate skill names.";

    const userContent = `
الخبرات / Experience:
${JSON.stringify(experience, null, 2).slice(0, 3000)}

التعليم / Education:
${JSON.stringify(education, null, 2).slice(0, 1500)}

الوظيفة المستهدفة / Target role: ${targetRole || "(غير محدّد / unspecified)"}

اقترح مهارات منظَّمة. ${languageInstruction}
Suggest organized skills. ${languageInstruction}
`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_BASE },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_skills" } },
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

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        ...parsed,
        model,
        tokens_used: data.usage?.total_tokens ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-cv-skills error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
