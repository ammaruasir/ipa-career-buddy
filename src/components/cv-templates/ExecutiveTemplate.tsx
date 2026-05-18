// Executive template — dark header band with large name, highlighted summary block,
// generous whitespace, uppercase section headers. For senior leadership profiles.

import { cn } from "@/lib/utils";
import {
  type TemplateProps,
  cvtEffectiveLang,
  cvtResolveOrder,
  LABELS,
} from "./types";

const ACCENT = "#1e3a8a"; // navy

const ExecutiveTemplate = ({ draft, thumbnail = false }: TemplateProps) => {
  const lang = cvtEffectiveLang(draft);
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const t = LABELS[lang];
  const pi = draft.personal_info ?? {};
  const summary = isAr ? draft.summary?.ar : draft.summary?.en;

  const sectionH = "text-[11pt] font-bold uppercase tracking-[0.15em] pb-1 mb-3";

  const renderers: Record<string, () => React.ReactNode> = {
    summary: () =>
      summary ? (
        // Highlighted summary block instead of plain section
        <section className="mt-6">
          <div
            className="p-5 border-r-4 border-l-0"
            style={{ borderRightColor: ACCENT, backgroundColor: "#f8fafc" }}
          >
            <p className="text-[12pt] leading-relaxed text-gray-800 italic">{summary}</p>
          </div>
        </section>
      ) : null,

    experience: () =>
      draft.experience.length > 0 ? (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.experience}
          </h2>
          <div className="space-y-4">
            {draft.experience.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div>
                    <strong className="text-[13pt] text-gray-900 tracking-tight">{e.position}</strong>
                    <div className="text-[11pt] text-gray-700 mt-0.5">{e.company}</div>
                  </div>
                  <span className="text-[10pt] text-gray-600 whitespace-nowrap">
                    {e.start} – {e.end || t.present}
                  </span>
                </div>
                {e.bullets && (
                  <ul className="mt-2 space-y-1 list-none">
                    {e.bullets.map((b, bi) => (
                      <li key={bi} className="flex gap-3 text-[11pt] leading-relaxed text-gray-800">
                        <span className="opacity-50">—</span>
                        <span className="flex-1">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    education: () =>
      draft.education.length > 0 ? (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.education}
          </h2>
          <div className="space-y-2">
            {draft.education.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <strong className="text-[12pt] text-gray-900">
                    {e.degree} {e.major ? `${t.in} ${e.major}` : ""}
                  </strong>
                  <span className="text-[10pt] text-gray-600 whitespace-nowrap">
                    {e.start} – {e.end}
                  </span>
                </div>
                <p className="text-[10.5pt] text-gray-700">
                  {e.institution}{e.gpa ? ` · GPA ${e.gpa}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null,

    skills: () => {
      const s = draft.skills ?? {};
      if (!s.technical?.length && !s.soft?.length && !s.languages?.length) return null;
      return (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.skills}
          </h2>
          <div className="space-y-2 text-[11pt]">
            {s.technical?.length ? (
              <p><span className="font-semibold text-gray-900">{t.technical}:</span> <span className="text-gray-700">{s.technical.join("، ")}</span></p>
            ) : null}
            {s.soft?.length ? (
              <p><span className="font-semibold text-gray-900">{t.soft}:</span> <span className="text-gray-700">{s.soft.join("، ")}</span></p>
            ) : null}
            {s.languages?.length ? (
              <p><span className="font-semibold text-gray-900">{t.languagesPlain}:</span> <span className="text-gray-700">{s.languages.join("، ")}</span></p>
            ) : null}
          </div>
        </section>
      );
    },

    certifications: () =>
      draft.certifications.length > 0 ? (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.certifications}
          </h2>
          <ul className="space-y-1.5 list-none text-[11pt]">
            {draft.certifications.map((c, i) => (
              <li key={i} className="text-gray-800">
                <strong>{c.name}</strong>{c.issuer ? ` — ${c.issuer}` : ""}
                {c.date && <span className="text-gray-500"> ({c.date})</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null,

    volunteer: () => {
      const v = draft.custom_sections?.volunteer ?? [];
      if (v.length === 0) return null;
      return (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.volunteer}
          </h2>
          <div className="space-y-2">
            {v.map((it, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <strong className="text-[11.5pt] text-gray-900">{it.role}</strong>
                  <span className="text-[10pt] text-gray-600">{it.start} – {it.end}</span>
                </div>
                <p className="text-[10.5pt] text-gray-700">{it.organization}</p>
                {it.description && <p className="text-[10.5pt] text-gray-800 mt-0.5">{it.description}</p>}
              </div>
            ))}
          </div>
        </section>
      );
    },

    projects: () => {
      const p = draft.custom_sections?.projects ?? [];
      if (p.length === 0) return null;
      return (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.projects}
          </h2>
          <div className="space-y-2">
            {p.map((it, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <strong className="text-[11.5pt] text-gray-900">
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
                  <p className="text-[10pt] text-gray-600"><strong>{t.tech}:</strong> {it.tech.join("، ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      );
    },

    awards: () => {
      const a = draft.custom_sections?.awards ?? [];
      if (a.length === 0) return null;
      return (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.awards}
          </h2>
          <ul className="space-y-1.5 list-none text-[11pt]">
            {a.map((it, i) => (
              <li key={i} className="text-gray-800">
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

    languages_structured: () => {
      const l = draft.custom_sections?.languages_structured ?? [];
      if (l.length === 0) return null;
      return (
        <section className="mt-6">
          <h2 className={sectionH} style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}>
            {t.languages_structured}
          </h2>
          <ul className="space-y-1 list-none text-[11pt]">
            {l.map((it, i) => (
              <li key={i} className="text-gray-800">
                <strong>{it.name}</strong>
                {it.cefr && <span className="text-gray-600"> — {it.cefr === "native" ? t.native : it.cefr}</span>}
                {it.label && <span className="text-gray-500"> · {it.label}</span>}
              </li>
            ))}
          </ul>
        </section>
      );
    },
  };

  const ordered = cvtResolveOrder(draft.section_order);

  return (
    <div
      className={cn("bg-white text-black", isAr ? "font-arabic" : "font-serif", thumbnail && "text-[5pt] scale-100")}
      dir={dir}
      style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : "Georgia, 'Times New Roman', serif" }}
    >
      {/* Executive header band — dark navy, large typography, white text */}
      <div className="px-10 py-7 text-white" style={{ backgroundColor: ACCENT }}>
        <h1 className="text-[26pt] font-bold leading-tight tracking-tight">
          {pi.full_name || t.placeholderName}
        </h1>
        <p className="text-[10pt] text-white/85 mt-2 tracking-wide">
          {[pi.email, pi.phone, pi.city, pi.linkedin].filter(Boolean).join("    ·    ")}
        </p>
      </div>

      <div className="px-10 pb-8">
        {ordered.map((key) => (
          <div key={key}>{renderers[key]?.() ?? null}</div>
        ))}
      </div>
    </div>
  );
};

export default ExecutiveTemplate;
