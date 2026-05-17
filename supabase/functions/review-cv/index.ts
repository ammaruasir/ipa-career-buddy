// Review a CV authored in the CV Builder (no PDF, structured sections in JSON)
// Used after the student finishes editing in CVBuilder and clicks "قيّم سيرتي".
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { draft_id, target_role } = await req.json();
    if (!draft_id) throw new Error("draft_id is required");

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: draft, error: draftErr } = await serviceClient
      .from("cv_drafts")
      .select("*")
      .eq("id", draft_id)
      .single();
    if (draftErr || !draft) throw new Error("Draft not found");
    if (draft.user_id !== authUser.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const targetRolePrompt = target_role
      ? `\nالوظيفة المستهدفة: ${target_role}. قيّم محاذاة السيرة لهذه الوظيفة.`
      : "";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `أنت خبير سير ذاتية متخصّص في القطاع الحكومي السعودي. قيّم السيرة المُقدّمة (مهيكلة JSON) بدرجات لكل قسم 0-100 + اقتراحات تحسين فعلية.${targetRolePrompt}`,
          },
          { role: "user", content: `أقسام السيرة:\n${JSON.stringify(draft.sections, null, 2)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "cv_review_structured",
              parameters: {
                type: "object",
                properties: {
                  scores: {
                    type: "object",
                    properties: {
                      contact: { type: "number" },
                      summary: { type: "number" },
                      experience: { type: "number" },
                      education: { type: "number" },
                      skills: { type: "number" },
                      achievements: { type: "number" },
                      formatting: { type: "number" },
                      language_quality: { type: "number" },
                      saudi_gov_alignment: { type: "number" },
                      target_role_alignment: { type: "number" },
                      overall: { type: "number" },
                    },
                    required: ["contact", "summary", "experience", "education", "skills",
                               "achievements", "formatting", "language_quality", "overall"],
                  },
                  suggestions: {
                    type: "object",
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
                      missing_for_target: { type: "array", items: { type: "string" } },
                    },
                    required: ["weaknesses", "rewrites"],
                  },
                },
                required: ["scores", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "cv_review_structured" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("review-cv AI error", res.status, t);
      throw new Error("AI gateway error");
    }

    const data = await res.json();
    const tool = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tool?.function?.arguments) throw new Error("No review returned");

    const review = JSON.parse(tool.function.arguments);

    // Persist a cv_documents row representing the builder draft review
    const { data: doc, error: insErr } = await serviceClient
      .from("cv_documents")
      .insert({
        user_id: authUser.id,
        source_type: "builder",
        parsed: draft.sections,
        scores: review.scores,
        suggestions: review.suggestions,
        target_role: target_role || null,
        language: draft.language || "ar",
      })
      .select()
      .single();
    if (insErr) console.error("cv_documents insert error", insErr);

    return new Response(
      JSON.stringify({ success: true, cv_document_id: doc?.id, review }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("review-cv error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
