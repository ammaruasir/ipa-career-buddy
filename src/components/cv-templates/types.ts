// Shared types for CV template components.
// Mirrors the Draft shape in CVBuilder.tsx so templates can render the same data.

export interface CVTPersonalInfo {
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  nationality?: string;
  linkedin?: string;
}

export interface CVTExperienceItem {
  company?: string;
  position?: string;
  start?: string;
  end?: string;
  bullets?: string[];
}

export interface CVTEducationItem {
  institution?: string;
  degree?: string;
  major?: string;
  start?: string;
  end?: string;
  gpa?: string;
}

export interface CVTSkills {
  technical?: string[];
  soft?: string[];
  languages?: string[];
}

export interface CVTCertItem {
  name?: string;
  issuer?: string;
  date?: string;
  link?: string;
}

export interface CVTVolunteerItem {
  organization?: string;
  role?: string;
  start?: string;
  end?: string;
  description?: string;
}

export interface CVTAwardItem {
  title?: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface CVTProjectItem {
  name?: string;
  role?: string;
  link?: string;
  description?: string;
  tech?: string[];
}

export interface CVTLanguageStructured {
  name?: string;
  cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "native";
  label?: string;
}

export interface CVTCustomSections {
  volunteer?: CVTVolunteerItem[];
  awards?: CVTAwardItem[];
  projects?: CVTProjectItem[];
  languages_structured?: CVTLanguageStructured[];
}

export interface CVTDraft {
  id?: string;
  personal_info: CVTPersonalInfo;
  summary: { ar?: string; en?: string };
  experience: CVTExperienceItem[];
  education: CVTEducationItem[];
  skills: CVTSkills;
  certifications: CVTCertItem[];
  custom_sections: CVTCustomSections;
  section_order: string[] | null;
  template: "conservative" | "modern" | "executive";
  language: "ar" | "en" | "bilingual";
}

export type CVTSectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "volunteer"
  | "projects"
  | "awards"
  | "languages_structured";

const DEFAULT_ORDER: CVTSectionKey[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "volunteer",
  "projects",
  "awards",
  "languages_structured",
];

export function cvtResolveOrder(stored: string[] | null | undefined): CVTSectionKey[] {
  const base = (stored ?? []).filter((k): k is CVTSectionKey =>
    (DEFAULT_ORDER as readonly string[]).includes(k),
  );
  const missing = DEFAULT_ORDER.filter((k) => !base.includes(k));
  return [...base, ...missing];
}

export function cvtEffectiveLang(draft: CVTDraft): "ar" | "en" {
  if (draft.language === "en") return "en";
  return "ar";
}

export interface TemplateProps {
  draft: CVTDraft;
  /** Render at a smaller scale for gallery thumbnails. */
  thumbnail?: boolean;
}

// Labels for both languages used across all templates
export const LABELS = {
  ar: {
    summary: "الملخّص",
    experience: "الخبرة العمليّة",
    education: "التعليم",
    skills: "المهارات",
    certifications: "الشهادات",
    volunteer: "العمل التطوّعي",
    projects: "المشاريع",
    awards: "الجوائز والتقديرات",
    languages_structured: "اللغات",
    technical: "تقنية",
    soft: "شخصية",
    languagesPlain: "اللغات",
    contact: "التواصل",
    present: "حتى الآن",
    placeholderName: "اسم المتقدّم",
    in: "في",
    tech: "التقنيات",
    native: "الأم",
  },
  en: {
    summary: "Summary",
    experience: "Work Experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
    volunteer: "Volunteer Work",
    projects: "Projects",
    awards: "Awards & Recognition",
    languages_structured: "Languages",
    technical: "Technical",
    soft: "Soft",
    languagesPlain: "Languages",
    contact: "Contact",
    present: "Present",
    placeholderName: "Applicant Name",
    in: "in",
    tech: "Tech",
    native: "Native",
  },
} as const;
