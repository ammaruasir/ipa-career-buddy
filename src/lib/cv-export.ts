import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from "docx";
import { saveAs } from "file-saver";

export type CVLang = "ar" | "en";

export interface CVSection {
  title: string;
  paragraphs: string[]; // each line/bullet
}

export interface CVDocumentData {
  fullName: string;
  contact?: string; // email | phone | city
  sections: CVSection[];
}

export interface CVExportOptions {
  language?: CVLang;
}

/* ============ Digit localization ============ */

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export const toArabicDigits = (s: string): string =>
  (s ?? "").replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);

export const toEnglishDigits = (s: string): string =>
  (s ?? "").replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

export const localizeDigits = (s: string, lang: CVLang): string =>
  lang === "ar" ? toArabicDigits(s) : toEnglishDigits(s);

const localizeData = (data: CVDocumentData, lang: CVLang): CVDocumentData => ({
  fullName: localizeDigits(data.fullName, lang),
  contact: data.contact ? localizeDigits(data.contact, lang) : data.contact,
  sections: data.sections.map((s) => ({
    title: localizeDigits(s.title, lang),
    paragraphs: s.paragraphs.map((p) => localizeDigits(p, lang)),
  })),
});

/* ============ Build improved CV from extraction + accepted rewrites ============ */

export interface AcceptedRewrite {
  original: string;
  improved: string;
}

const applyRewritesToText = (text: string, rewrites: AcceptedRewrite[]): string => {
  if (!text) return text;
  let out = text;
  for (const r of rewrites) {
    if (r.original && out.includes(r.original)) {
      out = out.split(r.original).join(r.improved);
    }
  }
  return out;
};

const asStringArray = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          if (o.text) return String(o.text);
          if (o.title || o.role || o.position) {
            const parts = [
              o.title || o.role || o.position,
              o.company || o.organization,
              o.period || o.dates || o.duration,
            ]
              .filter(Boolean)
              .join(" — ");
            const desc = o.description || o.details;
            return desc ? `${parts}\n${desc}` : parts;
          }
          if (o.degree) {
            return [o.degree, o.institution || o.school, o.year || o.period]
              .filter(Boolean)
              .join(" — ");
          }
          return Object.values(o).filter(Boolean).join(" — ");
        }
        return String(x);
      })
      .filter(Boolean);
  }
  if (typeof v === "string") return v.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>)
      .map((x) => (typeof x === "string" ? x : ""))
      .filter(Boolean);
  }
  return [];
};

export const buildImprovedCV = (
  extraction: any,
  acceptedRewrites: AcceptedRewrite[],
  fallbackName?: string,
): CVDocumentData => {
  const e = extraction || {};
  const personal = e.personal_info || e.contact || {};
  const fullName =
    personal.full_name || personal.name || e.full_name || fallbackName || "السيرة الذاتية";
  const contact = [personal.email, personal.phone, personal.city, personal.location]
    .filter(Boolean)
    .join("  •  ");

  const apply = (s: string) => applyRewritesToText(s, acceptedRewrites);

  const sections: CVSection[] = [];

  const summary = e.summary?.text || e.summary || "";
  if (typeof summary === "string" && summary.trim()) {
    sections.push({ title: "الملخّص المهني", paragraphs: [apply(summary)] });
  }

  const exp = asStringArray(e.experience).map(apply);
  if (exp.length) sections.push({ title: "الخبرة العملية", paragraphs: exp });

  const edu = asStringArray(e.education).map(apply);
  if (edu.length) sections.push({ title: "التعليم", paragraphs: edu });

  const skills = asStringArray(e.skills).map(apply);
  if (skills.length) sections.push({ title: "المهارات", paragraphs: skills });

  const ach = asStringArray(e.achievements).map(apply);
  if (ach.length) sections.push({ title: "الإنجازات", paragraphs: ach });

  const certs = asStringArray(e.certifications).map(apply);
  if (certs.length) sections.push({ title: "الشهادات", paragraphs: certs });

  return { fullName, contact, sections };
};

/* ============ DOCX Export ============ */

export const exportToDocx = async (
  rawData: CVDocumentData,
  filename = "cv.docx",
  opts: CVExportOptions = {},
) => {
  const lang: CVLang = opts.language ?? "ar";
  const data = localizeData(rawData, lang);
  const rtl = lang === "ar";
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      bidirectional: rtl,
      alignment: align,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text, bold: true, font: "Arial", size: 28, rightToLeft: rtl })],
    });

  const body = (text: string) =>
    new Paragraph({
      bidirectional: rtl,
      alignment: align,
      spacing: { after: 100 },
      children: [new TextRun({ text, font: "Arial", size: 24, rightToLeft: rtl })],
    });

  const bullet = (text: string) =>
    new Paragraph({
      bidirectional: rtl,
      alignment: align,
      spacing: { after: 80 },
      numbering: { reference: "bullets", level: 0 },
      children: [new TextRun({ text, font: "Arial", size: 24, rightToLeft: rtl })],
    });

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      bidirectional: rtl,
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: data.fullName, bold: true, font: "Arial", size: 40, rightToLeft: rtl }),
      ],
    }),
  );

  if (data.contact) {
    children.push(
      new Paragraph({
        bidirectional: rtl,
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({ text: data.contact, font: "Arial", size: 20, color: "555555", rightToLeft: rtl }),
        ],
      }),
    );
  }

  for (const s of data.sections) {
    children.push(heading(s.title));
    for (const p of s.paragraphs) {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        children.push(body(lines[0]));
        for (const l of lines.slice(1)) children.push(bullet(l));
      } else {
        children.push(bullet(p));
      }
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: align,
              style: {
                paragraph: {
                  indent: rtl ? { right: 720, hanging: 360 } : { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
};

/* ============ PDF Export (via print dialog – preserves Arabic perfectly) ============ */

export const exportToPdf = (
  rawData: CVDocumentData,
  filename = "cv.pdf",
  opts: CVExportOptions = {},
) => {
  const lang: CVLang = opts.language ?? "ar";
  const data = localizeData(rawData, lang);
  const rtl = lang === "ar";

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    throw new Error(
      rtl
        ? "نافذة الطباعة محظورة من المتصفح. فعّل النوافذ المنبثقة وحاول مجدداً."
        : "Print window blocked by the browser. Enable popups and try again.",
    );
  }
  const sectionHtml = data.sections
    .map(
      (s) => `
      <section>
        <h2>${escapeHtml(s.title)}</h2>
        <ul>
          ${s.paragraphs
            .map((p) =>
              p
                .split("\n")
                .map((line) => `<li>${escapeHtml(line)}</li>`)
                .join(""),
            )
            .join("")}
        </ul>
      </section>`,
    )
    .join("");

  const htmlLang = rtl ? "ar" : "en";
  const htmlDir = rtl ? "rtl" : "ltr";
  const fontStack = rtl
    ? `"Tahoma", "Arial", "Segoe UI", sans-serif`
    : `"Calibri", "Arial", "Segoe UI", sans-serif`;
  const ulSidePad = rtl ? "padding-right: 18px; padding-left: 0;" : "padding-left: 18px; padding-right: 0;";

  w.document.write(`<!doctype html>
<html lang="${htmlLang}" dir="${htmlDir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(filename)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${fontStack};
    color: #111827;
    line-height: 1.7;
    margin: 0;
    padding: 24px;
  }
  h1 { text-align: center; font-size: 26px; margin: 0 0 4px; }
  .contact { text-align: center; color: #555; font-size: 13px; margin-bottom: 20px; }
  h2 {
    font-size: 16px;
    border-bottom: 2px solid #0c2340;
    padding-bottom: 4px;
    margin: 18px 0 8px;
    color: #0c2340;
  }
  ul { ${ulSidePad} margin: 4px 0 12px; }
  li { margin-bottom: 4px; font-size: 13px; white-space: pre-wrap; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(data.fullName)}</h1>
  ${data.contact ? `<div class="contact">${escapeHtml(data.contact)}</div>` : ""}
  ${sectionHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`);
  w.document.close();
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
