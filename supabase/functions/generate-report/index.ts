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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const [ivRes, evRes] = await Promise.all([
      supabase.from("interviews").select("*").eq("id", interview_id).single(),
      supabase.from("evaluations").select("*").eq("interview_id", interview_id).single(),
    ]);

    const interview = ivRes.data;
    const evaluation = evRes.data;
    if (!interview || !evaluation) throw new Error("Interview or evaluation not found");

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, major, education_level, experience_years, city, nationality")
      .eq("user_id", interview.user_id)
      .single();

    const discLabels: Record<string, string> = {
      D: "مسيطر (D) - حازم ومباشر",
      I: "مؤثر (I) - اجتماعي ومتحمس",
      S: "مستقر (S) - صبور ومتعاون",
      C: "ملتزم (C) - دقيق ومنظم",
    };

    const typeLabels: Record<string, string> = { text: "نصية", voice: "صوتية", video: "فيديو" };
    const strengths = Array.isArray(evaluation.strengths) ? evaluation.strengths : [];
    const improvements = Array.isArray(evaluation.improvements) ? evaluation.improvements : [];

    // Generate HTML report
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Tajawal', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; max-width: 800px; margin: auto; }
  .header { text-align: center; border-bottom: 3px solid #1a3a6e; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #1a3a6e; font-size: 24px; }
  .header p { color: #666; margin-top: 5px; }
  .section { margin-bottom: 25px; }
  .section h2 { color: #1a3a6e; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-item { display: flex; gap: 8px; }
  .info-item .label { color: #666; min-width: 120px; }
  .info-item .value { font-weight: 700; }
  .score-bar { background: #eee; border-radius: 6px; height: 20px; position: relative; margin: 5px 0; }
  .score-fill { height: 100%; border-radius: 6px; background: #1a3a6e; }
  .score-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .big-score { font-size: 48px; font-weight: 700; color: #1a3a6e; text-align: center; }
  .list { list-style: none; }
  .list li { padding: 5px 0; padding-right: 15px; position: relative; }
  .list li::before { content: "●"; position: absolute; right: 0; }
  .list.green li::before { color: #0d9488; }
  .list.orange li::before { color: #d97706; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h1>تقرير تقييم المقابلة</h1>
    <p>تم الإنشاء: ${new Date().toLocaleDateString("ar-SA")}</p>
  </div>

  <div class="section">
    <h2>معلومات المرشح</h2>
    <div class="info-grid">
      <div class="info-item"><span class="label">الاسم:</span><span class="value">${profile?.full_name || "—"}</span></div>
      <div class="info-item"><span class="label">التخصص:</span><span class="value">${profile?.major || "—"}</span></div>
      <div class="info-item"><span class="label">المؤهل:</span><span class="value">${profile?.education_level || "—"}</span></div>
      <div class="info-item"><span class="label">الخبرة:</span><span class="value">${profile?.experience_years ?? "—"} سنوات</span></div>
      <div class="info-item"><span class="label">المدينة:</span><span class="value">${profile?.city || "—"}</span></div>
      <div class="info-item"><span class="label">الجنسية:</span><span class="value">${profile?.nationality || "—"}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>معلومات المقابلة</h2>
    <div class="info-grid">
      <div class="info-item"><span class="label">الوظيفة:</span><span class="value">${interview.job_position}</span></div>
      <div class="info-item"><span class="label">نوع المقابلة:</span><span class="value">${typeLabels[interview.type] || interview.type}</span></div>
      <div class="info-item"><span class="label">التاريخ:</span><span class="value">${new Date(interview.created_at).toLocaleDateString("ar-SA")}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>التقييم الإجمالي</h2>
    <div class="big-score">${evaluation.overall_score || 0}%</div>
    <p style="text-align:center;margin-top:8px;">
      <span class="badge ${evaluation.recommendation?.includes("غير") ? "badge-red" : "badge-green"}">${evaluation.recommendation || "—"}</span>
    </p>
  </div>

  <div class="section">
    <h2>الدرجات التفصيلية</h2>
    ${[
      { label: "مهارات التواصل", score: evaluation.communication_score },
      { label: "الكفاءة التقنية", score: evaluation.technical_score },
      { label: "التوافق الثقافي", score: evaluation.personality_match },
      { label: "الثقة", score: evaluation.confidence_score },
    ]
      .map(
        (s) => `
    <div class="score-row">
      <span>${s.label}</span>
      <span style="font-weight:700">${s.score || 0}%</span>
    </div>
    <div class="score-bar"><div class="score-fill" style="width:${s.score || 0}%"></div></div>`
      )
      .join("")}
  </div>

  ${evaluation.personality_type ? `
  <div class="section">
    <h2>تحليل الشخصية (DISC)</h2>
    <p style="font-weight:700;font-size:16px;">${discLabels[evaluation.personality_type] || evaluation.personality_type}</p>
  </div>` : ""}

  ${strengths.length > 0 ? `
  <div class="section">
    <h2>نقاط القوة</h2>
    <ul class="list green">${strengths.map((s: string) => `<li>${s}</li>`).join("")}</ul>
  </div>` : ""}

  ${improvements.length > 0 ? `
  <div class="section">
    <h2>مجالات التحسين</h2>
    <ul class="list orange">${improvements.map((s: string) => `<li>${s}</li>`).join("")}</ul>
  </div>` : ""}

  ${evaluation.ai_feedback_ar ? `
  <div class="section">
    <h2>ملاحظات محرك واكب للذكاء الاصطناعي</h2>
    <p>${evaluation.ai_feedback_ar}</p>
  </div>` : ""}

  <div class="footer">
    <p>تم إنشاء هذا التقرير تلقائياً بواسطة منصة المقابلات الذكية - معهد الإدارة العامة</p>
  </div>
</body>
</html>`;

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
