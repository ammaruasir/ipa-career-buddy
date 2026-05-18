import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Award,
  Eye,
  Loader2,
  Save,
  Plus,
  Trash2,
  Download,
  Palette,
  Activity,
  Target,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AIAssistBullets, AIAssistSummary, AIAssistSkills } from "@/components/cv-builder/AIAssistButton";

interface PersonalInfo {
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  nationality?: string;
  linkedin?: string;
}

interface ExperienceItem {
  company?: string;
  position?: string;
  start?: string;
  end?: string;
  bullets?: string[];
}

interface EducationItem {
  institution?: string;
  degree?: string;
  major?: string;
  start?: string;
  end?: string;
  gpa?: string;
}

interface Skills {
  technical?: string[];
  soft?: string[];
  languages?: string[];
}

interface CertItem {
  name?: string;
  issuer?: string;
  date?: string;
  link?: string;
}

interface Draft {
  id?: string;
  personal_info: PersonalInfo;
  summary: { ar?: string; en?: string };
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: Skills;
  certifications: CertItem[];
  template: "conservative" | "modern" | "executive";
  language: "ar" | "en" | "bilingual";
}

const STEPS = [
  { key: "personal", label: "البيانات الشخصية", icon: User },
  { key: "summary", label: "الملخّص", icon: FileText },
  { key: "experience", label: "الخبرة", icon: Briefcase },
  { key: "education", label: "التعليم", icon: GraduationCap },
  { key: "skills", label: "المهارات", icon: Wrench },
  { key: "certs", label: "الشهادات", icon: Award },
  { key: "preview", label: "المعاينة", icon: Eye },
] as const;

async function exportPdf(draft: Draft, _userId: string) {
  if (!draft.id) {
    toast.error("احفظ المسوّدة أوّلاً");
    return;
  }
  const lang: "ar" | "en" = draft.language === "en" ? "en" : "ar";
  try {
    toast.loading("جارٍ توليد PDF...", { id: "pdf-gen" });
    const { data, error } = await supabase.functions.invoke("render-cv-pdf", {
      body: { draft_id: draft.id, language: lang },
    });
    toast.dismiss("pdf-gen");
    if (error) throw error;
    if (data.mode === "pdf" && data.url) {
      window.open(data.url, "_blank");
      toast.success("تمّ توليد PDF");
    } else if (data.mode === "html" && data.html) {
      // Fallback: open in new window and trigger print
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(data.html);
        w.document.close();
        setTimeout(() => w.print(), 500);
        toast.info("افتح القائمة → طباعة → حفظ كـ PDF");
      }
    } else {
      toast.error("فشل توليد PDF");
    }
  } catch (e) {
    toast.dismiss("pdf-gen");
    console.error(e);
    toast.error("فشل توليد PDF");
  }
}

const EMPTY_DRAFT: Draft = {
  personal_info: {},
  summary: {},
  experience: [],
  education: [],
  skills: { technical: [], soft: [], languages: [] },
  certifications: [],
  template: "modern",
  language: "ar",
};

const CVBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get("draft");
  const { user, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing draft (by ?draft=id or latest); prefill from profile if new
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user) return;

    const load = async () => {
      // 1. If ?draft=id, load that specific draft
      if (draftIdParam) {
        const { data } = await supabase
          .from("cv_drafts")
          .select("*")
          .eq("id", draftIdParam)
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) {
          const d = data as any;
          setDraft({
            id: d.id,
            personal_info: d.personal_info ?? {},
            summary: d.summary ?? {},
            experience: d.experience ?? [],
            education: d.education ?? [],
            skills: d.skills ?? { technical: [], soft: [], languages: [] },
            certifications: d.certifications ?? [],
            template: d.template ?? "modern",
            language: d.language ?? "ar",
          });
          setLoading(false);
          return;
        }
      }

      // 2. Otherwise, load latest draft
      const { data } = await supabase
        .from("cv_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setDraft({
          id: d.id,
          personal_info: d.personal_info ?? {},
          summary: d.summary ?? {},
          experience: d.experience ?? [],
          education: d.education ?? [],
          skills: d.skills ?? { technical: [], soft: [], languages: [] },
          certifications: d.certifications ?? [],
          template: d.template ?? "modern",
          language: d.language ?? "ar",
        });
      } else {
        // 3. No drafts at all — prefill personal_info from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile) {
          setDraft((d) => ({
            ...d,
            personal_info: {
              full_name: (profile as any).full_name ?? "",
              email: (profile as any).email ?? "",
              phone: (profile as any).phone ?? "",
            },
          }));
        }
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate, draftIdParam]);

  // Debounced auto-save
  const saveDraft = useCallback(
    async (payload: Draft) => {
      if (!user) return;
      setSaving(true);
      try {
        if (payload.id) {
          await supabase
            .from("cv_drafts")
            .update({
              personal_info: payload.personal_info,
              summary: payload.summary,
              experience: payload.experience,
              education: payload.education,
              skills: payload.skills,
              certifications: payload.certifications,
              template: payload.template,
              language: payload.language,
            })
            .eq("id", payload.id);
        } else {
          const { data } = await supabase
            .from("cv_drafts")
            .insert({
              user_id: user.id,
              personal_info: payload.personal_info,
              summary: payload.summary,
              experience: payload.experience,
              education: payload.education,
              skills: payload.skills,
              certifications: payload.certifications,
              template: payload.template,
              language: payload.language,
            })
            .select()
            .single();
          if (data) setDraft((d) => ({ ...d, id: (data as any).id }));
        }
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  // Trigger debounced save when draft changes
  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(draft), 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, loading]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = STEPS[step].icon;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">منشئ السيرة الذاتية</h1>
          </div>
          <div className="flex items-center gap-3">
            {saving ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                جارٍ الحفظ...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="w-3 h-3" />
                محفوظ
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              العودة
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid lg:grid-cols-[1fr_460px] gap-6">
          <div className="space-y-6 min-w-0">
        {/* Step progress + Template + Language picker */}
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    خطوة {step + 1} / {STEPS.length}
                  </p>
                  <h2 className="font-semibold text-foreground truncate">{STEPS[step].label}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-normal">
                  {Math.round(progress)}%
                </Badge>
                {/* ATS Score badge */}
                <ATSScoreBadge draft={draft} />
              </div>
            </div>

            <Progress value={progress} className="h-2" />

            {/* Template + Language selector row */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <Palette className="w-3 h-3" />
                  القالب
                </Label>
                <Select value={draft.template} onValueChange={(v) => update("template", v as Draft["template"])}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">حديث</SelectItem>
                    <SelectItem value="conservative">محافظ</SelectItem>
                    <SelectItem value="executive">تنفيذي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  لغة الإخراج
                </Label>
                <Select value={draft.language} onValueChange={(v) => update("language", v as Draft["language"])}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">عربية</SelectItem>
                    <SelectItem value="en">إنجليزية</SelectItem>
                    <SelectItem value="bilingual">ثنائية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step content */}
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6 space-y-4">
            {step === 0 && (
              <PersonalStep
                value={draft.personal_info}
                onChange={(v) => update("personal_info", v)}
              />
            )}
            {step === 1 && (
              <SummaryStep
                value={draft.summary}
                onChange={(v) => update("summary", v)}
                fullProfile={{
                  personal_info: draft.personal_info,
                  experience: draft.experience,
                  education: draft.education,
                  skills: draft.skills,
                }}
                targetRole={(draft.personal_info as any)?.target_role}
                language={draft.language}
              />
            )}
            {step === 2 && (
              <ExperienceStep
                value={draft.experience}
                onChange={(v) => update("experience", v)}
                targetRole={(draft.personal_info as any)?.target_role}
                language={draft.language}
              />
            )}
            {step === 3 && (
              <EducationStep
                value={draft.education}
                onChange={(v) => update("education", v)}
              />
            )}
            {step === 4 && (
              <SkillsStep
                value={draft.skills}
                onChange={(v) => update("skills", v)}
                experience={draft.experience}
                education={draft.education}
                targetRole={(draft.personal_info as any)?.target_role}
                language={draft.language}
              />
            )}
            {step === 5 && (
              <CertsStep
                value={draft.certifications}
                onChange={(v) => update("certifications", v)}
              />
            )}
            {step === 6 && <PreviewStep draft={draft} />}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-xl"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            السابق
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-xl"
            >
              التالي
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          ) : (
            <Button onClick={() => exportPdf(draft, user?.id ?? "")} className="rounded-xl">
              <Download className="w-4 h-4 ml-2" />
              تصدير PDF
            </Button>
          )}
        </div>
          </div>

          {/* Sticky live preview on large screens */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Eye className="w-4 h-4 text-primary" />
                    معاينة حيّة
                  </div>
                  <Badge variant="outline" className="text-[10px]">{draft.template}</Badge>
                </div>
                <div className="max-h-[80vh] overflow-y-auto p-4">
                  <PreviewStep draft={draft} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Sub-step components
// ============================================================

const PersonalStep = ({
  value,
  onChange,
}: {
  value: PersonalInfo;
  onChange: (v: PersonalInfo) => void;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {[
      { key: "full_name", label: "الاسم الكامل", placeholder: "محمد عبدالله السعيد" },
      { key: "email", label: "البريد الإلكتروني", placeholder: "name@example.com", type: "email" },
      { key: "phone", label: "رقم الجوّال", placeholder: "+966 5XXXXXXXX", type: "tel" },
      { key: "city", label: "المدينة", placeholder: "الرياض" },
      { key: "nationality", label: "الجنسية", placeholder: "سعودي" },
      { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/username" },
    ].map((f) => (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          type={f.type ?? "text"}
          value={(value as any)[f.key] ?? ""}
          onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          placeholder={f.placeholder}
          dir={f.type === "email" || f.type === "tel" ? "ltr" : "rtl"}
        />
      </div>
    ))}
  </div>
);

const SummaryStep = ({
  value,
  onChange,
  fullProfile,
  targetRole,
  language,
}: {
  value: { ar?: string; en?: string };
  onChange: (v: { ar?: string; en?: string }) => void;
  fullProfile: any;
  targetRole?: string;
  language: "ar" | "en" | "bilingual";
}) => (
  <div className="space-y-4">
    <div className="space-y-1.5">
      <Label htmlFor="summary-ar">الملخّص (بالعربية)</Label>
      <Textarea
        id="summary-ar"
        value={value.ar ?? ""}
        onChange={(e) => onChange({ ...value, ar: e.target.value })}
        placeholder="3–5 أسطر تلخّص خبراتك ومجال تخصّصك وأهدافك المهنية..."
        rows={5}
        dir="rtl"
      />
      <p className="text-xs text-muted-foreground">
        نصيحة: ركّز على الإنجازات الكمّية وتجنّب المبالغات.
      </p>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="summary-en">Summary (English, optional)</Label>
      <Textarea
        id="summary-en"
        value={value.en ?? ""}
        onChange={(e) => onChange({ ...value, en: e.target.value })}
        rows={4}
        dir="ltr"
      />
    </div>

    {/* AI: improve or generate from profile */}
    <AIAssistSummary
      currentSummary={value.ar || value.en || ""}
      fullProfile={fullProfile}
      targetRole={targetRole}
      language={language}
      onAccept={(text, lang) => onChange({ ...value, [lang]: text })}
    />
  </div>
);

const ExperienceStep = ({
  value,
  onChange,
  targetRole,
  language,
}: {
  value: ExperienceItem[];
  onChange: (v: ExperienceItem[]) => void;
  targetRole?: string;
  language: "ar" | "en" | "bilingual";
}) => {
  const add = () => onChange([...value, {}]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ExperienceItem>) =>
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const acceptBullets = (idx: number, bullets: string[]) => {
    const existing = value[idx]?.bullets ?? [];
    updateItem(idx, { bullets: [...existing, ...bullets] });
  };

  return (
    <div className="space-y-4">
      {value.map((exp, idx) => (
        <Card key={idx} className="rounded-xl border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">خبرة {idx + 1}</Badge>
              <Button size="icon" variant="ghost" onClick={() => remove(idx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="الجهة"
                value={exp.company ?? ""}
                onChange={(e) => updateItem(idx, { company: e.target.value })}
              />
              <Input
                placeholder="المسمّى الوظيفي"
                value={exp.position ?? ""}
                onChange={(e) => updateItem(idx, { position: e.target.value })}
              />
              <Input
                placeholder="تاريخ البداية"
                value={exp.start ?? ""}
                onChange={(e) => updateItem(idx, { start: e.target.value })}
              />
              <Input
                placeholder="تاريخ النهاية (أو 'حتى الآن')"
                value={exp.end ?? ""}
                onChange={(e) => updateItem(idx, { end: e.target.value })}
              />
            </div>
            <Textarea
              placeholder="اكتب إنجازاتك (سطر لكل إنجاز) — أو وصفاً حرّاً ثم اضغط زرّ AI بالأسفل"
              value={(exp.bullets ?? []).join("\n")}
              onChange={(e) =>
                updateItem(idx, { bullets: e.target.value.split("\n").filter(Boolean) })
              }
              rows={4}
              dir="rtl"
            />

            {/* AI Assist: convert raw description to STAR bullets */}
            <AIAssistBullets
              role={exp.position || targetRole || ""}
              rawDescription={(exp.bullets ?? []).join("\n")}
              language={language}
              onAccept={(bullets) => acceptBullets(idx, bullets)}
            />
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full rounded-xl">
        <Plus className="w-4 h-4 ml-2" />
        إضافة خبرة
      </Button>
    </div>
  );
};

const EducationStep = ({
  value,
  onChange,
}: {
  value: EducationItem[];
  onChange: (v: EducationItem[]) => void;
}) => {
  const add = () => onChange([...value, {}]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<EducationItem>) =>
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-4">
      {value.map((ed, idx) => (
        <Card key={idx} className="rounded-xl border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">مؤهّل {idx + 1}</Badge>
              <Button size="icon" variant="ghost" onClick={() => remove(idx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="المؤسّسة التعليمية"
                value={ed.institution ?? ""}
                onChange={(e) => updateItem(idx, { institution: e.target.value })}
              />
              <Input
                placeholder="الدرجة (بكالوريوس / ماجستير...)"
                value={ed.degree ?? ""}
                onChange={(e) => updateItem(idx, { degree: e.target.value })}
              />
              <Input
                placeholder="التخصّص"
                value={ed.major ?? ""}
                onChange={(e) => updateItem(idx, { major: e.target.value })}
              />
              <Input
                placeholder="المعدّل (اختياري)"
                value={ed.gpa ?? ""}
                onChange={(e) => updateItem(idx, { gpa: e.target.value })}
              />
              <Input
                placeholder="تاريخ البداية"
                value={ed.start ?? ""}
                onChange={(e) => updateItem(idx, { start: e.target.value })}
              />
              <Input
                placeholder="تاريخ التخرّج"
                value={ed.end ?? ""}
                onChange={(e) => updateItem(idx, { end: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full rounded-xl">
        <Plus className="w-4 h-4 ml-2" />
        إضافة مؤهّل
      </Button>
    </div>
  );
};

const SkillsStep = ({
  value,
  onChange,
  experience,
  education,
  targetRole,
  language,
}: {
  value: Skills;
  onChange: (v: Skills) => void;
  experience: ExperienceItem[];
  education: EducationItem[];
  targetRole?: string;
  language: "ar" | "en" | "bilingual";
}) => {
  const tagInput = (
    label: string,
    key: keyof Skills,
    placeholder: string,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        value={(value[key] ?? []).join("، ")}
        onChange={(e) =>
          onChange({
            ...value,
            [key]: e.target.value
              .split(/،|,/)
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder={placeholder}
        rows={2}
        dir="rtl"
      />
      <p className="text-xs text-muted-foreground">افصل بين العناصر بفاصلة</p>
    </div>
  );

  const mergeSkills = (suggested: { technical?: string[]; soft?: string[]; languages?: string[] }) => {
    const dedupe = (arr: string[]) => Array.from(new Set(arr));
    onChange({
      technical: dedupe([...(value.technical ?? []), ...(suggested.technical ?? [])]),
      soft: dedupe([...(value.soft ?? []), ...(suggested.soft ?? [])]),
      languages: dedupe([...(value.languages ?? []), ...(suggested.languages ?? [])]),
    });
  };

  return (
    <div className="space-y-4">
      {tagInput("المهارات التقنية", "technical", "Python، إدارة قواعد البيانات، Excel متقدّم")}
      {tagInput("المهارات الشخصية", "soft", "العمل الجماعي، إدارة الوقت، التواصل")}
      {tagInput("اللغات", "languages", "العربية (الأم)، الإنجليزية (طلاقة)")}

      {/* AI: suggest skills based on profile */}
      <AIAssistSkills
        experience={experience}
        education={education}
        targetRole={targetRole}
        language={language}
        onAccept={mergeSkills}
      />
    </div>
  );
};

const CertsStep = ({
  value,
  onChange,
}: {
  value: CertItem[];
  onChange: (v: CertItem[]) => void;
}) => {
  const add = () => onChange([...value, {}]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<CertItem>) =>
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-4">
      {value.map((c, idx) => (
        <Card key={idx} className="rounded-xl border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">شهادة {idx + 1}</Badge>
              <Button size="icon" variant="ghost" onClick={() => remove(idx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="اسم الشهادة"
                value={c.name ?? ""}
                onChange={(e) => updateItem(idx, { name: e.target.value })}
              />
              <Input
                placeholder="الجهة المانحة"
                value={c.issuer ?? ""}
                onChange={(e) => updateItem(idx, { issuer: e.target.value })}
              />
              <Input
                placeholder="تاريخ الإصدار"
                value={c.date ?? ""}
                onChange={(e) => updateItem(idx, { date: e.target.value })}
              />
              <Input
                placeholder="رابط التحقّق (اختياري)"
                value={c.link ?? ""}
                onChange={(e) => updateItem(idx, { link: e.target.value })}
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full rounded-xl">
        <Plus className="w-4 h-4 ml-2" />
        إضافة شهادة
      </Button>
    </div>
  );
};

// =============================================================================
// ATSScoreBadge — lightweight client-side score (0-100)
// Components: completeness + STAR density (avg bullet length) + ATS-friendliness
// =============================================================================
const ATSScoreBadge = ({ draft }: { draft: Draft }) => {
  const score = computeAtsScore(draft);
  const color =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : score >= 60
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
  return (
    <Badge
      variant="outline"
      className={cn("font-normal flex items-center gap-1", color)}
      title="درجة جودة السيرة المقدّرة (مبنية على الاكتمال + الأرقام + ATS-friendliness)"
    >
      <Activity className="w-3 h-3" />
      ATS: {score}/100
    </Badge>
  );
};

function computeAtsScore(d: Draft): number {
  let s = 0;
  // Completeness — 40 pts
  if (d.personal_info?.full_name) s += 6;
  if (d.personal_info?.email) s += 6;
  if (d.personal_info?.phone) s += 6;
  if (d.summary?.ar || d.summary?.en) s += 8;
  if ((d.experience ?? []).length > 0) s += 8;
  if ((d.education ?? []).length > 0) s += 6;

  // STAR density: bullets that contain numbers → +1 each up to 20
  const allBullets = (d.experience ?? []).flatMap((e: any) => e.bullets ?? []);
  const quantifiedCount = allBullets.filter((b: string) => /\d/.test(b)).length;
  s += Math.min(20, quantifiedCount * 2);

  // Skills coverage — 20 pts
  const techCount = (d.skills?.technical ?? []).length;
  s += Math.min(10, techCount);
  if ((d.skills?.languages ?? []).length > 0) s += 5;
  if ((d.skills?.soft ?? []).length > 0) s += 5;

  // Penalty for missing critical
  if (allBullets.length === 0) s -= 5;
  if (allBullets.some((b: string) => b.length > 250)) s -= 5; // bullets too long

  return Math.max(0, Math.min(100, Math.round(s)));
}

const PreviewStep = ({ draft }: { draft: Draft }) => (
  <div className="space-y-4">
    <div className="p-6 rounded-xl bg-white text-black dark:bg-white dark:text-black border-4 border-double border-primary/30 space-y-4 font-arabic" dir="rtl">
      <div className="text-center pb-3 border-b-2 border-primary/30">
        <h1 className="text-2xl font-bold">{draft.personal_info.full_name || "اسم المتقدّم"}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {[draft.personal_info.email, draft.personal_info.phone, draft.personal_info.city]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>

      {draft.summary?.ar && (
        <section>
          <h2 className="text-lg font-bold border-b border-primary/30 pb-1 mb-2">الملخّص</h2>
          <p className="text-sm leading-relaxed">{draft.summary.ar}</p>
        </section>
      )}

      {draft.experience.length > 0 && (
        <section>
          <h2 className="text-lg font-bold border-b border-primary/30 pb-1 mb-2">الخبرة العمليّة</h2>
          {draft.experience.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between">
                <strong className="text-sm">{e.position}</strong>
                <span className="text-xs text-gray-600">
                  {e.start} – {e.end}
                </span>
              </div>
              <p className="text-sm text-gray-700">{e.company}</p>
              {e.bullets && (
                <ul className="text-sm mt-1 space-y-0.5">
                  {e.bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-2">
                      <span>•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {draft.education.length > 0 && (
        <section>
          <h2 className="text-lg font-bold border-b border-primary/30 pb-1 mb-2">التعليم</h2>
          {draft.education.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <strong className="text-sm">{e.degree} في {e.major}</strong>
                <span className="text-xs text-gray-600">
                  {e.start} – {e.end}
                </span>
              </div>
              <p className="text-sm text-gray-700">{e.institution}</p>
            </div>
          ))}
        </section>
      )}

      {(draft.skills.technical?.length || draft.skills.soft?.length || draft.skills.languages?.length) ? (
        <section>
          <h2 className="text-lg font-bold border-b border-primary/30 pb-1 mb-2">المهارات</h2>
          {draft.skills.technical && draft.skills.technical.length > 0 && (
            <p className="text-sm mb-1"><strong>تقنية:</strong> {draft.skills.technical.join("، ")}</p>
          )}
          {draft.skills.soft && draft.skills.soft.length > 0 && (
            <p className="text-sm mb-1"><strong>شخصية:</strong> {draft.skills.soft.join("، ")}</p>
          )}
          {draft.skills.languages && draft.skills.languages.length > 0 && (
            <p className="text-sm"><strong>اللغات:</strong> {draft.skills.languages.join("، ")}</p>
          )}
        </section>
      ) : null}

      {draft.certifications.length > 0 && (
        <section>
          <h2 className="text-lg font-bold border-b border-primary/30 pb-1 mb-2">الشهادات</h2>
          <ul className="text-sm space-y-1">
            {draft.certifications.map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong> — {c.issuer} ({c.date})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>

    <p className={cn("text-xs text-muted-foreground text-center")}>
      هذه معاينة على الشاشة. تصدير PDF عربي بجودة عالية يحتاج اختبار RTL إضافي.
    </p>
  </div>
);

export default CVBuilder;
