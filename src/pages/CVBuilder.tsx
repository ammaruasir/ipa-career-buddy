import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIAssistBullets } from "@/components/cv-builder/AIAssistButton";
import { ProofreadInput, ProofreadTextarea } from "@/components/cv-builder/ProofreadInput";
import { useProfilePrefill } from "@/hooks/useProfilePrefill";

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
  const { user, loading: authLoading } = useAuth();
  const prefill = useProfilePrefill();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing draft (or seed a fresh one from the user profile)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user) return;
    if (!prefill.loaded) return; // wait for profile so seeding is correct

    const load = async () => {
      const { data } = await supabase
        .from("cv_drafts" as any)
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
        // Fresh draft → seed personal info + first education row from profile
        setDraft({
          ...EMPTY_DRAFT,
          personal_info: { ...prefill.personal_info },
          education: prefill.education.length > 0 ? [...prefill.education] : [],
        });
        toast.success("تم تعبئة بعض الحقول من ملفك الشخصي — يمكنك تعديلها");
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate, prefill.loaded]);

  // Debounced auto-save
  const saveDraft = useCallback(
    async (payload: Draft) => {
      if (!user) return;
      setSaving(true);
      try {
        if (payload.id) {
          await supabase
            .from("cv_drafts" as any)
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
            .from("cv_drafts" as any)
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

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        {/* Step progress */}
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    خطوة {step + 1} / {STEPS.length}
                  </p>
                  <h2 className="font-semibold text-foreground">{STEPS[step].label}</h2>
                </div>
              </div>
              <Badge variant="outline" className="font-normal">
                {Math.round(progress)}%
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
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
            <Button
              onClick={() =>
                toast.info("تصدير PDF عربي قيد التطوير — يتطلّب اختبار جودة RTL.")
              }
              className="rounded-xl"
            >
              <Download className="w-4 h-4 ml-2" />
              تصدير PDF (قريباً)
            </Button>
          )}
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
      { key: "full_name", label: "الاسم الكامل", placeholder: "محمد عبدالله السعيد", ctx: "name" as const },
      { key: "email", label: "البريد الإلكتروني", placeholder: "name@example.com", type: "email", ctx: null },
      { key: "phone", label: "رقم الجوّال", placeholder: "+966 5XXXXXXXX", type: "tel", ctx: null },
      { key: "city", label: "المدينة", placeholder: "الرياض", ctx: "name" as const },
      { key: "nationality", label: "الجنسية", placeholder: "سعودي", ctx: "name" as const },
      { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/username", ctx: null },
    ].map((f) => (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={f.key}>{f.label}</Label>
        <ProofreadInput
          id={f.key}
          type={f.type ?? "text"}
          value={(value as any)[f.key] ?? ""}
          onChange={(v) => onChange({ ...value, [f.key]: v })}
          placeholder={f.placeholder}
          dir={f.type === "email" || f.type === "tel" ? "ltr" : "rtl"}
          proofreadContext={f.ctx ?? "general"}
          enableProofread={!!f.ctx}
        />
      </div>
    ))}
  </div>
);

const SummaryStep = ({
  value,
  onChange,
}: {
  value: { ar?: string; en?: string };
  onChange: (v: { ar?: string; en?: string }) => void;
}) => (
  <div className="space-y-4">
    <div className="space-y-1.5">
      <Label htmlFor="summary-ar">الملخّص (بالعربية)</Label>
      <ProofreadTextarea
        id="summary-ar"
        value={value.ar ?? ""}
        onChange={(v) => onChange({ ...value, ar: v })}
        placeholder="3–5 أسطر تلخّص خبراتك ومجال تخصّصك وأهدافك المهنية..."
        rows={5}
        dir="rtl"
        proofreadContext="summary"
      />
      <p className="text-xs text-muted-foreground">
        نصيحة: ركّز على الإنجازات الكمّية وتجنّب المبالغات. التدقيق الإملائي يحدث تلقائياً.
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
  language,
}: {
  value: Skills;
  onChange: (v: Skills) => void;
  experience: ExperienceItem[];
  education: EducationItem[];
  language: "ar" | "en" | "bilingual";
}) => {
  const [suggesting, setSuggesting] = useState(false);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-cv-skills", {
        body: {
          experience,
          education,
          target_role: experience[0]?.position ?? "",
          language: language === "bilingual" ? "ar" : language,
        },
      });
      if (error) throw error;
      const bucket = data?.ar ?? data?.en;
      if (!bucket) {
        toast.error("لم تُرجَع اقتراحات");
        return;
      }
      const merge = (current: string[] = [], suggested: { name: string }[] = []) => {
        const set = new Set(current.map((s) => s.trim()).filter(Boolean));
        suggested.forEach((s) => s?.name && set.add(s.name.trim()));
        return Array.from(set);
      };
      onChange({
        technical: merge(value.technical, bucket.technical),
        soft: merge(value.soft, bucket.soft),
        languages: merge(value.languages, bucket.languages),
      });
      toast.success("تم اقتراح المهارات");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر الاقتراح");
    } finally {
      setSuggesting(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={suggest}
          disabled={suggesting || (experience.length === 0 && education.length === 0)}
          className="rounded-xl"
        >
          {suggesting ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <Wrench className="w-4 h-4 ml-2" />
          )}
          اقترح المهارات بالذكاء الاصطناعي
        </Button>
      </div>
      {tagInput("المهارات التقنية", "technical", "Python، إدارة قواعد البيانات، Excel متقدّم")}
      {tagInput("المهارات الشخصية", "soft", "العمل الجماعي، إدارة الوقت، التواصل")}
      {tagInput("اللغات", "languages", "العربية (الأم)، الإنجليزية (طلاقة)")}
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
