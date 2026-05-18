import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mail,
  ArrowRight,
  Sparkles,
  Loader2,
  Copy,
  Check,
  FileText,
} from "lucide-react";

interface LetterPart {
  greeting: string;
  body: string;
  signature: string;
  paragraph_count: number;
}

interface LetterResult {
  ar?: LetterPart;
  en?: LetterPart;
}

const CoverLetter = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<LetterResult | null>(null);
  const [copied, setCopied] = useState<"ar" | "en" | null>(null);

  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user || !draftId) return;

    const load = async () => {
      const { data } = await supabase
        .from("cv_drafts")
        .select("*")
        .eq("id", draftId)
        .eq("user_id", user.id)
        .single();
      setDraft(data);
      if (data) {
        const inferredRole = (data.personal_info as any)?.target_role ?? "";
        if (inferredRole) setTargetRole(inferredRole);
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading, draftId, navigate]);

  const generate = async () => {
    if (!draft || !draftId) return;
    setGenerating(true);
    setResult(null);
    try {
      const lang = (draft.language as string) || "ar";
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: {
          draft_id: draftId,
          target_role: targetRole,
          target_company: targetCompany,
          job_description: jobDescription,
          language: lang,
        },
      });
      if (error) throw error;
      setResult(data);
      toast.success("جاهز!");
    } catch (e) {
      console.error(e);
      toast.error("فشل توليد الرسالة");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (lang: "ar" | "en") => {
    const block = result?.[lang];
    if (!block) return;
    const text = `${block.greeting}\n\n${block.body}\n\n${block.signature}`;
    navigator.clipboard.writeText(text);
    setCopied(lang);
    toast.success("تمّ النسخ");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-background" dir="rtl">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background" dir="rtl">
        <FileText className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">المسوّدة غير موجودة.</p>
        <Button onClick={() => navigate("/cv")}>العودة لمركز السيرة</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" />
              رسالة التقديم
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              مرفق سيرتك:{" "}
              <Badge variant="outline" className="font-normal mr-1">
                {(draft.personal_info as any)?.full_name ?? "بدون اسم"}
              </Badge>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/cv/builder?draft=${draftId}`)}>
            العودة للسيرة
            <ArrowRight className="w-4 h-4 mr-2" />
          </Button>
        </div>

        {/* Inputs */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">معلومات الوظيفة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="role">الوظيفة المستهدفة</Label>
                <Input
                  id="role"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="مثال: محلّل سياسات"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">الجهة</Label>
                <Input
                  id="company"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="مثال: وزارة المالية"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jd">الوصف الوظيفي (اختياري — كلّما زادت التفاصيل، كانت الرسالة أدقّ)</Label>
              <Textarea
                id="jd"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="الصق وصف الوظيفة من إعلان التوظيف هنا..."
                rows={5}
                dir="rtl"
              />
            </div>
            <Button onClick={generate} disabled={generating} className="rounded-xl w-full">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  AI يكتب الرسالة...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 ml-2" />
                  {result ? "أعد التوليد" : "ولّد الرسالة بـ AI"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {result.ar && (
              <Card className="rounded-2xl shadow-lg border-primary/20">
                <CardHeader className="pb-3 flex flex-row items-center justify-between" dir="rtl">
                  <CardTitle className="text-base">النسخة العربية</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard("ar")}>
                    {copied === "ar" ? (
                      <Check className="w-3.5 h-3.5 ml-1.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 ml-1.5" />
                    )}
                    نسخ
                  </Button>
                </CardHeader>
                <CardContent dir="rtl">
                  <div className="font-arabic leading-relaxed text-foreground bg-card/50 p-5 rounded-xl whitespace-pre-line">
                    <p className="font-semibold">{result.ar.greeting}</p>
                    <p className="mt-4">{result.ar.body}</p>
                    <p className="mt-4 font-semibold">{result.ar.signature}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {result.ar.paragraph_count} فقرات
                  </p>
                </CardContent>
              </Card>
            )}
            {result.en && (
              <Card className="rounded-2xl shadow-lg border-primary/20">
                <CardHeader className="pb-3 flex flex-row items-center justify-between" dir="ltr">
                  <CardTitle className="text-base">English version</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard("en")}>
                    {copied === "en" ? (
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Copy
                  </Button>
                </CardHeader>
                <CardContent dir="ltr">
                  <div className="leading-relaxed text-foreground bg-card/50 p-5 rounded-xl whitespace-pre-line">
                    <p className="font-semibold">{result.en.greeting}</p>
                    <p className="mt-4">{result.en.body}</p>
                    <p className="mt-4 font-semibold">{result.en.signature}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {result.en.paragraph_count} paragraphs
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoverLetter;
