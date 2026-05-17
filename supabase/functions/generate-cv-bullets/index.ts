// Generate STAR-style Arabic CV bullets from a free-text role description.
// Used by the CV Builder when student types responsibilities and clicks
// "اقترح صياغة احترافية".
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, employer, raw_description, target_role, language = "ar" } = await req.json();
    if (!raw_description?.trim()) throw new Error("raw_description is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys =
      language === "ar"
        ? `أنت كاتب محترف لسير ذاتية للقطاع الحكومي السعودي. حوّل وصف الطالب إلى نقاط (bullets) قوية بصياغة CAR/STAR موجزة (إجراء + سياق + نتيجة قابلة للقياس عند الإمكان). اللغة عربية فصحى، الجمل قصيرة، تبدأ بفعل، تحتوي رقماً عند الإمكان. تجنّب الحشو والصفات المبهمة.`
        : `You are a professional Saudi public-sector CV writer. Turn the student's description into strong bullets using the CAR/STAR pattern (action + context + measurable result when possible). Use concise English starting with a verb, include a number when possible, avoid filler adjectives.`;

    const user =
      language === "ar"
        ? `المسمى الوظيفي: ${title || "—"}\nجهة العمل: ${employer || "—"}${target_role ? `\nالوظيفة المستهدفة: ${target_role}` : ""}\n\nوصف الطالب:\n${raw_description}\n\nأنتج 3 نسخ بديلة لكل نقطة جوهرية (من 3 إلى 5 نقاط جوهرية).`
        : `Job title: ${title || "—"}\nEmployer: ${employer || "—"}${target_role ? `\nTarget role: ${target_role}` : ""}\n\nStudent description:\n${raw_description}\n\nProduce 3 alternative variants for each core bullet (3-5 core bullets).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "cv_bullets",
              parameters: {
                type: "object",
                properties: {
                  bullets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        theme: { type: "string", description: "موضوع النقطة بكلمة أو اثنتين" },
                        variants: {
                          type: "array",
                          items: { type: "string" },
                          description: "3 صيغ بديلة لنفس النقطة",
                        },
                      },
                      required: ["theme", "variants"],
                    },
                  },
                  summary_line: {
                    type: "string",
                    description: "سطر ملخّص مقترح لقسم الملخص الشخصي (Summary)",
                  },
                },
                required: ["bullets"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "cv_bullets" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("generate-cv-bullets error", res.status, t);
      throw new Error("AI gateway error");
    }

    const data = await res.json();
    const tool = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tool?.function?.arguments) throw new Error("No bullets returned");

    return new Response(JSON.stringify(JSON.parse(tool.function.arguments)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-cv-bullets error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
