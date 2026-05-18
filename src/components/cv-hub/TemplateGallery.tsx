// TemplateGallery — visual picker shown above the drafts list in /cv.
// Clicking a template creates a new draft pre-set to that template and
// redirects to the builder.

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Palette, Sparkles } from "lucide-react";
import { TEMPLATES, type TemplateMeta, type CVTDraft } from "@/components/cv-templates";
import { cn } from "@/lib/utils";

const SAMPLE_DRAFT: CVTDraft = {
  personal_info: {
    full_name: "محمد عبدالله",
    email: "name@example.com",
    phone: "+966 5XX XXX XXX",
    city: "الرياض",
  },
  summary: {
    ar: "محلّل سياسات بـ ٧ سنوات خبرة في القطاع الحكومي، خفّض زمن المعاملات بـ ٤٠٪ في الجهة الأخيرة.",
    en: "Policy analyst with 7 years in public sector.",
  },
  experience: [
    {
      position: "محلّل سياسات أوّل",
      company: "وزارة المالية",
      start: "2020",
      end: "2026",
      bullets: ["قاد فريقاً من ٨ موظفين", "خفّض زمن إصدار التراخيص ٤٠٪"],
    },
    {
      position: "محلّل سياسات",
      company: "هيئة الإحصاء",
      start: "2018",
      end: "2020",
      bullets: ["طوّر ٣ تقارير ربعية"],
    },
  ],
  education: [
    { degree: "بكالوريوس", major: "الإدارة العامة", institution: "جامعة الملك سعود", start: "2014", end: "2018", gpa: "4.6/5" },
  ],
  skills: {
    technical: ["Excel متقدّم", "Power BI", "SQL", "تحليل سياسات"],
    soft: ["العمل الجماعي", "اتخاذ القرار"],
    languages: ["العربية (الأم)", "English (C1)"],
  },
  certifications: [
    { name: "PMP", issuer: "PMI", date: "2024" },
  ],
  custom_sections: {
    volunteer: [
      { role: "متطوّع", organization: "جمعية إحسان", start: "2022", end: "2024", description: "تنظيم برامج تأهيلية" },
    ],
    languages_structured: [
      { name: "العربية", cefr: "native" },
      { name: "English", cefr: "C1" },
    ],
  },
  section_order: null,
  template: "modern",
  language: "ar",
};

const TemplateGallery = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState<string | null>(null);

  const createWithTemplate = async (tpl: TemplateMeta) => {
    if (!user) return;
    setCreating(tpl.key);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", user.id)
        .maybeSingle();

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
          custom_sections: {},
          section_order: null,
          template: tpl.key,
          language: "ar",
        })
        .select()
        .single();

      if (error) throw error;
      if (data) navigate(`/cv/builder?draft=${(data as any).id}`);
    } catch (e) {
      console.error(e);
      toast.error("فشل إنشاء مسوّدة");
      setCreating(null);
    }
  };

  return (
    <section className="space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <Palette className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">القوالب</h2>
        <Badge variant="secondary" className="text-[10px] font-normal">
          اختر قالباً وابدأ
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEMPLATES.map((tpl) => {
          const Preview = tpl.Component;
          const isCreating = creating === tpl.key;
          return (
            <Card
              key={tpl.key}
              className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 border-2 border-transparent hover:border-primary/30 flex flex-col"
            >
              {/* Thumbnail */}
              <div
                className="relative h-64 overflow-hidden bg-muted/30 border-b border-border cursor-pointer"
                onClick={() => createWithTemplate(tpl)}
              >
                {/* Real component, scaled-down */}
                <div
                  className="absolute inset-0 origin-top-right pointer-events-none"
                  style={{
                    transform: "scale(0.32)",
                    transformOrigin: "top right",
                    width: "312%",
                    height: "312%",
                  }}
                >
                  <Preview draft={SAMPLE_DRAFT} thumbnail />
                </div>
                {tpl.badge_ar && (
                  <Badge
                    className="absolute top-2 start-2 bg-emerald-500/90 text-white border-0 text-[10px] gap-1 shadow"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    {tpl.badge_ar}
                  </Badge>
                )}
              </div>

              <CardContent className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">{tpl.label_ar}</h3>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tpl.accent }}
                    title={tpl.accent}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {tpl.description_ar}
                </p>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                  <span className="opacity-70">الأنسب لـ:</span> {tpl.bestFor_ar}
                </div>
                <Button
                  onClick={() => createWithTemplate(tpl)}
                  disabled={isCreating}
                  className={cn("w-full rounded-xl mt-1")}
                  size="sm"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 ml-2 animate-spin" />
                      جارٍ الإنشاء...
                    </>
                  ) : (
                    "ابدأ بهذا القالب"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default TemplateGallery;
