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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    const { resume_path, target_role } = await req.json();
    if (!resume_path) {
      return new Response(JSON.stringify({ error: "resume_path is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from("resumes")
      .download(resume_path);
    if (fileError || !fileData) {
      console.error("File download error:", fileError);
      return new Response(JSON.stringify({ error: "تعذر تحميل ملف السيرة الذاتية" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const targetRolePrompt = target_role
      ? `\n\nالوظيفة المستهدفة: ${target_role}. قيّم محاذاة السيرة لهذه الوظيفة تحديداً.`
      : "";

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
            content:
              `أنت خبير سير ذاتية متخصّص في معايير القطاع الحكومي السعودي وفق منصة جدارات ورؤية 2030. مهمّتك:
1) استخراج المحتوى المنظّم من السيرة الذاتية المرفقة.
2) تقييم كل قسم رئيسي بدرجة من 0 إلى 100.
3) تحديد نقاط الضعف الفعلية بأمثلة من نصّ السيرة.
4) اقتراح إعادة كتابة محسّنة لكل بند ضعيف (نسخة الطالب → نسخة محسّنة + السبب).
5) ملاحظة المعايير السعودية: التواريخ الهجرية، تنسيق العنوان (المنطقة/المدينة)، حالة الخدمة العسكرية للذكور، رقم جدارات إن وُجد، صياغة عربية رسمية.

أجب دائماً عبر الأداة المحددة.`,
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
                text: `حلّل هذه السيرة الذاتية، استخرج محتواها، قيّم كل قسم، حدّد نقاط الضعف، واقترح إعادة كتابة محسّنة.${targetRolePrompt}`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "resume_review",
              description: "Return structured resume extraction + section-by-section evaluation",
              parameters: {
                type: "object",
                properties: {
                  parsed: {
                    type: "object",
                    description: "المحتوى المستخرج من السيرة",
                    properties: {
                      full_name: { type: "string" },
                      contact: {
                        type: "object",
                        properties: {
                          email: { type: "string" },
                          phone: { type: "string" },
                          city: { type: "string" },
                          linkedin: { type: "string" },
                        },
                      },
                      summary: { type: "string" },
                      technical_skills: { type: "array", items: { type: "string" } },
                      soft_skills: { type: "array", items: { type: "string" } },
                      certifications: { type: "array", items: { type: "string" } },
                      languages: { type: "array", items: { type: "string" } },
                      experience_years: { type: "number" },
                      education_level: { type: "string" },
                      major: { type: "string" },
                      experiences: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            employer: { type: "string" },
                            period: { type: "string" },
                            bullets: { type: "array", items: { type: "string" } },
                          },
                          required: ["title", "employer"],
                        },
                      },
                      education: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            degree: { type: "string" },
                            institution: { type: "string" },
                            period: { type: "string" },
                            gpa: { type: "string" },
                          },
                        },
                      },
                    },
                    required: ["technical_skills", "soft_skills", "experience_years", "education_level", "summary"],
                  },
                  scores: {
                    type: "object",
                    description: "درجات 0-100 لكل قسم",
                    properties: {
                      contact: { type: "number" },
                      summary: { type: "number" },
                      experience: { type: "number" },
                      education: { type: "number" },
                      skills: { type: "number" },
                      achievements: { type: "number" },
                      formatting: { type: "number" },
                      language_quality: { type: "number" },
                      saudi_gov_alignment: { type: "number", description: "0-100: ملاءمة للقطاع الحكومي السعودي" },
                      target_role_alignment: {
                        type: "number",
                        description: "0-100: محاذاة مع الوظيفة المستهدفة (إن وُجدت)",
                      },
                      overall: { type: "number" },
                    },
                    required: ["contact", "summary", "experience", "education", "skills",
                               "achievements", "formatting", "language_quality", "overall"],
                  },
                  suggestions: {
                    type: "object",
                    description: "اقتراحات تحسين فعلية",
                    properties: {
                      weaknesses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            section: { type: "string" },
                            issue_ar: { type: "string" },
                            example_from_cv: { type: "string" },
                          },
                          required: ["section", "issue_ar"],
                        },
                      },
                      rewrites: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            section: { type: "string" },
                            original_ar: { type: "string" },
                            improved_ar: { type: "string" },
                            why_ar: { type: "string" },
                          },
                          required: ["section", "original_ar", "improved_ar", "why_ar"],
                        },
                      },
                      missing_for_target: {
                        type: "array",
                        items: { type: "string" },
                        description: "ما ينقص لمحاذاة أفضل مع الوظيفة المستهدفة",
                      },
                    },
                    required: ["weaknesses", "rewrites"],
                  },
                },
                required: ["parsed", "scores", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "resume_review" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى شحن رصيد محرك واكب للذكاء الاصطناعي" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "تعذر تحليل السيرة الذاتية" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const review = JSON.parse(toolCall.function.arguments);

    // Use service role to persist both:
    //   - cv_documents (full review history)
    //   - profiles.resume_skills (latest extracted skills cache, backward compatible)
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cvDocPayload = {
      user_id: userId,
      source_path: resume_path,
      source_type: "upload",
      parsed: review.parsed,
      scores: review.scores,
      suggestions: review.suggestions,
      target_role: target_role || null,
      language: "ar",
    };

    const { data: cvDoc, error: cvErr } = await serviceClient
      .from("cv_documents")
      .insert(cvDocPayload)
      .select()
      .single();

    if (cvErr) {
      console.error("cv_documents insert error:", cvErr);
    }

    // Backward-compatible: keep profiles.resume_skills populated for legacy code paths
    const legacySkills = {
      technical_skills: review.parsed.technical_skills,
      soft_skills: review.parsed.soft_skills,
      certifications: review.parsed.certifications,
      experience_years: review.parsed.experience_years,
      education_level: review.parsed.education_level,
      major: review.parsed.major,
      languages: review.parsed.languages,
      summary: review.parsed.summary,
    };

    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ resume_skills: legacySkills })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cv_document_id: cvDoc?.id,
        skills: legacySkills,
        review,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-resume error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
