// Modern template — 2-column layout. Sidebar with contact/skills/languages,
// main column with summary/experience/education/projects. Colored accent band.

import { cn } from "@/lib/utils";
import {
  type TemplateProps,
  cvtEffectiveLang,
  cvtResolveOrder,
  LABELS,
} from "./types";

const ACCENT = "#1e40af"; // blue-700

const ModernTemplate = ({ draft, thumbnail = false }: TemplateProps) => {
  const lang = cvtEffectiveLang(draft);
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const t = LABELS[lang];
  const pi = draft.personal_info ?? {};
  const summary = isAr ? draft.summary?.ar : draft.summary?.en;

  // Sections live in either sidebar or main. Order config controls main flow.
  const SIDEBAR_SECTIONS = new Set(["skills", "certifications", "languages_structured"]);
  const ordered = cvtResolveOrder(draft.section_order);
  const mainOrder = ordered.filter((k) => !SIDEBAR_SECTIONS.has(k));
  const sidebarOrder = ordered.filter((k) => SIDEBAR_SECTIONS.has(k));

  const mainH = "text-[12pt] font-bold mb-1.5 pb-0.5";
  const sidebarH = "text-[10pt] font-bold uppercase tracking-wider text-white/90 mb-2";

  // ── MAIN-COLUMN section renderers ─────────────────────────
  const mainRenderers: Record<string, () => React.ReactNode> = {
    summary: () =>
      summary ? (
        <section className="mb-4">
          <h2 className={mainH} style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
            {t.summary}
          </h2>
          <p className="text-[11pt] leading-relaxed text-gray-800">{summary}</p>
        </section>
      ) : null,

    experience: () =>
      draft.experience.length > 0 ? (
        <section className="mb-4">
          <h2 className={mainH} style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
            {t.experience}
          </h2>
          {draft.experience.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between items-baseline">
                <div>
                  <strong className="text-[11.5pt] text-gray-900">{e.position}</strong>
                  <span className="text-[10.5pt] text-gray-600"> · {e.company}</span>
                </div>
                <span className="text-[9.5pt] text-gray-500 whitespace-nowrap">
                  {e.start} – {e.end || t.present}
                </span>
              </div>
              {e.bullets && (
                <ul className="mt-1 space-y-0.5 list-none">
                  {e.bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-2 text-[10.5pt] leading-snug text-gray-800">
                      <span style={{ color: ACCENT }}>{isAr ? "◀" : "▶"}</span>
                      <span className="flex-1">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ) : null,

    education: () =>
      draft.education.length > 0 ? (
        <section className="mb-4">
          <h2 className={mainH} style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
            {t.education}
          </h2>
          {draft.education.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong className="text-[11pt] text-gray-900">
                  {e.degree} {e.major ? `${t.in} ${e.major}` : ""}
                </strong>
                <span className="text-[9.5pt] text-gray-500 whitespace-nowrap">
                  {e.start} – {e.end}
                </span>
              </div>
              <p className="text-[10pt] text-gray-700">{e.institution}{e.gpa ? ` · GPA ${e.gpa}` : ""}</p>
            </div>
          ))}
        </section>
      ) : null,

    volunteer: () => {
      const v = draft.custom_sections?.volunteer ?? [];
      if (v.length === 0) return null;
      return (
        <section className="mb-4">
          <h2 className={mainH} style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
            {t.volunteer}
          </h2>
          {v.map((it, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong className="text-[11pt] text-gray-900">{it.role}</strong>
                <span className="text-[9.5pt] text-gray-500">{it.start} – {it.end}</span>
              </div>
              <p className="text-[10pt] text-gray-700">{it.organization}</p>
              {it.description && <p className="text-[10.5pt] text-gray-800 mt-1">{it.description}</p>}
            </div>
          ))}
        </section>
      );
    },

    projects: () => {
      const p = draft.custom_sections?.projects ?? [];
      if (p.length === 0) return null;
      return (
        <section className="mb-4">
          <h2 className={mainH} style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
            {t.projects}
          </h2>
          {p.map((it, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between items-baseline gap-2">
                <strong className="text-[11pt] text-gray-900">
                  {it.name}{it.role ? ` — ${it.role}` : ""}
                </strong>
                {it.link && (
                  <a href={it.link} className="text-[9.5pt] truncate max-w-[40%]" dir="ltr" style={{ color: ACCENT }}>
                    {it.link.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              {it.description && <p className="text-[10.5pt] text-gray-800 mt-0.5">{it.description}</p>}
              {it.tech?.length ? (
                <p className="text-[9.5pt] text-gray-600 mt-0.5"><strong>{t.tech}:</strong> {it.tech.join("، ")}</p>
              ) : null}
            </div>
          ))}
        </section>
      );
    },

    awards: () => {
      const a = draft.custom_sections?.awards ?? [];
      if (a.length === 0) return null;
      return (
        <section className="mb-4">
          <h2 className={mainH} style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
            {t.awards}
          </h2>
          <ul className="space-y-1 list-none">
            {a.map((it, i) => (
              <li key={i} className="text-[10.5pt] text-gray-800">
                <strong>{it.title}</strong>
                {it.issuer && ` — ${it.issuer}`}
                {it.date && <span className="text-gray-500"> ({it.date})</span>}
                {it.description && <div className="text-[10pt] text-gray-600">{it.description}</div>}
              </li>
            ))}
          </ul>
        </section>
      );
    },
  };

  // ── SIDEBAR section renderers ─────────────────────────────
  const sidebarRenderers: Record<string, () => React.ReactNode> = {
    skills: () => {
      const s = draft.skills ?? {};
      if (!s.technical?.length && !s.soft?.length && !s.languages?.length) return null;
      return (
        <section className="mb-5">
          <h3 className={sidebarH}>{t.skills}</h3>
          <div className="space-y-2 text-white/90 text-[9.5pt]">
            {s.technical?.length ? (
              <div><div className="font-semibold opacity-80 text-[8.5pt] mb-0.5">{t.technical}</div>{s.technical.join("، ")}</div>
            ) : null}
            {s.soft?.length ? (
              <div><div className="font-semibold opacity-80 text-[8.5pt] mb-0.5">{t.soft}</div>{s.soft.join("، ")}</div>
            ) : null}
            {s.languages?.length ? (
              <div><div className="font-semibold opacity-80 text-[8.5pt] mb-0.5">{t.languagesPlain}</div>{s.languages.join("، ")}</div>
            ) : null}
          </div>
        </section>
      );
    },

    certifications: () =>
      draft.certifications.length > 0 ? (
        <section className="mb-5">
          <h3 className={sidebarH}>{t.certifications}</h3>
          <ul className="space-y-1 text-white/90 text-[9.5pt] list-none">
            {draft.certifications.map((c, i) => (
              <li key={i}>
                <div className="font-medium">{c.name}</div>
                <div className="opacity-70 text-[8.5pt]">{c.issuer}{c.date ? ` · ${c.date}` : ""}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null,

    languages_structured: () => {
      const l = draft.custom_sections?.languages_structured ?? [];
      if (l.length === 0) return null;
      return (
        <section className="mb-5">
          <h3 className={sidebarH}>{t.languages_structured}</h3>
          <ul className="space-y-1 text-white/90 text-[9.5pt] list-none">
            {l.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{it.name}</span>
                {it.cefr && (
                  <span className="opacity-80 text-[8.5pt] whitespace-nowrap">
                    {it.cefr === "native" ? t.native : it.cefr}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      );
    },
  };

  return (
    <div
      className={cn("bg-white text-black", isAr ? "font-arabic" : "font-sans", thumbnail && "text-[5pt] scale-100")}
      dir={dir}
      style={{ fontFamily: isAr ? "'Tajawal', 'Noto Naskh Arabic', sans-serif" : "'Inter', 'Helvetica Neue', sans-serif" }}
    >
      {/* Accent band header */}
      <div className="px-8 py-5" style={{ backgroundColor: ACCENT, color: "white" }}>
        <h1 className="text-[22pt] font-bold leading-tight">
          {pi.full_name || t.placeholderName}
        </h1>
        <p className="text-[10pt] text-white/85 mt-1">
          {[pi.email, pi.phone, pi.city, pi.linkedin].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* 2-column body */}
      <div className="grid grid-cols-[1fr_2.2fr] gap-0">
        {/* Sidebar */}
        <aside className="px-5 py-6" style={{ backgroundColor: "#1f3a8a", color: "white" }}>
          {sidebarOrder.map((key) => (
            <div key={key}>{sidebarRenderers[key]?.() ?? null}</div>
          ))}
        </aside>

        {/* Main column */}
        <main className="px-7 py-6">
          {mainOrder.map((key) => (
            <div key={key}>{mainRenderers[key]?.() ?? null}</div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default ModernTemplate;
