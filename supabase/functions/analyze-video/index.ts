import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { response_id, frames, answer_text, question_text, interview_id } = await req.json();
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      throw new Error("frames[] are required");
    }
    if (!response_id && !interview_id) {
      throw new Error("response_id or interview_id is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // SECURITY: verify the caller owns the interview / response before processing video frames
    const authHeader = req.headers.get("Authorization") ?? "";
    const isServerCall = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    // Load owner + mode upfront (we need mode anyway for anti-cheat scoping)
    let interviewOwnerId: string | null = null;
    let interviewMode: string | null = null;
    let lookupInterviewId = interview_id;
    if (!lookupInterviewId && response_id) {
      const { data: r } = await supabase
        .from("responses")
        .select("interview_id")
        .eq("id", response_id)
        .single();
      lookupInterviewId = (r as any)?.interview_id ?? null;
    }
    if (lookupInterviewId) {
      const { data: iv } = await supabase
        .from("interviews")
        .select("user_id, mode")
        .eq("id", lookupInterviewId)
        .single();
      interviewOwnerId = (iv as any)?.user_id ?? null;
      interviewMode = (iv as any)?.mode ?? null;
    }

    if (!isServerCall) {
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await userClient.auth.getUser(token);
      if (!user || user.id !== interviewOwnerId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build multimodal content with frames as inline images
    const imageContent = frames.map((frame: string) => ({
      type: "image_url" as const,
      image_url: { url: frame },
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
5. كشف الهاتف المحمول - هل يوجد هاتف محمول مرئي في الإطار؟
6. كشف شخص إضافي - هل يوجد شخص آخر غير المرشح في الإطار؟
7. اتجاه النظر - هل المرشح ينظر بعيداً عن الشاشة بشكل متكرر؟`;

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
                  phone_detection_notes: { type: "string", description: "Notes about phone in Arabic, empty if none" },
                  extra_person_detected: { type: "boolean", description: "Whether an extra person is visible" },
                  looking_away: { type: "boolean", description: "Whether candidate is frequently looking away" },
                  looking_away_notes: { type: "string", description: "Notes about gaze direction in Arabic" },
                },
                required: [
                  "eye_contact_score", "confidence_score", "engagement_score",
                  "body_language_assessment", "professional_appearance", "overall_impression",
                  "phone_detected", "phone_detection_notes",
                  "extra_person_detected", "looking_away", "looking_away_notes",
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
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد" }), {
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

    // Save analysis to the response record if response_id provided
    if (response_id) {
      const { error: updateErr } = await supabase
        .from("responses")
        .update({ ai_analysis: analysis })
        .eq("id", response_id);

      if (updateErr) {
        console.error("Failed to save video analysis:", updateErr);
      }
    }

    // Log cheat events to cheat_events table
    const targetInterviewId = interview_id || response_id;
    // We need the actual interview_id — if only response_id, look it up
    let actualInterviewId = interview_id;
    if (!actualInterviewId && response_id) {
      const { data: respRow } = await supabase
        .from("responses")
        .select("interview_id")
        .eq("id", response_id)
        .single();
      actualInterviewId = respRow?.interview_id;
    }

    // SECURITY/UX: anti-cheat events are meaningful only for assessment mode.
    // Practice sessions must be safe-to-fail; don't log cheat events for them.
    const skipCheatLogging = interviewMode === "practice";

    if (actualInterviewId && !skipCheatLogging) {
      const events: { event_type: string; details: string }[] = [];

      if (analysis.phone_detected) {
        events.push({ event_type: "phone_detected", details: analysis.phone_detection_notes || "تم كشف هاتف محمول" });
      }
      if (analysis.extra_person_detected) {
        events.push({ event_type: "person_detected", details: "تم كشف شخص إضافي في الإطار" });
      }
      if (analysis.looking_away) {
        events.push({ event_type: "looking_away", details: analysis.looking_away_notes || "المرشح ينظر بعيداً بشكل متكرر" });
      }

      if (events.length > 0) {
        // Upload first frame from the batch for each cheat event
        const rows = [];
        for (const e of events) {
          let frameUrl: string | null = null;
          try {
            const frameData = frames[0]; // first frame from batch
            if (frameData && frameData.includes(",")) {
              const base64Part = frameData.split(",")[1];
              const frameBuffer = decode(base64Part);
              const framePath = `cheat-frames/${actualInterviewId}/${Date.now()}_${e.event_type}.jpg`;
              const { error: uploadErr } = await supabase.storage
                .from("interview-recordings")
                .upload(framePath, frameBuffer, { contentType: "image/jpeg", upsert: true });

              if (!uploadErr) {
                const { data: signedData } = await supabase.storage
                  .from("interview-recordings")
                  .createSignedUrl(framePath, 86400 * 365); // 1 year
                frameUrl = signedData?.signedUrl || null;
              } else {
                console.error("Failed to upload cheat frame:", uploadErr);
              }
            }
          } catch (frameErr) {
            console.error("Error processing cheat frame:", frameErr);
          }

          rows.push({
            interview_id: actualInterviewId,
            event_type: e.event_type,
            details: e.details,
            frame_url: frameUrl,
          });
        }

        const { error: insertErr } = await supabase
          .from("cheat_events")
          .insert(rows);

        if (insertErr) {
          console.error("Failed to insert cheat events:", insertErr);
        }
      }
    }

    return new Response(JSON.stringify({ ...analysis, events: [] }), {
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
