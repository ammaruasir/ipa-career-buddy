import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, ShieldCheck, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const CONSENT_TYPES = [
  {
    key: "audio_third_party_ai",
    title_ar: "تحويل الصوت إلى نص",
    title_en: "Audio transcription",
    desc_ar:
      "تستخدم المنصة Google Gemini (عبر Lovable AI Gateway) لتحويل تسجيلاتك الصوتية إلى نص. التسجيلات تُرسَل عبر اتصال HTTPS مشفّر ولا تُحتفَظ بها لدى الطرف الثالث بحسب سياساته.",
    desc_en:
      "The platform uses Google Gemini (via Lovable AI Gateway) to transcribe your audio recordings. Recordings are sent over encrypted HTTPS; the third party does not retain them per their policy.",
    required: true,
  },
  {
    key: "video_third_party_ai",
    title_ar: "تحليل لقطات الفيديو",
    title_en: "Video frame analysis",
    desc_ar:
      "للمقابلات المرئية، تُرسَل لقطات من الفيديو لتحليل لغة الجسد والتواصل البصري. تُحلّل صوريّاً ولا تُخزَّن خارج المنصّة.",
    desc_en:
      "For video interviews, frames are sent for body-language and eye-contact analysis. Analyzed transiently; not stored externally.",
    required: false,
  },
  {
    key: "cv_third_party_ai",
    title_ar: "تحليل السيرة الذاتية بالذكاء الاصطناعي",
    title_en: "CV analysis with AI",
    desc_ar:
      "يُحلَّل محتوى سيرتك الذاتية بنماذج ذكاء اصطناعي لتقديم تقييم واقتراحات. يمكن إلغاء هذه الموافقة في أي وقت.",
    desc_en:
      "Your CV content is analyzed by AI models to provide evaluation and suggestions. You can revoke this consent at any time.",
    required: false,
  },
];

type ConsentMap = Record<string, boolean>;

const ConsentBanner = ({ language = "ar" }: { language?: "ar" | "en" }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<ConsentMap>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const dir = language === "ar" ? "rtl" : "ltr";
  const t = language === "ar"
    ? {
        title: "موافقات حماية البيانات (PDPL)",
        intro:
          "قبل استخدام مزايا الذكاء الاصطناعي، نحتاج موافقتك على كيفية معالجة بياناتك. يمكنك تغيير اختياراتك لاحقاً من الإعدادات.",
        privacyLink: "قراءة سياسة الخصوصية الكاملة",
        save: "حفظ الموافقات",
        skip: "لاحقاً",
        required: "(مطلوبة)",
        optional: "(اختيارية)",
      }
    : {
        title: "Data Privacy Consent (PDPL)",
        intro:
          "Before using AI features, we need your consent on how your data is processed. You can change choices anytime in settings.",
        privacyLink: "Read full privacy policy",
        save: "Save consents",
        skip: "Later",
        required: "(required)",
        optional: "(optional)",
      };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_consents" as any)
        .select("consent_type, granted, revoked_at")
        .eq("user_id", user.id);
      const granted = new Set<string>();
      for (const row of (data as any[]) ?? []) {
        if (row.granted && !row.revoked_at) granted.add(row.consent_type);
      }
      setExisting(granted);
      // Pre-fill selections with existing state
      const init: ConsentMap = {};
      for (const c of CONSENT_TYPES) init[c.key] = granted.has(c.key);
      setSelections(init);
      setLoaded(true);

      // Auto-open if any required consent missing
      const missingRequired = CONSENT_TYPES.some(
        (c) => c.required && !granted.has(c.key),
      );
      if (missingRequired) setOpen(true);
    };
    load();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const rows = CONSENT_TYPES.map((c) => ({
        user_id: user.id,
        consent_type: c.key,
        granted: !!selections[c.key],
        version: "v1",
      }));

      // upsert each
      for (const r of rows) {
        await supabase.from("user_consents" as any).upsert(r as any, {
          onConflict: "user_id,consent_type,version",
        });
      }
      toast.success(language === "en" ? "Consents saved" : "تم حفظ الموافقات");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(language === "en" ? "Save failed" : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded || !user) return null;

  const canSave = CONSENT_TYPES.filter((c) => c.required).every((c) => selections[c.key]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <DialogTitle>{t.title}</DialogTitle>
          </div>
          <DialogDescription className="leading-relaxed">{t.intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {CONSENT_TYPES.map((c) => (
            <Card key={c.key} className="rounded-xl">
              <CardContent className="p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={!!selections[c.key]}
                    onCheckedChange={(v) =>
                      setSelections((s) => ({ ...s, [c.key]: !!v }))
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {language === "en" ? c.title_en : c.title_ar}
                      </span>
                      <span
                        className={
                          c.required
                            ? "text-xs text-red-600 dark:text-red-400"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {c.required ? t.required : t.optional}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      {language === "en" ? c.desc_en : c.desc_ar}
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t">
          <a
            href="#/privacy"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {t.privacyLink}
          </a>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t.skip}
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={!canSave || saving}
              className="rounded-xl"
            >
              <ShieldCheck className="w-3.5 h-3.5 ml-1.5" />
              {t.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentBanner;
