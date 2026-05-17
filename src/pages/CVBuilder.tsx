import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, FileText, Plus, Trash2, Save, Sparkles, Loader2, Eye,
  GripVertical, Printer,
} from "lucide-react";

type Experience = { title: string; employer: string; period: string; bullets: string[]; raw?: string };
type Education = { degree: string; institution: string; period: string; gpa?: string };
type Certificate = { name: string; issuer?: string; year?: string };
type Section = {
  personal: { full_name: string; title: string; email: string; phone: string; city: string; linkedin?: string };
  summary: string;
  experiences: Experience[];
  educations: Education[];
  skills: string[];
  certificates: Certificate[];
  languages: string[];
};

const EMPTY_SECTIONS: Section = {
  personal: { full_name: "", title: "", email: "", phone: "", city: "", linkedin: "" },
  summary: "",
  experiences: [],
  educations: [],
  skills: [],
  certificates: [],
  languages: [],
};

const STEPS = [
  { key: "personal", label: "البيانات الشخصية" },
  { key: "summary", label: "الملخّص" },
  { key: "experience", label: "الخبرات" },
  { key: "education", label: "التعليم" },
  { key: "skills", label: "المهارات" },
  { key: "certificates", label: "الشهادات" },
  { key: "preview", label: "المعاينة" },
] as const;

const CVBuilder = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [draftId, setDraftId] = useState<string | null>(id || null);
  const [name, setName] = useState("سيرة ذاتية");
  const [template, setTemplate] = useState<"classic" | "modern" | "executive">("modern");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [sections, setSections] = useState<Section>(EMPTY_SECTIONS);
  const [activeStep, setActiveStep] = useState<typeof STEPS[number]["key"]>("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user) return;
    (async () => {
      if (id) {
        const { data } = await supabase.from("cv_drafts").select("*").eq("id", id).maybeSingle();
        if (data) {
          setDraftId(data.id);
          setName(data.name);
          setTemplate(data.template as any);
          setLanguage(data.language as any);
          setSections({ ...EMPTY_SECTIONS, ...(data.sections as any) });
        }
      } else {
        // Prefill from profile if first time
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, city, major")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile) {
          setSections((prev) => ({
            ...prev,
            personal: {
              ...prev.personal,
              full_name: profile.full_name || "",
              phone: profile.phone || "",
              city: profile.city || "",
              email: user.email || "",
            },
          }));
        }
      }
      setLoading(false);
    })();
  }, [user, authLoading, id, navigate]);

  const save = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (draftId) {
        const { error } = await supabase
          .from("cv_drafts")
          .update({ name, template, language, sections: sections as any })
          .eq("id", draftId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("cv_drafts")
          .insert({ user_id: user.id, name, template, language, sections: sections as any })
          .select()
          .single();
        if (error) throw error;
        if (data) setDraftId(data.id);
      }
      toast.success("تم الحفظ");
    } catch (e) {
      console.error(e);
      toast.error("تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }, [user, draftId, name, template, language, sections]);

  // Auto-save 3s after last change
  useEffect(() => {
    if (loading || !user) return;
    const t = setTimeout(() => { save(); }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, template, language, sections]);

  const generateBullets = async (idx: number) => {
    const exp = sections.experiences[idx];
    if (!exp?.raw?.trim()) {
      toast.error("اكتب وصف المهام أولاً ثم اضغط اقتراح الصياغة");
      return;
    }
    setGeneratingFor(idx);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cv-bullets", {
        body: {
          title: exp.title,
          employer: exp.employer,
          raw_description: exp.raw,
          language,
        },
      });
      if (error) throw error;
      const bullets = (data?.bullets || []).flatMap((b: any) => b.variants?.slice(0, 1) || []);
      setSections((prev) => {
        const next = { ...prev, experiences: [...prev.experiences] };
        next.experiences[idx] = { ...next.experiences[idx], bullets };
        return next;
      });
      toast.success(`تم توليد ${bullets.length} نقطة`);
    } catch (e) {
      console.error(e);
      toast.error("تعذّر التوليد الآن");
    } finally {
      setGeneratingFor(null);
    }
  };

  const requestReview = async () => {
    if (!draftId) {
      await save();
    }
    if (!draftId) return;
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("review-cv", {
        body: { draft_id: draftId, target_role: sections.personal.title || undefined },
      });
      if (error) throw error;
      toast.success("تم تقييم السيرة");
      navigate(`/cv/review?doc=${data.cv_document_id}`);
    } catch (e) {
      console.error(e);
      toast.error("تعذّر التقييم الآن");
    } finally {
      setScoring(false);
    }
  };

  const completionPct = useMemo(() => {
    let filled = 0;
    const total = 6;
    if (sections.personal.full_name && sections.personal.email) filled++;
    if (sections.summary.trim().length > 50) filled++;
    if (sections.experiences.length > 0) filled++;
    if (sections.educations.length > 0) filled++;
    if (sections.skills.length >= 3) filled++;
    if (sections.languages.length > 0) filled++;
    return Math.round((filled / total) * 100);
  }, [sections]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-bold w-64"
            />
            <Badge variant="outline">{completionPct}% مكتمل</Badge>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={template} onValueChange={(v: any) => setTemplate(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">محافظ</SelectItem>
                <SelectItem value="modern">حديث</SelectItem>
                <SelectItem value="executive">تنفيذي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">عربي</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="w-4 h-4 ml-1.5 animate-spin" /> : <Save className="w-4 h-4 ml-1.5" />}
              حفظ
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              العودة <ArrowRight className="w-4 h-4 mr-1.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Tabs value={activeStep} onValueChange={(v: any) => setActiveStep(v)}>
          <TabsList className="w-full overflow-x-auto justify-start">
            {STEPS.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="personal" className="space-y-3 mt-4">
            <Card><CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>الاسم الكامل</Label><Input value={sections.personal.full_name} onChange={(e) => setSections({ ...sections, personal: { ...sections.personal, full_name: e.target.value } })} /></div>
              <div><Label>المسمى الوظيفي / المستهدف</Label><Input placeholder="مثال: أخصائي موارد بشرية" value={sections.personal.title} onChange={(e) => setSections({ ...sections, personal: { ...sections.personal, title: e.target.value } })} /></div>
              <div><Label>البريد الإلكتروني</Label><Input type="email" value={sections.personal.email} onChange={(e) => setSections({ ...sections, personal: { ...sections.personal, email: e.target.value } })} /></div>
              <div><Label>الجوال</Label><Input value={sections.personal.phone} onChange={(e) => setSections({ ...sections, personal: { ...sections.personal, phone: e.target.value } })} /></div>
              <div><Label>المدينة</Label><Input value={sections.personal.city} onChange={(e) => setSections({ ...sections, personal: { ...sections.personal, city: e.target.value } })} /></div>
              <div><Label>LinkedIn (اختياري)</Label><Input value={sections.personal.linkedin || ""} onChange={(e) => setSections({ ...sections, personal: { ...sections.personal, linkedin: e.target.value } })} /></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-3 mt-4">
            <Card><CardContent className="p-6 space-y-2">
              <Label>الملخّص الشخصي (3–5 أسطر)</Label>
              <Textarea
                rows={6}
                placeholder="ابدأ بمن أنت + سنوات الخبرة + التخصص + قيمة مميزة + الهدف الوظيفي."
                value={sections.summary}
                onChange={(e) => setSections({ ...sections, summary: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">نصيحة: ابتعد عن العبارات المُكرَّرة كـ "متحفّز للنجاح". اذكر رقماً أو نتيجة محدّدة.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="experience" className="space-y-3 mt-4">
            {sections.experiences.map((exp, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><GripVertical className="w-4 h-4" /> خبرة {i + 1}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSections({ ...sections, experiences: sections.experiences.filter((_, idx) => idx !== i) })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label>المسمى</Label><Input value={exp.title} onChange={(e) => { const next = [...sections.experiences]; next[i] = { ...next[i], title: e.target.value }; setSections({ ...sections, experiences: next }); }} /></div>
                    <div><Label>الجهة</Label><Input value={exp.employer} onChange={(e) => { const next = [...sections.experiences]; next[i] = { ...next[i], employer: e.target.value }; setSections({ ...sections, experiences: next }); }} /></div>
                    <div><Label>الفترة</Label><Input placeholder="مثل: 1442 - حتى الآن" value={exp.period} onChange={(e) => { const next = [...sections.experiences]; next[i] = { ...next[i], period: e.target.value }; setSections({ ...sections, experiences: next }); }} /></div>
                  </div>
                  <div>
                    <Label>وصف المهام (نصّ حر)</Label>
                    <Textarea
                      rows={4}
                      placeholder="مثال: أشرفت على فريق 5 موظفين، طوّرت دورة استقطاب، أنجزت 12 مقابلة شهرياً..."
                      value={exp.raw || ""}
                      onChange={(e) => { const next = [...sections.experiences]; next[i] = { ...next[i], raw: e.target.value }; setSections({ ...sections, experiences: next }); }}
                    />
                    <Button size="sm" variant="secondary" className="mt-2" disabled={generatingFor === i} onClick={() => generateBullets(i)}>
                      {generatingFor === i ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ التوليد...</>) : (<><Sparkles className="w-4 h-4 ml-2" /> اقترح صياغة احترافية</>)}
                    </Button>
                  </div>
                  {exp.bullets.length > 0 && (
                    <div className="space-y-1.5 bg-muted/40 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">النقاط المقترحة:</p>
                      <ul className="space-y-1">
                        {exp.bullets.map((b, bi) => (
                          <li key={bi} className="text-sm flex gap-2"><span className="text-primary">•</span>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => setSections({ ...sections, experiences: [...sections.experiences, { title: "", employer: "", period: "", bullets: [], raw: "" }] })}>
              <Plus className="w-4 h-4 ml-2" /> أضف خبرة
            </Button>
          </TabsContent>

          <TabsContent value="education" className="space-y-3 mt-4">
            {sections.educations.map((edu, i) => (
              <Card key={i}>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div><Label>الدرجة</Label><Input value={edu.degree} onChange={(e) => { const next = [...sections.educations]; next[i] = { ...next[i], degree: e.target.value }; setSections({ ...sections, educations: next }); }} /></div>
                  <div><Label>الجهة</Label><Input value={edu.institution} onChange={(e) => { const next = [...sections.educations]; next[i] = { ...next[i], institution: e.target.value }; setSections({ ...sections, educations: next }); }} /></div>
                  <div><Label>الفترة</Label><Input value={edu.period} onChange={(e) => { const next = [...sections.educations]; next[i] = { ...next[i], period: e.target.value }; setSections({ ...sections, educations: next }); }} /></div>
                  <div className="flex gap-2">
                    <div className="flex-1"><Label>المعدل</Label><Input value={edu.gpa || ""} onChange={(e) => { const next = [...sections.educations]; next[i] = { ...next[i], gpa: e.target.value }; setSections({ ...sections, educations: next }); }} /></div>
                    <Button variant="ghost" size="sm" onClick={() => setSections({ ...sections, educations: sections.educations.filter((_, idx) => idx !== i) })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => setSections({ ...sections, educations: [...sections.educations, { degree: "", institution: "", period: "" }] })}>
              <Plus className="w-4 h-4 ml-2" /> أضف مؤهلاً
            </Button>
          </TabsContent>

          <TabsContent value="skills" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-6 space-y-3">
                <div>
                  <Label>المهارات (مفصولة بفاصلة)</Label>
                  <Textarea
                    rows={3}
                    value={sections.skills.join(", ")}
                    onChange={(e) => setSections({ ...sections, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
                <div>
                  <Label>اللغات</Label>
                  <Input
                    placeholder="العربية - أم، الإنجليزية - متقدم"
                    value={sections.languages.join(", ")}
                    onChange={(e) => setSections({ ...sections, languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certificates" className="space-y-3 mt-4">
            {sections.certificates.map((c, i) => (
              <Card key={i}><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2"><Label>اسم الشهادة</Label><Input value={c.name} onChange={(e) => { const next = [...sections.certificates]; next[i] = { ...next[i], name: e.target.value }; setSections({ ...sections, certificates: next }); }} /></div>
                <div><Label>الجهة</Label><Input value={c.issuer || ""} onChange={(e) => { const next = [...sections.certificates]; next[i] = { ...next[i], issuer: e.target.value }; setSections({ ...sections, certificates: next }); }} /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><Label>السنة</Label><Input value={c.year || ""} onChange={(e) => { const next = [...sections.certificates]; next[i] = { ...next[i], year: e.target.value }; setSections({ ...sections, certificates: next }); }} /></div>
                  <Button variant="ghost" size="sm" onClick={() => setSections({ ...sections, certificates: sections.certificates.filter((_, idx) => idx !== i) })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent></Card>
            ))}
            <Button variant="outline" onClick={() => setSections({ ...sections, certificates: [...sections.certificates, { name: "" }] })}>
              <Plus className="w-4 h-4 ml-2" /> أضف شهادة
            </Button>
          </TabsContent>

          <TabsContent value="preview" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-8">
                <CVPreview sections={sections} template={template} language={language} />
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-3 justify-end pb-8">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 ml-2" /> طباعة / حفظ PDF
              </Button>
              <Button variant="secondary" disabled={scoring} onClick={requestReview}>
                {scoring ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ التقييم...</>) : (<><Eye className="w-4 h-4 ml-2" /> قيّم سيرتي</>)}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Inline preview component — print-friendly RTL layout. Uses window.print()
// for PDF export, which preserves Arabic shaping using the browser's native
// font rendering (avoids @react-pdf/renderer RTL kerning issues).
const CVPreview = ({ sections, template, language }: { sections: Section; template: string; language: string }) => {
  const dir = language === "ar" ? "rtl" : "ltr";
  const accentClass = template === "executive"
    ? "border-t-4 border-primary"
    : template === "classic"
      ? "border border-border"
      : "border-r-4 border-primary";
  return (
    <div className={`bg-white text-black ${accentClass} p-8 print:shadow-none print:p-0`} dir={dir} style={{ fontFamily: language === "ar" ? "Tahoma, 'Geeza Pro', sans-serif" : "Arial, sans-serif" }}>
      <header className="text-center mb-6 pb-4 border-b border-gray-300">
        <h1 className="text-2xl font-bold mb-1">{sections.personal.full_name || "الاسم الكامل"}</h1>
        {sections.personal.title && <p className="text-base text-gray-700">{sections.personal.title}</p>}
        <p className="text-sm text-gray-600 mt-2 flex flex-wrap gap-3 justify-center">
          {sections.personal.email && <span>{sections.personal.email}</span>}
          {sections.personal.phone && <span>• {sections.personal.phone}</span>}
          {sections.personal.city && <span>• {sections.personal.city}</span>}
          {sections.personal.linkedin && <span>• {sections.personal.linkedin}</span>}
        </p>
      </header>

      {sections.summary && (
        <section className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 mb-2 pb-1">الملخّص الشخصي</h2>
          <p className="text-sm leading-relaxed">{sections.summary}</p>
        </section>
      )}

      {sections.experiences.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 mb-2 pb-1">الخبرات</h2>
          {sections.experiences.map((exp, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{exp.title} — {exp.employer}</span>
                <span className="text-gray-600">{exp.period}</span>
              </div>
              {exp.bullets.length > 0 && (
                <ul className="text-sm mt-1 space-y-0.5">
                  {exp.bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-2"><span>•</span>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {sections.educations.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 mb-2 pb-1">التعليم</h2>
          {sections.educations.map((edu, i) => (
            <div key={i} className="flex justify-between text-sm mb-1">
              <span className="font-medium">{edu.degree}, {edu.institution}{edu.gpa ? ` — معدل ${edu.gpa}` : ""}</span>
              <span className="text-gray-600">{edu.period}</span>
            </div>
          ))}
        </section>
      )}

      {sections.skills.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 mb-2 pb-1">المهارات</h2>
          <p className="text-sm">{sections.skills.join(" • ")}</p>
        </section>
      )}

      {sections.certificates.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 mb-2 pb-1">الشهادات</h2>
          <ul className="text-sm space-y-0.5">
            {sections.certificates.map((c, i) => (
              <li key={i}>{c.name}{c.issuer ? ` — ${c.issuer}` : ""}{c.year ? ` (${c.year})` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {sections.languages.length > 0 && (
        <section>
          <h2 className="text-base font-bold border-b border-gray-300 mb-2 pb-1">اللغات</h2>
          <p className="text-sm">{sections.languages.join(" • ")}</p>
        </section>
      )}
    </div>
  );
};

export default CVBuilder;
