// P1.3 — CV ↔ Interview-answers alignment.
// Reads a completed interview's responses + the student's latest cv_documents
// and returns a comparison showing CV claims unused in answers + answer
// evidence missing from CV.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interview_id } = await req.json();
    if (!interview_id) throw new Error("interview_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: interview } = await supabase
      .from("interviews")
      .select("user_id, job_position")
      .eq("id", interview_id)
      .single();
    if (!interview) throw new Error("Interview not found");

    const [{ data: responses }, { data: cv }] = await Promise.all([
      supabase
        .from("responses")
        .select("question_text, answer_text")
        .eq("interview_id", interview_id)
        .order("created_at"),
      supabase
        .from("cv_documents")
        .select("parsed")
        .eq("user_id", interview.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!cv?.parsed) {
      return new Response(
        JSON.stringify({ error: "لا توجد سيرة ذاتية معتمدة لمحاذاتها" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const transcript = (responses || [])
      .map((r: any, i: number) => `سؤال ${i + 1}: ${r.question_text}\nإجابة: ${r.answer_text || ""}`)
      .join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `أنت مدرّب مهني. قارن بين السيرة الذاتية للمتدرّب وإجاباته في المقابلة. هدفك: مساعدته على إدراك:
(1) ادعاءات في السيرة لم يدعمها بإجابات أو أمثلة.
(2) مهارات/إنجازات أظهرها في الإجابات لكنها غير مذكورة في سيرته.
(3) تناقضات إن وُجدت.`,
          },
          {
            role: "user",
            content: `السيرة الذاتية (JSON):\n${JSON.stringify(cv.parsed)}\n\nنص المقابلة:\n${transcript}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "alignment_report",
              parameters: {
                type: "object",
                properties: {
                  cv_claims_unused: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        claim: { type: "string" },
                        suggestion_ar: { type: "string" },
                      },
                      required: ["claim", "suggestion_ar"],
                    },
                  },
                  answer_evidence_missing_from_cv: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        evidence: { type: "string" },
                        suggestion_ar: { type: "string" },
                      },
                      required: ["evidence", "suggestion_ar"],
                    },
                  },
                  contradictions: {
                    type: "array",
                    items: { type: "string" },
                  },
                  overall_alignment_score: { type: "number", description: "0-100" },
                },
                required: ["cv_claims_unused", "answer_evidence_missing_from_cv", "overall_alignment_score"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "alignment_report" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("cv-job-alignment error", res.status, t);
      throw new Error("AI gateway error");
    }

    const data = await res.json();
    const tool = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tool?.function?.arguments) throw new Error("No alignment report");

    return new Response(JSON.stringify(JSON.parse(tool.function.arguments)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cv-job-alignment error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
