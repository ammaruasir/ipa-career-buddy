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
            content: "أنت نظام تحليل سير ذاتية متخصص. حلّل السيرة الذاتية المرفقة واستخرج المعلومات المطلوبة بدقة. أجب دائماً باستخدام الأداة المحددة.",
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
                text: "حلّل هذه السيرة الذاتية واستخرج: المهارات التقنية، المهارات الشخصية، الشهادات والدورات، سنوات الخبرة، التخصص، والمستوى التعليمي. أرجع النتيجة باستخدام الأداة المحددة.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "resume_analysis",
              description: "Return structured resume analysis",
              parameters: {
                type: "object",
                properties: {
                  technical_skills: { type: "array", items: { type: "string" }, description: "المهارات التقنية" },
                  soft_skills: { type: "array", items: { type: "string" }, description: "المهارات الشخصية" },
                  certifications: { type: "array", items: { type: "string" }, description: "الشهادات والدورات التدريبية" },
                  experience_years: { type: "number", description: "إجمالي سنوات الخبرة التقريبية" },
                  education_level: { type: "string", description: "أعلى مستوى تعليمي: ثانوي/دبلوم/بكالوريوس/ماجستير/دكتوراه" },
                  major: { type: "string", description: "التخصص الأكاديمي" },
                  languages: { type: "array", items: { type: "string" }, description: "اللغات" },
                  summary: { type: "string", description: "ملخص مختصر للمؤهلات بالعربية" },
                },
                required: ["technical_skills", "soft_skills", "certifications", "experience_years", "education_level", "summary"],
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
        return new Response(JSON.stringify({ error: "يرجى شحن رصيد الذكاء الاصطناعي" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const resumeSkills = JSON.parse(toolCall.function.arguments);

    // Save to profiles
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ resume_skills: resumeSkills })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    return new Response(JSON.stringify({ success: true, skills: resumeSkills }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-resume error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
