// On-demand per-response coaching. Use from InterviewResults when a
// student clicks "اشرح إجابتي". Re-runs the STAR coaching for a single
// response and writes it back to responses.coaching.
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
    const { response_id } = await req.json();
    if (!response_id) throw new Error("response_id is required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: r, error } = await supabase
      .from("responses")
      .select("id, question_text, answer_text, interview_id")
      .eq("id", response_id)
      .single();
    if (error || !r) throw new Error("Response not found");

    const { data: interview } = await supabase
      .from("interviews")
      .select("job_position")
      .eq("id", r.interview_id)
      .single();

    const { data: settings } = await supabase
      .from("system_settings")
      .select("filler_words")
      .limit(1)
      .single();

    const fillerPatterns: string[] = (settings?.filler_words as any) || [
      "ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة",
    ];
    const answer = r.answer_text || "";

    const fillerMarks: { word: string; offset: number }[] = [];
    for (const w of fillerPatterns) {
      const re = new RegExp(w, "g");
      let m;
      while ((m = re.exec(answer)) !== null) {
        fillerMarks.push({ word: w, offset: m.index });
      }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `أنت مدرّب مقابلات وظيفية للقطاع الحكومي السعودي. قيّم إجابة الطالب وفق منهج STAR وقدّم تغذية راجعة تعليمية.`,
          },
          {
            role: "user",
            content: `الوظيفة: ${interview?.job_position || ""}\n\nالسؤال: ${r.question_text}\n\nإجابة الطالب:\n${answer}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "coach_answer",
              description: "Return STAR coaching",
              parameters: {
                type: "object",
                properties: {
                  star: {
                    type: "object",
                    properties: {
                      s: { type: "number" },
                      t: { type: "number" },
                      a: { type: "number" },
                      r: { type: "number" },
                    },
                    required: ["s", "t", "a", "r"],
                  },
                  coverage_score: { type: "number" },
                  rewrite_ar: { type: "string" },
                  exemplar_ar: { type: "string" },
                  tips: { type: "array", items: { type: "string" } },
                  strengths_in_answer: { type: "array", items: { type: "string" } },
                },
                required: ["star", "coverage_score", "rewrite_ar", "exemplar_ar", "tips"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "coach_answer" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("coach-response AI error", res.status, t);
      throw new Error("AI coaching failed");
    }

    const data = await res.json();
    const tool = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tool?.function?.arguments) throw new Error("No coaching returned");

    const parsed = JSON.parse(tool.function.arguments);
    const coaching = { ...parsed, filler_marks: fillerMarks };

    await supabase.from("responses").update({ coaching }).eq("id", response_id);

    return new Response(JSON.stringify({ success: true, coaching }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-response error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
