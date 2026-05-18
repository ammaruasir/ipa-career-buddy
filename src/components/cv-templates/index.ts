// CV template registry — central source for templates + their metadata.
// Used by CVBuilder.PreviewStep (rendering) and CVHub.TemplateGallery (picker).

import ConservativeTemplate from "./ConservativeTemplate";
import ModernTemplate from "./ModernTemplate";
import ExecutiveTemplate from "./ExecutiveTemplate";
import type { CVTDraft, TemplateProps } from "./types";

export type CVTemplateKey = CVTDraft["template"]; // "conservative" | "modern" | "executive"

export interface TemplateMeta {
  key: CVTemplateKey;
  label_ar: string;
  label_en: string;
  description_ar: string;
  description_en: string;
  badge_ar?: string;
  badge_en?: string;
  Component: React.ComponentType<TemplateProps>;
  accent: string;
  bestFor_ar: string;
  bestFor_en: string;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    key: "modern",
    label_ar: "حديث",
    label_en: "Modern",
    description_ar: "تخطيط من عمودين بشريط جانبي للمهارات واللغات. عصري ومناسب للوظائف التقنية.",
    description_en: "2-column layout with a sidebar for skills and languages. Modern, fits tech roles.",
    badge_ar: "موصى به",
    badge_en: "Recommended",
    Component: ModernTemplate,
    accent: "#1e40af",
    bestFor_ar: "التقنية · الشركات الناشئة · متوسّطو الخبرة",
    bestFor_en: "Tech · Startups · Mid-career",
  },
  {
    key: "conservative",
    label_ar: "محافظ",
    label_en: "Conservative",
    description_ar: "عمود واحد بخطّ تقليدي. مثالي للوظائف الحكومية والأكاديمية والقانونية.",
    description_en: "Single-column with serif font. Ideal for government, academic, and legal roles.",
    Component: ConservativeTemplate,
    accent: "#374151",
    bestFor_ar: "الحكومي · الأكاديمي · القانوني",
    bestFor_en: "Government · Academic · Legal",
  },
  {
    key: "executive",
    label_ar: "تنفيذي",
    label_en: "Executive",
    description_ar: "شريط رأسي داكن مع طباعة كبيرة وملخّص بارز. لكبار القياديّين.",
    description_en: "Dark header band with large typography and highlighted summary. For senior leaders.",
    Component: ExecutiveTemplate,
    accent: "#1e3a8a",
    bestFor_ar: "كبار التنفيذيين · القيادات · أعضاء مجالس الإدارة",
    bestFor_en: "C-suite · Leadership · Board members",
  },
];

export function getTemplate(key: CVTemplateKey | undefined): TemplateMeta {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
}

export { ConservativeTemplate, ModernTemplate, ExecutiveTemplate };
export type { CVTDraft, TemplateProps } from "./types";
