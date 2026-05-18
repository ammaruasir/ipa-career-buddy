// render-cv-pdf — generates a PDF from a cv_drafts row.
// Uses Browserless.io (or any HTML-to-PDF service via env) for Arabic RTL rendering.
// Falls back to a print-friendly HTML response if PDF service is not configured —
// the client can then `window.print()` for browser-native PDF.
//
// Approach: render a self-contained HTML page with Noto Naskh Arabic font from
// Google Fonts (embedded as link), proper bidi handling, and CSS print media query.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  rateLimitResponse,
  fetchWithBackoff,
} from "../_shared/guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Draft {
  personal_info: any;
  summary: any;
  experience: any[];
  education: any[];
  skills: any;
  certifications: any[];
  custom_sections?: {
    volunteer?: any[];
    awards?: any[];
    projects?: any[];
    languages_structured?: any[];
  };
  template: "conservative" | "modern" | "executive";
  language: "ar" | "en" | "bilingual";
}

function escapeHtml(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(draft: Draft, lang: "ar" | "en"): string {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";
  const fontFamily = isAr
    ? "'Noto Naskh Arabic', 'Tajawal', serif"
    : "'Inter', 'Helvetica Neue', Arial, sans-serif";

  const pi = draft.personal_info ?? {};
  const summary = isAr ? (draft.summary?.ar ?? "") : (draft.summary?.en ?? draft.summary?.ar ?? "");
  const t = isAr
    ? {
        summary: "الملخّص",
        experience: "الخبرة العمليّة",
        education: "التعليم",
        skills: "المهارات",
        certifications: "الشهادات",
        technical: "تقنية",
        soft: "شخصية",
        languages: "اللغات",
        present: "حتى الآن",
        volunteer: "العمل التطوّعي",
        projects: "المشاريع",
        awards: "الجوائز والتقديرات",
        tech_used: "التقنيات",
        native: "الأم",
      }
    : {
        summary: "Summary",
        experience: "Experience",
        education: "Education",
        skills: "Skills",
        certifications: "Certifications",
        technical: "Technical",
        soft: "Soft",
        languages: "Languages",
        present: "Present",
        volunteer: "Volunteer Work",
        projects: "Projects",
        awards: "Awards & Recognition",
        tech_used: "Tech",
        native: "Native",
      };

  const contactLine = [pi.email, pi.phone, pi.city, pi.linkedin]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" • ");

  const expHtml = (draft.experience ?? [])
    .map((e: any) => {
      const bullets = (e.bullets ?? [])
        .map((b: string) => `<li>${escapeHtml(b)}</li>`)
        .join("");
      return `
        <div class="entry">
          <div class="entry-head">
            <strong>${escapeHtml(e.position ?? "")}</strong>
            <span class="dates">${escapeHtml(e.start ?? "")} – ${escapeHtml(e.end || t.present)}</span>
          </div>
          <div class="company">${escapeHtml(e.company ?? "")}</div>
          ${bullets ? `<ul>${bullets}</ul>` : ""}
        </div>`;
    })
    .join("");

  const eduHtml = (draft.education ?? [])
    .map(
      (e: any) => `
        <div class="entry">
          <div class="entry-head">
            <strong>${escapeHtml(e.degree ?? "")} ${e.major ? "— " + escapeHtml(e.major) : ""}</strong>
            <span class="dates">${escapeHtml(e.start ?? "")} – ${escapeHtml(e.end ?? "")}</span>
          </div>
          <div class="company">${escapeHtml(e.institution ?? "")}${e.gpa ? ` · ${escapeHtml(e.gpa)}` : ""}</div>
        </div>`,
    )
    .join("");

  const skillsHtml = (() => {
    const s = draft.skills ?? {};
    const parts: string[] = [];
    if (s.technical?.length)
      parts.push(`<p><strong>${t.technical}:</strong> ${(s.technical as string[]).map(escapeHtml).join("، ")}</p>`);
    if (s.soft?.length)
      parts.push(`<p><strong>${t.soft}:</strong> ${(s.soft as string[]).map(escapeHtml).join("، ")}</p>`);
    if (s.languages?.length)
      parts.push(`<p><strong>${t.languages}:</strong> ${(s.languages as string[]).map(escapeHtml).join("، ")}</p>`);
    return parts.join("");
  })();

  const certHtml = (draft.certifications ?? [])
    .map(
      (c: any) =>
        `<li><strong>${escapeHtml(c.name ?? "")}</strong>${c.issuer ? " — " + escapeHtml(c.issuer) : ""}${c.date ? ` (${escapeHtml(c.date)})` : ""}</li>`,
    )
    .join("");

  const cs = draft.custom_sections ?? {};

  const volunteerHtml = (cs.volunteer ?? [])
    .map(
      (v: any) => `
        <div class="entry">
          <div class="entry-head">
            <strong>${escapeHtml(v.role ?? "")}</strong>
            <span class="dates">${escapeHtml(v.start ?? "")} – ${escapeHtml(v.end || t.present)}</span>
          </div>
          <div class="company">${escapeHtml(v.organization ?? "")}</div>
          ${v.description ? `<p>${escapeHtml(v.description)}</p>` : ""}
        </div>`,
    )
    .join("");

  const projectsHtml = (cs.projects ?? [])
    .map(
      (p: any) => `
        <div class="entry">
          <div class="entry-head">
            <strong>${escapeHtml(p.name ?? "")}${p.role ? " — " + escapeHtml(p.role) : ""}</strong>
            ${p.link ? `<span class="dates"><a href="${escapeHtml(p.link)}">${escapeHtml(p.link.replace(/^https?:\/\//, ""))}</a></span>` : ""}
          </div>
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
          ${p.tech && p.tech.length ? `<p style="font-size:9pt;color:#666;"><strong>${t.tech_used}:</strong> ${(p.tech as string[]).map(escapeHtml).join("، ")}</p>` : ""}
        </div>`,
    )
    .join("");

  const awardsHtml = (cs.awards ?? [])
    .map(
      (a: any) => `
        <li>
          <strong>${escapeHtml(a.title ?? "")}</strong>
          ${a.issuer ? " — " + escapeHtml(a.issuer) : ""}
          ${a.date ? ` <span style="color:#666;">(${escapeHtml(a.date)})</span>` : ""}
          ${a.description ? `<div style="font-size:9.5pt;color:#555;">${escapeHtml(a.description)}</div>` : ""}
        </li>`,
    )
    .join("");

  const langsHtml = (cs.languages_structured ?? [])
    .map(
      (l: any) =>
        `<li><strong>${escapeHtml(l.name ?? "")}</strong>${l.cefr ? ` — ${l.cefr === "native" ? t.native : escapeHtml(l.cefr)}` : ""}${l.label ? ` <span style="color:#777;">· ${escapeHtml(l.label)}</span>` : ""}</li>`,
    )
    .join("");

  // Template variations via accent color
  const accent =
    draft.template === "executive"
      ? "#1e3a8a"
      : draft.template === "conservative"
      ? "#374151"
      : "#1e40af"; // modern

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pi.full_name ?? "CV")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: ${fontFamily};
      color: #111;
      line-height: 1.55;
      font-size: 11pt;
    }
    body { padding: 24mm 20mm; max-width: 210mm; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid ${accent}; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 22pt; margin: 0; color: ${accent}; font-weight: 700; }
    .header .contact { color: #555; font-size: 10pt; margin-top: 4px; }
    section { margin-top: 14px; }
    section h2 {
      font-size: 13pt; color: ${accent};
      border-bottom: 1px solid ${accent}33;
      padding-bottom: 3px; margin: 0 0 8px;
      text-align: ${align};
    }
    .entry { margin-bottom: 10px; }
    .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .entry-head strong { font-size: 11pt; }
    .dates { color: #666; font-size: 9pt; white-space: nowrap; }
    .company { color: #444; font-size: 10pt; margin-bottom: 2px; }
    ul { margin: 4px 0 0; padding-${isAr ? "right" : "left"}: 16px; }
    li { margin-bottom: 2px; font-size: 10.5pt; }
    p { margin: 4px 0; font-size: 10.5pt; }
    @media print {
      body { padding: 18mm 16mm; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(pi.full_name ?? "")}</h1>
    ${contactLine ? `<div class="contact">${contactLine}</div>` : ""}
  </div>

  ${summary ? `<section><h2>${t.summary}</h2><p>${escapeHtml(summary)}</p></section>` : ""}

  ${expHtml ? `<section><h2>${t.experience}</h2>${expHtml}</section>` : ""}

  ${eduHtml ? `<section><h2>${t.education}</h2>${eduHtml}</section>` : ""}

  ${skillsHtml ? `<section><h2>${t.skills}</h2>${skillsHtml}</section>` : ""}

  ${certHtml ? `<section><h2>${t.certifications}</h2><ul>${certHtml}</ul></section>` : ""}

  ${volunteerHtml ? `<section><h2>${t.volunteer}</h2>${volunteerHtml}</section>` : ""}

  ${projectsHtml ? `<section><h2>${t.projects}</h2>${projectsHtml}</section>` : ""}

  ${awardsHtml ? `<section><h2>${t.awards}</h2><ul>${awardsHtml}</ul></section>` : ""}

  ${langsHtml ? `<section><h2>${t.languages}</h2><ul>${langsHtml}</ul></section>` : ""}
</body>
</html>`;
}

async function htmlToPdfViaService(html: string): Promise<Uint8Array | null> {
  // Prefer Browserless.io if BROWSERLESS_API_KEY is set
  const blKey = Deno.env.get("BROWSERLESS_API_KEY");
  if (blKey) {
    try {
      const r = await fetchWithBackoff(
        `https://chrome.browserless.io/pdf?token=${blKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html,
            options: { format: "A4", printBackground: true, preferCSSPageSize: true },
            waitForTimeout: 1500,
          }),
        },
        { maxAttempts: 2 },
      );
      if (!r.ok) {
        console.warn("Browserless PDF failed:", r.status, await r.text());
        return null;
      }
      const ab = await r.arrayBuffer();
      return new Uint8Array(ab);
    } catch (e) {
      console.warn("Browserless call error:", e);
      return null;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit: PDF generation is expensive
    const rl = await checkRateLimit(adminClient, user.id, "cv_pdf", 5, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    const body = await req.json();
    const draftId: string = body.draft_id;
    const requestedLang: "ar" | "en" = body.language === "en" ? "en" : "ar";

    if (!draftId) {
      return new Response(JSON.stringify({ error: "draft_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: draftRow, error: dErr } = await adminClient
      .from("cv_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (dErr || !draftRow) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const draft = draftRow as unknown as Draft;
    const html = renderHtml(draft, requestedLang);

    // Try to render via external service
    const pdfBytes = await htmlToPdfViaService(html);

    if (pdfBytes) {
      // Upload to storage and return signed URL
      const filename = `exported/${user.id}/${draftId}_${requestedLang}_${Date.now()}.pdf`;
      const { error: upErr } = await adminClient.storage
        .from("resumes")
        .upload(filename, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (upErr) {
        console.warn("PDF upload failed:", upErr);
      } else {
        const { data: signed } = await adminClient.storage
          .from("resumes")
          .createSignedUrl(filename, 60 * 60); // 1h

        // Update draft export tracking
        await adminClient
          .from("cv_drafts")
          .update({
            last_exported_at: new Date().toISOString(),
            export_count: (((draftRow as any).export_count) ?? 0) + 1,
          })
          .eq("id", draftId);

        return new Response(
          JSON.stringify({
            success: true,
            url: signed?.signedUrl,
            mode: "pdf",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fallback: return HTML for browser-side printing (window.print())
    return new Response(
      JSON.stringify({
        success: true,
        mode: "html",
        html,
        note:
          "PDF rendering service not configured (set BROWSERLESS_API_KEY). " +
          "Returning HTML — client should open in new window and trigger print.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("render-cv-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
