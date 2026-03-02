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
    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch profile & available jobs
    const [profileRes, jobsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user_id).single(),
      supabase.from("job_vacancies").select("title, department, requirements, description").eq("is_active", true),
    ]);

    const profile = profileRes.data;
    if (!profile || !profile.resume_skills || Object.keys(profile.resume_skills).length === 0) {
      return new Response(JSON.stringify({ guidance: null, error: "No resume skills found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobs = jobsRes.data || [];

    const prompt = `أنت مستشار مهني خبير. حلل بيانات هذا الشخص واقترح مسارات مهنية مناسبة مع خطة تطوير شاملة.

بيانات المرشح:
- الاسم: ${profile.full_name || "غير محدد"}
- التخصص: ${profile.major || "غير محدد"}
- المؤهل: ${profile.education_level || "غير محدد"}
- الخبرة: ${profile.experience_years || 0} سنوات
- المهارات المستخرجة: ${JSON.stringify(profile.resume_skills)}

الوظائف المتاحة حالياً:
${jobs.map((j: any) => `- ${j.title} (${j.department || "عام"}): ${(j.requirements || []).map((r: any) => typeof r === 'string' ? r : r.text || r.name).join(', ')}`).join('\n')}

أجب بتنسيق JSON فقط بالعربية بالشكل التالي:
{
  "career_paths": [{"title": "...", "description": "...", "match_percent": 85}],
  "skills_to_develop": [{"skill": "...", "importance": "high|medium|low", "current_level": 30, "required_level": 80}],
  "matching_jobs": [{"title": "...", "department": "...", "match_reason": "..."}],
  "summary": "ملخص شامل للتحليل المهني...",
  "training_plan": [
    {"phase": "الشهر ١-٣", "goals": ["هدف 1", "هدف 2"], "actions": ["خطوة 1", "خطوة 2"]},
    {"phase": "الشهر ٤-٦", "goals": ["..."], "actions": ["..."]},
    {"phase": "الشهر ٧-١٢", "goals": ["..."], "actions": ["..."]}
  ],
  "recommended_courses": [
    {"name": "اسم الدورة", "platform": "Coursera|Udemy|edX|دروب", "skill": "المهارة المرتبطة", "duration": "٤ أسابيع", "level": "مبتدئ|متوسط|متقدم"}
  ]
}

اقترح 3-5 مسارات مهنية عامة مناسبة لمهارات المرشح (ليس بالضرورة من الوظائف المتاحة)، و5-8 مهارات للتطوير مع مستوى المرشح الحالي والمستوى المطلوب (من 0 إلى 100).
اذكر الوظائف المطابقة من القائمة المتاحة فقط في قسم matching_jobs (إن وجدت).
اقترح خطة تطوير على 3 مراحل (قصيرة، متوسطة، طويلة المدى).
اقترح 4-8 دورات تدريبية حقيقية من منصات معروفة (Coursera, Udemy, edX, دروب، رواق) مع ذكر المهارة المرتبطة.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت مستشار مهني خبير. أجب بتنسيق JSON فقط بدون أي نص إضافي." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول مرة أخرى لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let guidance;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      guidance = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      console.error("Failed to parse AI response:", content);
      guidance = null;
    }

    return new Response(JSON.stringify({ guidance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("career-guidance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
