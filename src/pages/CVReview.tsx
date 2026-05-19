import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCvRevision } from "@/hooks/useCvRevision";
import { buildImprovedCV, exportToDocx, exportToPdf } from "@/lib/cv-export";
import { Check, X, Download, FileDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CVChatPanel from "@/components/cv-builder/CVChatPanel";

// Extract storage path "<user_id>/<file>" from a full Supabase public/signed URL
const extractResumePath = (resumeUrl: string | null, userId: string): string => {
  if (!resumeUrl) return `${userId}/resume.pdf`;
  const m = resumeUrl.match(/\/resumes\/(.+?)(?:\?|$)/);
  return m?.[1] ?? `${userId}/resume.pdf`;
};

interface Weakness {
  section: string;
  issue: string;
  original_text: string;
  severity: "minor" | "moderate" | "major";
}

interface Rewrite {
  original: string;
  improved: string;
  reason: string;
}

interface SaudiCompliance {
  uses_hijri_dates: boolean;
  address_format_correct: boolean;
  jadarat_link_present: boolean;
  recommendations: string[];
}

interface CVDocument {
  id: string;
  uploaded_at: string;
  file_name: string | null;
  section_scores: Record<string, number> | null;
  weaknesses: Weakness[] | null;
  rewrites: Rewrite[] | null;
  saudi_compliance: SaudiCompliance | null;
  extraction: any | null;
}

const SECTION_LABELS: Record<string, string> = {
  contact: "بيانات التواصل",
  summary: "الملخّص",
  experience: "الخبرة",
  education: "التعليم",
  skills: "المهارات",
  achievements: "الإنجازات",
  language_quality: "جودة اللغة",
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  moderate: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  major: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const SEVERITY_LABEL: Record<string, string> = {
  minor: "بسيط",
  moderate: "متوسّط",
  major: "كبير",
};

const COMPLIANCE_ITEMS: { key: keyof Omit<SaudiCompliance, "recommendations">; label: string }[] = [
  { key: "uses_hijri_dates", label: "استخدام التواريخ الهجرية" },
  { key: "address_format_correct", label: "تنسيق العنوان السعودي" },
  { key: "jadarat_link_present", label: "رابط جدارات" },
];

// Hardcoded sample CV analysis used when ?demo=preloaded is in the URL. Lets
// the AI demo tour show a populated CVReview without needing a real PDF upload.
const DEMO_PRELOADED_DOC: CVDocument = {
  id: "demo-preloaded",
  uploaded_at: new Date().toISOString(),
  file_name: "سارة-الراشد-CV.pdf",
  section_scores: {
    contact: 92,
    summary: 71,
    experience: 84,
    education: 88,
    skills: 79,
    achievements: 66,
    language_quality: 81,
  },
  weaknesses: [
    {
      section: "summary",
      issue: "الملخّص عام جداً ولا يذكر أرقام نتائج",
      original_text: "مهندسة واجهات أمامية شغوفة بتجارب المستخدم.",
      severity: "moderate",
    },
    {
      section: "achievements",
      issue: "لا توجد إنجازات قابلة للقياس — كلها مهام لا نتائج",
      original_text: "عملت على تحسين الأداء وتنسيق التصميم.",
      severity: "major",
    },
    {
      section: "skills",
      issue: "قائمة المهارات طويلة بدون مستويات إتقان",
      original_text: "React, Vue, Angular, Node, PHP, Python...",
      severity: "minor",
    },
  ],
  rewrites: [
    {
      original: "مهندسة واجهات أمامية شغوفة بتجارب المستخدم.",
      improved:
        "مهندسة واجهات أمامية بـ 3 سنوات خبرة، قادت إعادة بناء بوّابة عملاء رفعت معدّل التحوّل من 2.1% إلى 3.8% وزادت NPS بـ 22 نقطة.",
      reason:
        "النسخة الأصلية مجرّد صفة (شغوفة) بلا دليل. النسخة المحسّنة تضع رقم خبرة + إنجاز قابل للقياس + قيمة عمل واضحة.",
    },
    {
      original: "عملت على تحسين الأداء وتنسيق التصميم.",
      improved:
        "خفضت زمن تحميل الصفحة الرئيسية (LCP) من 4.2s إلى 1.2s عبر SSR + CDN caching، ووحّدت 3 منتجات على design system مشترك قلّل وقت بناء ميزات بنسبة 40%.",
      reason:
        "الأرقام المحدّدة تفصل بين 'عملت على' و'حقّقت' — هذا الفرق بين مرشّحة عادية ومرشّحة مميّزة.",
    },
  ],
  saudi_compliance: {
    uses_hijri_dates: false,
    address_format_correct: true,
    jadarat_link_present: false,
    recommendations: [

      "أضف تواريخ هجرية بجانب الميلادية للوظائف الحكومية",
      "أرفق رابط ملف جدارات للتقديم على وظائف القطاع العام",
    ],
  },
  extraction: null,
};

interface ApprovedRewriteRowProps {
  accepted: { original: string; improved: string; section?: string };
  saving: boolean;
  onSave: (newImproved: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}

const ApprovedRewriteRow = ({ accepted, saving, onSave, onDelete }: ApprovedRewriteRowProps) => {
  const [edited, setEdited] = useState(accepted.improved);
  const dirty = edited.trim() !== accepted.improved.trim();
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px]">
          {accepted.section ? (SECTION_LABELS[accepted.section] ?? accepted.section) : "تحسين"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded-lg bg-background p-2.5 border">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">قبل (الأصلي)</p>
          <p className="text-xs whitespace-pre-wrap text-muted-foreground line-through min-h-[2rem]">
            {accepted.original?.trim() || "(إضافة جديدة — لا يوجد نص يُستبدل)"}
          </p>
        </div>
        <div className="rounded-lg bg-background p-2.5 border border-emerald-500/40 space-y-1.5">
          <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">بعد (قابل للتعديل)</p>
          <Textarea
            dir="rtl"
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={4}
            className="text-xs bg-background"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onDelete}>
          <X className="w-3.5 h-3.5 ml-1" />
          حذف
        </Button>
        <Button
          size="sm"
          disabled={saving || !dirty || !edited.trim()}
          onClick={() => onSave(edited.trim())}
        >
          <Check className="w-3.5 h-3.5 ml-1" />
          حفظ التعديل
        </Button>
      </div>
    </div>
  );
};

const CVReview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [doc, setDoc] = useState<CVDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [editedImproved, setEditedImproved] = useState<Record<number, string>>({});
  const isDemoPreloaded = searchParams.get("demo") === "preloaded";
  const { revision, acceptRewrite, rejectRewrite, saving } = useCvRevision(user?.id, doc?.id);

  const loadAnalysis = async (uid: string) => {
    const { data } = await supabase
      .from("cv_documents" as any)
      .select("id, uploaded_at, file_name, section_scores, weaknesses, rewrites, saudi_compliance, extraction")
      .eq("user_id", uid)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as unknown as CVDocument) ?? null;
  };

  const triggerAnalysis = async (overrideUrl?: string | null) => {
    if (!user) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    const loadingId = toast.loading("جارٍ تحليل سيرتك… قد يستغرق حتى دقيقة");
    try {
      const path = extractResumePath(overrideUrl ?? resumeUrl, user.id);
      const { data, error } = await supabase.functions.invoke("analyze-resume", {
        body: { resume_path: path },
      });
      // Prefer the function's own error payload over the generic FunctionsHttpError
      const serverMsg = (data as any)?.error;
      if (serverMsg) throw new Error(serverMsg);
      if (error) {
        // Try to read the function's error body for a better message
        const ctxMsg =
          (error as any)?.context?.body && typeof (error as any).context.body === "string"
            ? (() => { try { return JSON.parse((error as any).context.body)?.error; } catch { return null; } })()
            : null;
        throw new Error(ctxMsg || error.message);
      }
      const fresh = await loadAnalysis(user.id);
      if (!fresh) throw new Error("تعذّر قراءة نتيجة التحليل بعد الحفظ");
      setDoc(fresh);
      toast.success("اكتمل تحليل سيرتك الذاتية", { id: loadingId });
    } catch (e: any) {
      console.error("analyze-resume failed:", e);
      const msg =
        e?.message?.includes("Failed to fetch") || e?.name === "FunctionsFetchError"
          ? "تعذّر الاتصال بخدمة التحليل، تحقّق من اتصالك وحاول مجدداً"
          : e?.message || "حدث خطأ غير متوقّع أثناء التحليل";
      setAnalyzeError(msg);
      toast.error(msg, { id: loadingId });
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    // Demo mode short-circuit: skip auth + DB and render a hardcoded analysis
    // so the AI demo can showcase the review experience without an actual PDF.
    if (isDemoPreloaded) {
      setDoc(DEMO_PRELOADED_DOC);
      setLoading(false);
      return;
    }

    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user) return;

    const load = async () => {
      const existing = await loadAnalysis(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("resume_url")
        .eq("user_id", user.id)
        .maybeSingle();
      const url = (profile as any)?.resume_url ?? null;
      setResumeUrl(url);


      if (existing) {
        setDoc(existing);
        setLoading(false);
        return;
      }
      setLoading(false);
      if (url) {
        // Auto-trigger analysis on first visit
        await triggerAnalysis(url);
      }
    };
    load();
  }, [user, authLoading, navigate, isDemoPreloaded]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8" dir="rtl">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4" dir="rtl">
        <FileText className="w-12 h-12 text-muted-foreground" />
        {resumeUrl ? (
          <>
            <p className="text-muted-foreground text-lg text-center">
              سيرتك الذاتية مرفوعة. اضغط لتحليلها بالذكاء الاصطناعي.
            </p>
            {analyzeError && (
              <p className="text-sm text-destructive text-center max-w-md">{analyzeError}</p>
            )}
            <Button onClick={() => triggerAnalysis()} disabled={analyzing}>
              {analyzing ? "جارٍ التحليل..." : analyzeError ? "إعادة المحاولة" : "حلّل سيرتي الآن"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-lg text-center">
              لم يتمّ تحليل سيرة ذاتية بعد. ارفع سيرتك من إعدادات الملف الشخصي لتبدأ.
            </p>
            <Button onClick={() => navigate("/settings/profile")}>الذهاب لرفع السيرة</Button>
          </>
        )}
      </div>
    );
  }

  const scores = doc.section_scores ?? {};
  const radarData = Object.entries(scores).map(([k, v]) => ({
    section: SECTION_LABELS[k] ?? k,
    score: v,
  }));
  const avgScore =
    radarData.length > 0
      ? Math.round(radarData.reduce((sum, r) => sum + r.score, 0) / radarData.length)
      : 0;

  const compliance = doc.saudi_compliance;
  const weaknesses = doc.weaknesses ?? [];
  const rewrites = doc.rewrites ?? [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">تقييم السيرة الذاتية</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            العودة للوحة التحكم
            <ArrowRight className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        {/* Overall + Radar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-lg flex flex-col items-center justify-center p-6">
            <p className="text-sm text-muted-foreground mb-2">المتوسّط الإجمالي</p>
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="48" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeDasharray={`${(avgScore / 100) * 301.59} 301.59`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{avgScore}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              آخر تحليل: {new Date(doc.uploaded_at).toLocaleDateString("ar-SA")}
            </p>
          </Card>

          <Card data-tour="cv-review-radar" className="rounded-2xl shadow-lg md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">جودة الأقسام</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="section"
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                نقاط الضعف
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weaknesses.map((w, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {SECTION_LABELS[w.section] ?? w.section}
                    </Badge>
                    <Badge className={cn("text-xs", SEVERITY_BADGE[w.severity])}>
                      {SEVERITY_LABEL[w.severity]}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{w.issue}</p>
                  {w.original_text && (
                    <blockquote className="text-xs text-muted-foreground border-r-2 border-amber-500/40 pr-3 italic">
                      "{w.original_text}"
                    </blockquote>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Rewrites — accept / edit / reject */}
        {rewrites.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                تحسينات الذكاء الاصطناعي — اعتمد ما يناسبك
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                يمكنك تعديل النسخة المحسّنة قبل اعتمادها. التحسينات المعتمدة ستظهر في النسخة النهائية القابلة للتصدير.
              </p>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {rewrites.map((r, idx) => {
                  const accepted = revision?.accepted_rewrites?.find((a) => a.original === r.original);
                  const currentValue = editedImproved[idx] ?? accepted?.improved ?? r.improved;
                  return (
                    <AccordionItem key={idx} value={`rw-${idx}`} className="border rounded-xl px-3">
                      <AccordionTrigger className="hover:no-underline py-2 text-sm text-right">
                        <div className="flex items-center gap-2 flex-1 text-right">
                          <span className="flex-1">{r.reason}</span>
                          {accepted && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">
                              معتمد
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="rounded-lg bg-muted/40 p-3">
                            <p className="text-xs text-muted-foreground mb-1">الأصلي</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{r.original}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2">
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                              النسخة المحسّنة (قابلة للتعديل)
                            </p>
                            <Textarea
                              dir="rtl"
                              value={currentValue}
                              onChange={(e) =>
                                setEditedImproved((prev) => ({ ...prev, [idx]: e.target.value }))
                              }
                              rows={4}
                              className="text-sm bg-background/60"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {accepted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              onClick={async () => {
                                await rejectRewrite(r.original);
                                toast.success("تم إلغاء اعتماد التحسين");
                              }}
                            >
                              <X className="w-3.5 h-3.5 ml-1" />
                              إلغاء الاعتماد
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={saving}
                            onClick={async () => {
                              await acceptRewrite(r.original, currentValue);
                              toast.success("تم اعتماد التحسين");
                            }}
                          >
                            <Check className="w-3.5 h-3.5 ml-1" />
                            {accepted ? "حفظ التعديلات" : "اعتماد التحسين"}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Unified final review of every approved improvement (from analyzer + chat) */}
        {(revision?.accepted_rewrites?.length ?? 0) > 0 && (
          <Card className="rounded-2xl shadow-lg border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                مراجعة نهائية للتحسينات المعتمدة ({revision?.accepted_rewrites?.length ?? 0})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                هذه قائمة كل التحسينات المعتمدة (من التحليل ومن المحادثة). راجعها وعدّلها أو احذفها قبل التصدير النهائي.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(revision?.accepted_rewrites ?? []).map((a, idx) => (
                <ApprovedRewriteRow
                  key={`${a.original}-${a.improved}-${idx}`}
                  accepted={a}
                  saving={saving}
                  onSave={async (newImproved) => {
                    // Replace this entry: remove old then add new (preserves section)
                    await rejectRewrite(a.original, a.improved);
                    await acceptRewrite(a.original, newImproved, a.section);
                    toast.success("تم حفظ التعديل");
                  }}
                  onDelete={async () => {
                    await rejectRewrite(a.original, a.improved);
                    toast.success("تم حذف التحسين");
                  }}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Export improved CV */}

        <Card className="rounded-2xl shadow-lg border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              تصدير سيرتك المحسّنة
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              يتم دمج جميع التحسينات التي اعتمدتها في النص الأصلي للسيرة، ثم تصديرها بصيغة Word أو PDF.
              {revision?.accepted_rewrites?.length
                ? ` (${revision.accepted_rewrites.length} تحسين معتمد)`
                : " (لم يتم اعتماد أي تحسين بعد — سيتم تصدير النص الأصلي)"}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                try {
                  const data = buildImprovedCV(
                    doc.extraction,
                    revision?.accepted_rewrites ?? [],
                    doc.file_name ?? "السيرة الذاتية",
                  );
                  await exportToDocx(data, `cv-${Date.now()}.docx`, { language: "ar" });
                  toast.success("تم تصدير ملف Word");
                } catch (e: any) {
                  toast.error(e?.message || "فشل تصدير Word");
                }
              }}
            >
              <FileDown className="w-4 h-4 ml-1.5" />
              تصدير Word (.docx)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  const data = buildImprovedCV(
                    doc.extraction,
                    revision?.accepted_rewrites ?? [],
                    doc.file_name ?? "السيرة الذاتية",
                  );
                  exportToPdf(data, `cv-${Date.now()}.pdf`, { language: "ar" });
                  toast.success("افتح نافذة الطباعة واختر 'حفظ كـ PDF'");
                } catch (e: any) {
                  toast.error(e?.message || "فشل تصدير PDF");
                }
              }}
            >
              <FileDown className="w-4 h-4 ml-1.5" />
              تصدير PDF
            </Button>
          </CardContent>
        </Card>

        {/* P0.4: AI chat about this CV */}
        <CVChatPanel
          cvDocumentId={doc.id}
          language="ar"
          onAcceptImprovement={async (improved, original, section) => {
            await acceptRewrite(original, improved, section);
          }}
        />

        {/* Saudi compliance */}
        {compliance && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                الامتثال للمعايير السعودية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMPLIANCE_ITEMS.map((item) => {
                  const ok = compliance[item.key];
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border",
                        ok
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-amber-500/30 bg-amber-500/5",
                      )}
                    >
                      {ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                  );
                })}
              </div>

              {compliance.recommendations && compliance.recommendations.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <p className="text-sm font-semibold text-foreground">توصيات إضافية:</p>
                  <ul className="space-y-1">
                    {compliance.recommendations.map((r, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CVReview;
