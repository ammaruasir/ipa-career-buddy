import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessagesSquare,
  PenLine,
  ScanSearch,
  ChevronLeft,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

type CVPath = {
  icon: typeof MessagesSquare;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  href: string;
  color: string;
  badge?: string;
  gradient: string;
};

const PATHS: CVPath[] = [
  {
    icon: MessagesSquare,
    title: "ابدأ من الصفر بالمحادثة",
    description:
      "١٥ سؤال موجَّه، واكب AI يقترح إجابات نموذجية، وفي النهاية تحصل على مسوّدة سيرة جاهزة للتعديل.",
    bullets: ["مناسب للخريجين الجدد", "اقتراحات واكب AI في كل سؤال", "٥-٧ دقائق"],
    cta: "ابدأ المحادثة",
    href: "/cv/interview",
    color: "primary",
    badge: "موصى به",
    gradient: "from-primary to-primary/60",
  },
  {
    icon: PenLine,
    title: "أنشئ بنفسك خطوة بخطوة",
    description:
      "Stepper من ٧ خطوات. تكتب بنفسك مع زر AI لتحويل أي وصف إلى STAR bullets احترافية بالعربية الفصحى.",
    bullets: ["تحكّم كامل", "AI assist عند الطلب", "حفظ تلقائي"],
    cta: "افتح المنشئ",
    href: "/cv/builder",
    color: "secondary",
    gradient: "from-secondary to-secondary/60",
  },
  {
    icon: ScanSearch,
    title: "حلّل سيرتي وتحدّث معها",
    description:
      "ارفع PDF سيرتك الحالية، احصل على تقييم Radar لكل قسم، اقتراحات إعادة كتابة، ومحادثة AI تشرح لماذا.",
    bullets: ["تحليل ٧ أقسام", "محادثة مع التبرير", "فحص امتثال سعودي"],
    cta: "حلّل سيرتي",
    href: "/cv/review",
    color: "accent",
    gradient: "from-amber-500 to-amber-300",
  },
] as const;

const CVHubSection = () => {
  return (
    <section className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-foreground">السيرة الذاتية</h2>
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              <Sparkles className="w-3 h-3 ml-1" />
              جديد
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            ثلاث طرق لبناء سيرتك — اختر ما يناسبك. كلها بـ AI ودعم عربي + إنجليزي.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PATHS.map((p) => {
          const Icon = p.icon;
          return (
            <Card
              key={p.href}
              className="group rounded-2xl border-2 border-transparent hover:border-primary/20 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
            >
              <div className={`h-1.5 bg-gradient-to-l ${p.gradient}`} />
              <CardContent className="p-5 flex flex-col flex-1 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {p.badge && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                      {p.badge}
                    </Badge>
                  )}
                </div>

                <h3 className="text-base font-bold text-foreground">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>

                <ul className="space-y-1 mt-1">
                  {p.bullets.map((b, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-3">
                  <Button asChild className="w-full rounded-xl">
                    <Link to={p.href}>
                      {p.cta}
                      <ChevronLeft className="w-4 h-4 mr-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default CVHubSection;
