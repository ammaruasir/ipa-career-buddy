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
  section_order?: string[] | null;
  template: "conservative" | "modern" | "executive";
  language: "ar" | "en" | "bilingual";
}

const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "volunteer",
  "projects",
  "awards",
  "languages_structured",
] as const;

function resolveOrder(stored: string[] | null | undefined): string[] {
  const base = (stored ?? []).filter((k) => (DEFAULT_SECTION_ORDER as readonly string[]).includes(k));
  const missing = DEFAULT_SECTION_ORDER.filter((k) => !base.includes(k));
  return [...base, ...missing];
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

  // Per-template accent + layout
  const tpl = draft.template ?? "modern";
  const accent =
    tpl === "executive" ? "#1e3a8a" : tpl === "conservative" ? "#374151" : "#1e40af";

  // Build a section renderer map (so each template can pick which keys it owns)
  const renderSection = (key: string): string => {
    switch (key) {
      case "summary":
        return summary ? `<section><h2>${t.summary}</h2><p>${escapeHtml(summary)}</p></section>` : "";
      case "experience":
        return expHtml ? `<section><h2>${t.experience}</h2>${expHtml}</section>` : "";
      case "education":
        return eduHtml ? `<section><h2>${t.education}</h2>${eduHtml}</section>` : "";
      case "skills":
        return skillsHtml ? `<section><h2>${t.skills}</h2>${skillsHtml}</section>` : "";
      case "certifications":
        return certHtml ? `<section><h2>${t.certifications}</h2><ul>${certHtml}</ul></section>` : "";
      case "volunteer":
        return volunteerHtml ? `<section><h2>${t.volunteer}</h2>${volunteerHtml}</section>` : "";
      case "projects":
        return projectsHtml ? `<section><h2>${t.projects}</h2>${projectsHtml}</section>` : "";
      case "awards":
        return awardsHtml ? `<section><h2>${t.awards}</h2><ul>${awardsHtml}</ul></section>` : "";
      case "languages_structured":
        return langsHtml ? `<section><h2>${t.languages}</h2><ul>${langsHtml}</ul></section>` : "";
      default:
        return "";
    }
  };

  const orderedKeys = resolveOrder(draft.section_order);
  const fontHead = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

  const baseStyles = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: ${fontFamily}; color: #111; line-height: 1.55; font-size: 11pt; }
    .entry { margin-bottom: 10px; }
    .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .entry-head strong { font-size: 11pt; }
    .dates { color: #666; font-size: 9pt; white-space: nowrap; }
    .company { color: #444; font-size: 10pt; margin-bottom: 2px; }
    ul { margin: 4px 0 0; padding-${isAr ? "right" : "left"}: 16px; }
    li { margin-bottom: 2px; font-size: 10.5pt; }
    p { margin: 4px 0; font-size: 10.5pt; }
    @media print { @page { size: A4; margin: 0; } }`;

  // ============================================================
  // TEMPLATE: MODERN — accent top bar, name aligned, section underlines
  // ============================================================
  if (tpl === "modern") {
    const body = `
  <div class="top-bar"></div>
  <div class="page">
    <header class="hdr">
      <h1>${escapeHtml(pi.full_name ?? "")}</h1>
      ${contactLine ? `<div class="contact">${contactLine}</div>` : ""}
    </header>
    ${orderedKeys.map(renderSection).join("\n")}
  </div>`;
    return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${escapeHtml(pi.full_name ?? "CV")}</title>${fontHead}<style>${baseStyles}
    .top-bar { height: 8mm; background: ${accent}; }
    .page { padding: 14mm 18mm 18mm; max-width: 210mm; margin: 0 auto; }
    .hdr { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; text-align: ${align}; }
    .hdr h1 { font-size: 24pt; margin: 0; color: #0f172a; font-weight: 700; letter-spacing: -0.5px; }
    .hdr .contact { color: #555; font-size: 10pt; margin-top: 4px; }
    section { margin-top: 14px; }
    section h2 { font-size: 13pt; color: ${accent}; border-bottom: 2px solid ${accent}; padding-bottom: 3px; margin: 0 0 8px; text-align: ${align}; font-weight: 700; }
    @media print { .page { padding: 12mm 16mm 16mm; } }
    </style></head><body>${body}</body></html>`;
  }

  // ============================================================
  // TEMPLATE: CONSERVATIVE — centered classic, thin rules, Caps headings
  // ============================================================
  if (tpl === "conservative") {
    const body = `
  <div class="page">
    <header class="hdr">
      <h1>${escapeHtml(pi.full_name ?? "")}</h1>
      ${contactLine ? `<div class="contact">${contactLine}</div>` : ""}
    </header>
    ${orderedKeys.map(renderSection).join("\n")}
  </div>`;
    return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${escapeHtml(pi.full_name ?? "CV")}</title>${fontHead}<style>${baseStyles}
    .page { padding: 22mm 22mm; max-width: 210mm; margin: 0 auto; }
    .hdr { text-align: center; padding: 10px 0 12px; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; margin-bottom: 18px; }
    .hdr h1 { font-size: 22pt; margin: 0 0 4px; color: #111; font-weight: 600; letter-spacing: 1px; }
    .hdr .contact { color: #555; font-size: 10pt; }
    section { margin-top: 14px; }
    section h2 { font-size: 11pt; color: ${accent}; padding-bottom: 4px; margin: 0 0 8px; text-align: ${align}; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; border-bottom: 1px solid #d1d5db; }
    @media print { .page { padding: 18mm 18mm; } }
    </style></head><body>${body}</body></html>`;
  }

  // ============================================================
  // TEMPLATE: EXECUTIVE — two columns, dark navy sidebar
  // ============================================================
  // Skills + languages auto-go to sidebar; rest follow section_order in main.
  const sidebarKeys = new Set(["skills", "languages_structured"]);
  const mainKeys = orderedKeys.filter((k) => !sidebarKeys.has(k));

  const sidebarBlock = (key: string): string => {
    if (key === "skills") {
      const s = draft.skills ?? {};
      const parts: string[] = [];
      if (s.technical?.length) parts.push(`<div class="sb-group"><div class="sb-sub">${t.technical}</div><div class="sb-list">${(s.technical as string[]).map(escapeHtml).join("، ")}</div></div>`);
      if (s.soft?.length) parts.push(`<div class="sb-group"><div class="sb-sub">${t.soft}</div><div class="sb-list">${(s.soft as string[]).map(escapeHtml).join("، ")}</div></div>`);
      if (!parts.length) return "";
      return `<div class="sb-section"><div class="sb-h">${t.skills}</div>${parts.join("")}</div>`;
    }
    if (key === "languages_structured") {
      if (!langsHtml) return "";
      return `<div class="sb-section"><div class="sb-h">${t.languages}</div><ul class="sb-ul">${langsHtml}</ul></div>`;
    }
    return "";
  };

  // RTL: sidebar on right (start). LTR: sidebar on left (start). Use flex-direction natural.
  const body = `
  <div class="exec-page">
    <aside class="sidebar">
      <div class="sb-name">${escapeHtml(pi.full_name ?? "")}</div>
      <div class="sb-contact">
        ${pi.email ? `<div>${escapeHtml(pi.email)}</div>` : ""}
        ${pi.phone ? `<div>${escapeHtml(pi.phone)}</div>` : ""}
        ${pi.city ? `<div>${escapeHtml(pi.city)}</div>` : ""}
        ${pi.linkedin ? `<div style="word-break:break-all;">${escapeHtml(pi.linkedin)}</div>` : ""}
      </div>
      ${["skills", "languages_structured"].map(sidebarBlock).join("")}
    </aside>
    <main class="main">
      ${mainKeys.map(renderSection).join("\n")}
    </main>
  </div>`;
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${escapeHtml(pi.full_name ?? "CV")}</title>${fontHead}<style>${baseStyles}
    .exec-page { display: flex; min-height: 297mm; max-width: 210mm; margin: 0 auto; }
    .sidebar { width: 70mm; background: #0f172a; color: #f1f5f9; padding: 22mm 12mm; }
    .main { flex: 1; padding: 22mm 16mm; background: #fff; }
    .sb-name { font-size: 18pt; font-weight: 700; color: #fff; margin-bottom: 10px; border-bottom: 2px solid ${accent}; padding-bottom: 8px; }
    .sb-contact { font-size: 9.5pt; color: #cbd5e1; margin-bottom: 18px; line-height: 1.7; }
    .sb-section { margin-top: 14px; }
    .sb-h { font-size: 11pt; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 8px; }
    .sb-sub { font-size: 9.5pt; color: ${accent === "#1e3a8a" ? "#93c5fd" : "#cbd5e1"}; font-weight: 600; margin-top: 6px; }
    .sb-list { font-size: 9.5pt; color: #e2e8f0; line-height: 1.6; }
    .sb-ul { padding-${isAr ? "right" : "left"}: 14px; margin: 4px 0 0; }
    .sb-ul li { font-size: 9.5pt; color: #e2e8f0; }
    .sb-ul li strong { color: #fff; }
    .main section { margin-top: 14px; }
    .main section:first-child { margin-top: 0; }
    .main section h2 { font-size: 13pt; color: ${accent}; padding-bottom: 4px; margin: 0 0 8px; text-align: ${align}; font-weight: 700; border-bottom: 2px solid ${accent}; }
    @media print { .sidebar { padding: 18mm 10mm; } .main { padding: 18mm 14mm; } }
    </style></head><body>${body}</body></html>`;
}

// Merge two single-language HTML documents into one bilingual page.
// Strategy: take the body of each (everything inside <body>...</body>),
// stack into one document with a page-break between, and a shared <head>
// that pulls fonts for both scripts. Each body is wrapped in a section
// with its own dir so RTL/LTR behave correctly per page.
function mergeBilingual(arHtml: string, enHtml: string): string {
  const bodyOf = (full: string): string => {
    const m = full.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return m ? m[1] : full;
  };
  const arBody = bodyOf(arHtml);
  const enBody = bodyOf(enHtml);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>CV (AR + EN)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #111; }
    body { font-size: 11pt; line-height: 1.55; }
    .lang-section { padding: 24mm 20mm; max-width: 210mm; margin: 0 auto; }
    .lang-section[dir="rtl"] { font-family: 'Noto Naskh Arabic', 'Tajawal', serif; }
    .lang-section[dir="ltr"] { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
    .page-break { page-break-before: always; }
    @media print {
      .lang-section { padding: 18mm 16mm; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="lang-section" dir="rtl">${arBody}</div>
  <div class="lang-section page-break" dir="ltr">${enBody}</div>
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
    const draftLang = (draft as any).language as "ar" | "en" | "bilingual" | undefined;

    // Determine output: if draft is bilingual OR caller explicitly asks for bilingual,
    // produce a single merged PDF (Arabic pages first, then English).
    const wantsBilingual =
      body.language === "bilingual" || (draftLang === "bilingual" && !body.language);

    let html: string;
    if (wantsBilingual) {
      const arHtml = renderHtml(draft, "ar");
      const enHtml = renderHtml(draft, "en");
      html = mergeBilingual(arHtml, enHtml);
    } else {
      html = renderHtml(draft, requestedLang);
    }

    // Try to render via external service
    const pdfBytes = await htmlToPdfViaService(html);

    if (pdfBytes) {
      // Upload to storage and return signed URL
      const langSuffix = wantsBilingual ? "bilingual" : requestedLang;
      const filename = `exported/${user.id}/${draftId}_${langSuffix}_${Date.now()}.pdf`;
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
