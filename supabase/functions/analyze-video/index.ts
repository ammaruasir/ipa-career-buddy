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
    const { response_id, frames, answer_text, question_text } = await req.json();
    if (!response_id || !frames || !Array.isArray(frames) || frames.length === 0) {
      throw new Error("response_id and frames[] are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build multimodal content with frames as inline images
    const imageContent = frames.map((frame: string) => ({
      type: "image_url" as const,
      image_url: { url: frame }, // base64 data URL
    }));

    const systemPrompt = `أنت خبير تحليل لغة الجسد وتعبيرات الوجه في مقابلات العمل.
قم بتحليل صور المرشح أثناء إجابته على سؤال المقابلة وقدم تقييمًا شاملاً.

السؤال: ${question_text || "غير متوفر"}
الإجابة النصية: ${answer_text || "غير متوفر"}

حلل الصور وقيّم:
1. التواصل البصري (eye contact) - هل ينظر المرشح للكاميرا؟
2. الثقة بالنفس - تعبيرات الوجه، الوضعية
3. الانخراط والاهتمام - هل يبدو منتبهًا ومشاركًا؟
4. لغة الجسد العامة - الوضعية، الحركات، المظهر المهني
5. كشف الهاتف المحمول - هل يوجد هاتف محمول مرئي في الإطار؟ هل يمسك المرشح بهاتف أو يوجد هاتف على الطاولة أو بالقرب منه؟`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "حلل صور المرشح التالية من مقابلة الفيديو:" },
              ...imageContent,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_video_analysis",
              description: "Submit video frame analysis results for the candidate",
              parameters: {
                type: "object",
                properties: {
                  eye_contact_score: { type: "number", description: "Eye contact score 0-100" },
                  confidence_score: { type: "number", description: "Facial confidence score 0-100" },
                  engagement_score: { type: "number", description: "Engagement/attentiveness score 0-100" },
                  body_language_assessment: { type: "string", description: "Body language assessment in Arabic" },
                  professional_appearance: { type: "number", description: "Professional appearance score 0-100" },
                  overall_impression: { type: "string", description: "Overall impression summary in Arabic" },
                  phone_detected: { type: "boolean", description: "Whether a mobile phone is visible in the frame" },
                  phone_detection_notes: { type: "string", description: "Notes about phone location and usage in Arabic, empty string if no phone detected" },
                },
                required: [
                  "eye_contact_score", "confidence_score", "engagement_score",
                  "body_language_assessment", "professional_appearance", "overall_impression",
                  "phone_detected", "phone_detection_notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_video_analysis" } },
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI video analysis failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No analysis returned from AI");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save analysis to the response record
    const { error: updateErr } = await supabase
      .from("responses")
      .update({ ai_analysis: analysis })
      .eq("id", response_id);

    if (updateErr) {
      console.error("Failed to save video analysis:", updateErr);
      throw new Error("Failed to save video analysis");
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
