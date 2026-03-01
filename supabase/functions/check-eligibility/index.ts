import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { resume_skills, requirements, job_title } = await req.json();

    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
      return new Response(JSON.stringify({ eligible: true, match_percentage: 100, message: "لا توجد متطلبات محددة لهذه الوظيفة" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `أنت نظام فحص أهلية المتقدمين (ATS). قارن بين مهارات المتقدم ومتطلبات الوظيفة.

الوظيفة: ${job_title || "غير محدد"}

متطلبات الوظيفة:
${requirements.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}

بيانات المتقدم من السيرة الذاتية:
${resume_skills && Object.keys(resume_skills).length > 0 ? JSON.stringify(resume_skills, null, 2) : "لم يتم تحليل السيرة الذاتية بعد"}

قم بتحليل مدى تطابق المتقدم مع المتطلبات وأرجع النتيجة.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت نظام ATS لتقييم أهلية المتقدمين. أجب دائماً باستخدام الأداة المحددة." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "eligibility_result",
              description: "Return the eligibility check result",
              parameters: {
                type: "object",
                properties: {
                  match_percentage: { type: "number", description: "نسبة التطابق من 0 إلى 100" },
                  matched_skills: { type: "array", items: { type: "string" }, description: "المهارات المتطابقة" },
                  missing_skills: { type: "array", items: { type: "string" }, description: "المهارات الناقصة" },
                  summary: { type: "string", description: "ملخص قصير بالعربية عن مدى ملاءمة المتقدم" },
                },
                required: ["match_percentage", "matched_skills", "missing_skills", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "eligibility_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى شحن رصيد الذكاء الاصطناعي" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ eligible: true, match_percentage: 70, message: "تعذر إجراء التحليل الكامل" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    const eligible = result.match_percentage >= 40;

    return new Response(JSON.stringify({
      eligible,
      match_percentage: result.match_percentage,
      matched_skills: result.matched_skills || [],
      missing_skills: result.missing_skills || [],
      summary: result.summary || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-eligibility error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
