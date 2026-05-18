import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Sparkles,
  PenLine,
  MessagesSquare,
  ScanSearch,
  ChevronLeft,
  ArrowRight,
  Pencil,
  Globe,
} from "lucide-react";
import TemplateGallery from "@/components/cv-hub/TemplateGallery";

interface DraftRow {
  id: string;
  personal_info: any;
  summary: any;
  template: string | null;
  language: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_exported_at: string | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  modern: "حديث",
  conservative: "محافظ",
  executive: "تنفيذي",
};

const LANG_LABELS: Record<string, string> = {
  ar: "عربية",
  en: "English",
  bilingual: "ثنائية",
};

const CVHub = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("cv_drafts")
      .select("id, personal_info, summary, template, language, created_at, updated_at, last_exported_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setDrafts((data as unknown as DraftRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, navigate]);

  const createNew = async () => {
    if (!user) return;
    setCreating(true);
    try {
      // Prefill personal_info from profile if available
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", user.id)
        .single();

      const { data, error } = await supabase
        .from("cv_drafts")
        .insert({
          user_id: user.id,
          personal_info: profile
            ? {
                full_name: (profile as any).full_name ?? "",
                email: (profile as any).email ?? "",
                phone: (profile as any).phone ?? "",
              }
            : {},
          summary: {},
          experience: [],
          education: [],
          skills: { technical: [], soft: [], languages: [] },
          certifications: [],
          template: "modern",
          language: "ar",
        })
        .select()
        .single();

      if (error) throw error;
      if (data) navigate(`/cv/builder?draft=${(data as any).id}`);
    } catch (e) {
      console.error(e);
      toast.error("فشل إنشاء مسوّدة جديدة");
    } finally {
      setCreating(false);
    }
  };

  const duplicate = async (draft: DraftRow) => {
    if (!user) return;
    try {
      // Load full draft first
      const { data: full } = await supabase
        .from("cv_drafts")
        .select("*")
        .eq("id", draft.id)
        .single();
      if (!full) return;

      const f = full as any;
      const { data, error } = await supabase
        .from("cv_drafts")
        .insert({
          user_id: user.id,
          personal_info: f.personal_info,
          summary: f.summary,
          experience: f.experience,
          education: f.education,
          skills: f.skills,
          certifications: f.certifications,
          template: f.template,
          language: f.language,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("تمّ نسخ المسوّدة");
      if (data) navigate(`/cv/builder?draft=${(data as any).id}`);
    } catch (e) {
      console.error(e);
      toast.error("فشل النسخ");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه المسوّدة نهائياً؟")) return;
    try {
      const { error } = await supabase.from("cv_drafts").delete().eq("id", id);
      if (error) throw error;
      toast.success("حُذفت المسوّدة");
      load();
    } catch (e) {
      console.error(e);
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              مركز السيرة الذاتية
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ابنِ سيرتك بطرق متعدّدة، احفظ نسخاً مختلفة لوظائف مختلفة، وحلّل سيرتك الحالية.
            </p>
          </div>
          <Button onClick={createNew} disabled={creating} className="rounded-xl">
            <Plus className="w-4 h-4 ml-2" />
            مسوّدة جديدة
          </Button>
        </div>

        {/* Quick actions row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="rounded-xl border-2 hover:border-primary/30 transition-all group">
            <Link to="/cv/interview">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <MessagesSquare className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">من الصفر بالمحادثة</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">١٥ سؤال موجَّه</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Link>
          </Card>
          <Card className="rounded-xl border-2 hover:border-primary/30 transition-all group">
            <button onClick={createNew} disabled={creating} className="w-full text-right">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <PenLine className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">منشئ يدوي جديد</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">٧ خطوات مع AI assist</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </button>
          </Card>
          <Card className="rounded-xl border-2 hover:border-primary/30 transition-all group">
            <Link to="/cv/review">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <ScanSearch className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">تقييم سيرة موجودة</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">ارفع PDF + chat</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Template Gallery */}
        <TemplateGallery />

        {/* Drafts list */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">مسوّداتي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <>
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </>
            ) : drafts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm mb-3">لا توجد مسوّدات بعد.</p>
                <Button onClick={createNew} className="rounded-xl">
                  <Sparkles className="w-4 h-4 ml-2" />
                  ابدأ أوّل مسوّدة
                </Button>
              </div>
            ) : (
              drafts.map((d) => {
                const name = d.personal_info?.full_name ?? "بدون اسم";
                const targetRole = (d.personal_info as any)?.target_role ?? null;
                const updated = d.updated_at
                  ? new Date(d.updated_at).toLocaleDateString("ar-SA")
                  : "—";
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all"
                  >
                    <Link to={`/cv/builder?draft=${d.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                          {targetRole && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {targetRole}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {TEMPLATE_LABELS[d.template ?? "modern"]}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-normal flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            {LANG_LABELS[d.language ?? "ar"]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          آخر تعديل: {updated}
                          {d.last_exported_at && (
                            <>
                              {" · "}
                              صُدِّرت: {new Date(d.last_exported_at).toLocaleDateString("ar-SA")}
                            </>
                          )}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate(`/cv/builder?draft=${d.id}`)}
                        title="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => duplicate(d)}
                        title="نسخ"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(d.id)}
                        title="حذف"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="text-center pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            العودة للوحة التحكم
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CVHub;
