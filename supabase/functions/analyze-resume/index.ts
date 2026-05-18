import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = authUser.id;

    const { resume_path } = await req.json();
    if (!resume_path) {
      return new Response(JSON.stringify({ error: "resume_path is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download the PDF from storage
    const { data: fileData, error: fileError } = await supabase.storage.from("resumes").download(resume_path);
    if (fileError || !fileData) {
      console.error("File download error:", fileError);
      return new Response(JSON.stringify({ error: "تعذر تحميل ملف السيرة الذاتية" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Convert PDF to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use Gemini with the PDF as inline data
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `أنت مدرّب سير ذاتية محترف لمعهد الإدارة العامة (IPA) في السعودية.
حلّل السيرة الذاتية المرفقة:
1) استخراج البيانات المهنية المهيكلة (المهارات/الشهادات/الخبرة).
2) تقييم جودة كل قسم من 0 إلى 100.
3) رصد نقاط الضعف بأمثلة حرفية من النصّ.
4) اقتراح إعادة كتابة عربية فصحى للنقاط الضعيفة فقط (لا تختلق حقائق).
5) فحص الامتثال للمعايير السعودية: التواريخ الهجرية، تنسيق العنوان، ذكر خدمة العلم، رابط جدارات.
أجب دائماً باستخدام الأداة المحدّدة. تجنّب الترويج العدواني للذات (غير ملائم ثقافياً).`,
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "resume.pdf",
                  file_data: `data:application/pdf;base64,${base64}`,
                },
              },
              {
                type: "text",
                text: "حلّل هذه السيرة الذاتية وفق الأداة. كن صريحاً في نقاط الضعف ومحدّداً في الاقتباسات.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "resume_analysis",
              description: "Structured resume extraction + per-section evaluation + KSA compliance",
              parameters: {
                type: "object",
                properties: {
                  // P0.3-legacy: extraction (kept compatible with profiles.resume_skills downstream)
                  technical_skills: { type: "array", items: { type: "string" } },
                  soft_skills: { type: "array", items: { type: "string" } },
                  certifications: { type: "array", items: { type: "string" } },
                  experience_years: { type: "number" },
                  education_level: { type: "string" },
                  major: { type: "string" },
                  languages: { type: "array", items: { type: "string" } },
                  summary: { type: "string" },

                  // P0.3-new: evaluation
                  section_scores: {
                    type: "object",
                    properties: {
                      contact: { type: "number", minimum: 0, maximum: 100 },
                      summary: { type: "number", minimum: 0, maximum: 100 },
                      experience: { type: "number", minimum: 0, maximum: 100 },
                      education: { type: "number", minimum: 0, maximum: 100 },
                      skills: { type: "number", minimum: 0, maximum: 100 },
                      achievements: { type: "number", minimum: 0, maximum: 100 },
                      language_quality: { type: "number", minimum: 0, maximum: 100 },
                    },
                    required: ["contact", "summary", "experience", "education", "skills", "achievements", "language_quality"],
                    additionalProperties: false,
                  },
                  weaknesses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        section: { type: "string" },
                        issue: { type: "string", description: "وصف المشكلة بالعربية" },
                        original_text: { type: "string", description: "النص الأصلي الحرفي من السيرة" },
                        severity: { type: "string", enum: ["minor", "moderate", "major"] },
                      },
                      required: ["section", "issue", "original_text", "severity"],
                      additionalProperties: false,
                    },
                  },
                  rewrites: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original: { type: "string" },
                        improved: { type: "string" },
                        reason: { type: "string", description: "سبب التحسين بالعربية" },
                      },
                      required: ["original", "improved", "reason"],
                      additionalProperties: false,
                    },
                  },
                  saudi_compliance: {
                    type: "object",
                    properties: {
                      uses_hijri_dates: { type: "boolean" },
                      address_format_correct: { type: "boolean" },
                      military_service_mentioned: { type: "boolean" },
                      jadarat_link_present: { type: "boolean" },
                      recommendations: { type: "array", items: { type: "string" } },
                    },
                    required: ["uses_hijri_dates", "address_format_correct", "military_service_mentioned", "jadarat_link_present", "recommendations"],
                    additionalProperties: false,
                  },
                },
                required: [
                  "technical_skills", "soft_skills", "certifications",
                  "experience_years", "education_level", "summary",
                  "section_scores", "weaknesses", "rewrites", "saudi_compliance",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "resume_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى شحن رصيد محرك واكب للذكاء الاصطناعي" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "تعذر تحليل السيرة الذاتية" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // P0.3: split extraction (legacy shape) from evaluation
    const extraction = {
      technical_skills: analysis.technical_skills,
      soft_skills: analysis.soft_skills,
      certifications: analysis.certifications,
      experience_years: analysis.experience_years,
      education_level: analysis.education_level,
      major: analysis.major,
      languages: analysis.languages,
      summary: analysis.summary,
    };

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Keep legacy profiles.resume_skills field in sync (downstream matching uses it)
    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ resume_skills: extraction })
      .eq("user_id", userId);
    if (updateError) console.error("Profile update error:", updateError);

    // P0.3: persist evaluation snapshot to cv_documents
    const { data: cvDoc, error: cvErr } = await serviceClient
      .from("cv_documents")
      .insert({
        user_id: userId,
        file_url: resume_path,
        file_name: resume_path.split("/").pop() ?? "resume.pdf",
        file_size: arrayBuffer.byteLength,
        extraction,
        section_scores: analysis.section_scores,
        weaknesses: analysis.weaknesses,
        rewrites: analysis.rewrites,
        saudi_compliance: analysis.saudi_compliance,
        model_used: "google/gemini-3-flash-preview",
        tokens_used: aiData.usage?.total_tokens ?? null,
      })
      .select()
      .single();

    if (cvErr) {
      // Non-fatal: extraction still useful even if snapshot save failed
      console.warn("cv_documents insert failed:", cvErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        skills: extraction,
        evaluation: {
          section_scores: analysis.section_scores,
          weaknesses: analysis.weaknesses,
          rewrites: analysis.rewrites,
          saudi_compliance: analysis.saudi_compliance,
        },
        cv_document_id: cvDoc?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-resume error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
