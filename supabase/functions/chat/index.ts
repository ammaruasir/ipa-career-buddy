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
    const { messages, job_position, interview_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // If job_position provided, fetch question templates from DB to include in system prompt
    let questionBankPrompt = "";
    if (job_position && interview_type) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: questions } = await supabase
        .from("question_templates")
        .select("question_text, category, difficulty")
        .eq("interview_type", interview_type)
        .order("created_at", { ascending: true });

      if (questions && questions.length > 0) {
        const qList = questions
          .map((q: any, i: number) => `${i + 1}. [${q.category}/${q.difficulty}] ${q.question_text}`)
          .join("\n");
        questionBankPrompt = `\n\nبنك الأسئلة المتوفر (يجب عليك استخدام هذه الأسئلة بالترتيب بدلاً من توليد أسئلة عشوائية):\n${qList}\n\nاستخدم الأسئلة أعلاه بالترتيب. إذا كان عدد الأسئلة في البنك أقل من المطلوب، أكمل بأسئلة من عندك.`;
      }

      // Fetch AI model from settings
      const { data: settingsData } = await supabase
        .from("system_settings")
        .select("ai_model")
        .limit(1)
        .single();

      const aiModel = settingsData?.ai_model || "google/gemini-3-flash-preview";

      // Inject question bank into the first system message if present
      const enrichedMessages = questionBankPrompt
        ? messages.map((m: any, i: number) => {
            if (i === 0 && m.role === "system") {
              return { ...m, content: m.content + questionBankPrompt };
            }
            return m;
          })
        : messages;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: enrichedMessages,
          stream: false,
        }),
      });

      if (!response.ok) {
        return handleAIError(response);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: no job_position, just pass messages through
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      return handleAIError(response);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleAIError(response: Response) {
  if (response.status === 429) {
    return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (response.status === 402) {
    return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }), {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const t = await response.text();
  console.error("AI gateway error:", response.status, t);
  return new Response(JSON.stringify({ error: "خطأ في الذكاء الاصطناعي" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
