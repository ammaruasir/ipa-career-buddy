// Conservative template — single column, serif, formal government/academic feel.

import { cn } from "@/lib/utils";
import {
  type TemplateProps,
  cvtEffectiveLang,
  cvtResolveOrder,
  LABELS,
} from "./types";

const ConservativeTemplate = ({ draft, thumbnail = false }: TemplateProps) => {
  const lang = cvtEffectiveLang(draft);
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const t = LABELS[lang];
  const pi = draft.personal_info ?? {};
  const summary = isAr ? draft.summary?.ar : draft.summary?.en;

  const sectionH = "text-base font-bold border-b border-gray-700 pb-0.5 mb-2 uppercase tracking-wide";
  const baseText = "text-[11pt] leading-relaxed";

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    summary: () =>
      summary ? (
        <section className="mt-4">
          <h2 className={sectionH}>{t.summary}</h2>
          <p className={baseText}>{summary}</p>
        </section>
      ) : null,

    experience: () =>
      draft.experience.length > 0 ? (
        <section className="mt-4">
          <h2 className={sectionH}>{t.experience}</h2>
          {draft.experience.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between items-baseline">
                <strong className={baseText}>{e.position}</strong>
                <span className="text-[10pt] text-gray-600">
                  {e.start} – {e.end || t.present}
                </span>
              </div>
              <p className="text-[10.5pt] text-gray-700 italic">{e.company}</p>
              {e.bullets && (
                <ul className="mt-1 space-y-0.5 list-none">
                  {e.bullets.map((b, bi) => (
                    <li key={bi} className={cn("flex gap-2", baseText)}>
                      <span>•</span>
                      <span>{b}</span>
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
        <section className="mt-4">
          <h2 className={sectionH}>{t.education}</h2>
          {draft.education.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong className={baseText}>
                  {e.degree} {e.major ? `${t.in} ${e.major}` : ""}
                </strong>
                <span className="text-[10pt] text-gray-600">
                  {e.start} – {e.end}
                </span>
              </div>
              <p className="text-[10.5pt] text-gray-700 italic">
                {e.institution}{e.gpa ? ` · GPA ${e.gpa}` : ""}
              </p>
            </div>
          ))}
        </section>
      ) : null,

    skills: () => {
      const s = draft.skills ?? {};
      if (!s.technical?.length && !s.soft?.length && !s.languages?.length) return null;
      return (
        <section className="mt-4">
          <h2 className={sectionH}>{t.skills}</h2>
          {s.technical?.length ? (
            <p className={baseText}><strong>{t.technical}:</strong> {s.technical.join("، ")}</p>
          ) : null}
          {s.soft?.length ? (
            <p className={baseText}><strong>{t.soft}:</strong> {s.soft.join("، ")}</p>
          ) : null}
          {s.languages?.length ? (
            <p className={baseText}><strong>{t.languagesPlain}:</strong> {s.languages.join("، ")}</p>
          ) : null}
        </section>
      );
    },

    certifications: () =>
      draft.certifications.length > 0 ? (
        <section className="mt-4">
          <h2 className={sectionH}>{t.certifications}</h2>
          <ul className="space-y-1 list-none">
            {draft.certifications.map((c, i) => (
              <li key={i} className={baseText}>
                <strong>{c.name}</strong>{c.issuer ? ` — ${c.issuer}` : ""}{c.date ? ` (${c.date})` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null,

    volunteer: () => {
      const v = draft.custom_sections?.volunteer ?? [];
      if (v.length === 0) return null;
      return (
        <section className="mt-4">
          <h2 className={sectionH}>{t.volunteer}</h2>
          {v.map((it, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong className={baseText}>{it.role}</strong>
                <span className="text-[10pt] text-gray-600">{it.start} – {it.end}</span>
              </div>
              <p className="text-[10.5pt] text-gray-700 italic">{it.organization}</p>
              {it.description && <p className={baseText}>{it.description}</p>}
            </div>
          ))}
        </section>
      );
    },

    projects: () => {
      const p = draft.custom_sections?.projects ?? [];
      if (p.length === 0) return null;
      return (
        <section className="mt-4">
          <h2 className={sectionH}>{t.projects}</h2>
          {p.map((it, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between items-baseline gap-2">
                <strong className={baseText}>{it.name}{it.role ? ` — ${it.role}` : ""}</strong>
                {it.link && (
                  <span className="text-[9.5pt] text-gray-600 truncate max-w-[40%]" dir="ltr">
                    {it.link.replace(/^https?:\/\//, "")}
                  </span>
                )}
              </div>
              {it.description && <p className={baseText}>{it.description}</p>}
              {it.tech?.length ? (
                <p className="text-[10pt] text-gray-600"><strong>{t.tech}:</strong> {it.tech.join("، ")}</p>
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
        <section className="mt-4">
          <h2 className={sectionH}>{t.awards}</h2>
          <ul className="space-y-1 list-none">
            {a.map((it, i) => (
              <li key={i} className={baseText}>
                <strong>{it.title}</strong>
                {it.issuer && ` — ${it.issuer}`}
                {it.date && <span className="text-gray-600"> ({it.date})</span>}
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
        <section className="mt-4">
          <h2 className={sectionH}>{t.languages_structured}</h2>
          <ul className="space-y-0.5 list-none">
            {l.map((it, i) => (
              <li key={i} className={baseText}>
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
      className={cn(
        "bg-white text-black p-8",
        isAr ? "font-arabic" : "font-serif",
        thumbnail && "text-[5pt] p-2 scale-100",
      )}
      dir={dir}
      style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : "Georgia, 'Times New Roman', serif" }}
    >
      {/* Centered header — no color band, conservative aesthetic */}
      <div className="text-center pb-4 mb-2 border-b-2 border-gray-700">
        <h1 className="text-2xl font-bold tracking-wide">
          {pi.full_name || t.placeholderName}
        </h1>
        <p className="text-[10pt] text-gray-700 mt-1">
          {[pi.email, pi.phone, pi.city, pi.linkedin].filter(Boolean).join(" · ")}
        </p>
      </div>

      {ordered.map((key) => (
        <div key={key}>{sectionRenderers[key]?.() ?? null}</div>
      ))}
    </div>
  );
};

export default ConservativeTemplate;
