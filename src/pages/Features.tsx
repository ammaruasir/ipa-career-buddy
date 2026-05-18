import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Target,
  PenLine,
  MessagesSquare,
  ScanSearch,
  Users,
  Mic,
  Brain,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Lock,
  Zap,
  BookOpen,
} from "lucide-react";

const sections = [
  {
    id: "training-mode",
    icon: GraduationCap,
    title: "وضع التدريب مقابل وضع التقييم",
    subtitle: "تدريب خاص بك — هذا هو الفرق",
    color: "emerald",
    body: [
      "كل جلسة تبدأها هي إمّا 'تدريب' (الافتراضي) أو 'تقييم رسمي'. الفرق ليس تجميلياً.",
      "في وضع التدريب: لا أحد من فريق HR يرى جلستك. لا تأثير على أي تقييم رسمي. تخطئ، تتعلّم، تكرّر بدون قلق.",
      "في وضع التقييم: نتيجة كاملة تصل لـ HR، تُحدَّث في pipeline التوظيف، يعمل محرك واكب للذكاء الاصطناعي بأعلى دقّة.",
    ],
    features: [
      "Row-Level Security يمنع HR من رؤية جلسات التدريب",
      "وضع تدريب أخفّ من محرك واكب لخفض التكلفة دون التأثير على جودة التقييم الرسمي",
      "Banner مرئي يذكّرك أنّك في تدريب",
    ],
    cta: { label: "ابدأ جلسة تدريب", href: "/interview/text?practice=true" },
  },
  {
    id: "star-coaching",
    icon: Brain,
    title: "تغذية راجعة STAR لكل إجابة",
    subtitle: "ليس رقماً — تعلّماً منهجياً",
    color: "primary",
    body: [
      "بعد كل جلسة تدريب، تحصل لكل سؤال على: نسبة تغطية STAR (الموقف/المهمّة/الإجراء/النتيجة)، إعادة كتابة لإجابتك بالعربية الفصحى، وإجابة نموذجية للمقارنة.",
      "لا تخمين من جانبك. كل ملاحظة فيها: ما لاحظناه (observation)، القاعدة المخالَفة (rule)، لماذا تهمّ (why_it_matters)، ومثال أفضل.",
    ],
    features: [
      "STAR meter بصري لكل إجابة",
      "نسخة محسّنة + إجابة نموذجية جنباً إلى جنب",
      "كلمات الحشو مرصودة بوقت محدّد في الفيديو",
    ],
    cta: { label: "شاهد مثال coaching", href: "/dashboard/candidate" },
  },
  {
    id: "cv-interview",
    icon: MessagesSquare,
    title: "ابنِ سيرتك من الصفر بالمحادثة",
    subtitle: "للخريجين الجدد ومن لا يعرف من أين يبدأ",
    color: "amber",
    body: [
      "بدلاً من شاشة فارغة، يحاورك AI بـ ١٥ سؤالاً موجَّهاً: مستوى خبرتك، الوظيفة المستهدفة، آخر إنجازاتك، إلخ.",
      "لكل سؤال — إن أردت — تطلب اقتراحاً من AI كنقطة بداية. تقبل، تعدّل، أو تكتب من جديد.",
      "في النهاية: مسوّدة سيرة كاملة جاهزة في المنشئ للتعديل النهائي.",
    ],
    features: [
      "ثنائية اللغة (عربي / إنجليزي / كلاهما)",
      "AI suggestion في كل سؤال (اختياري)",
      "حفظ تلقائي — يمكنك العودة لاحقاً",
    ],
    cta: { label: "ابدأ من الصفر", href: "/cv/interview" },
  },
  {
    id: "cv-builder",
    icon: PenLine,
    title: "منشئ يدوي مع AI assist",
    subtitle: "تحكّم كامل، ومساعدة عند الطلب",
    color: "secondary",
    body: [
      "Stepper من ٧ خطوات: البيانات الشخصية → الملخّص → الخبرة → التعليم → المهارات → الشهادات → معاينة.",
      "في كل قسم: زر ✨ AI لتحويل ما تكتبه إلى صيغة احترافية. خصوصاً في الخبرة: اكتب وصفاً حرّاً، AI يحوّله إلى STAR bullets قابلة للقبول/التعديل.",
    ],
    features: [
      "حفظ تلقائي كل ١.٥ ثانية",
      "٣ قوالب: محافظ / حديث / تنفيذي",
      "RTL + معاينة فورية",
    ],
    cta: { label: "افتح المنشئ", href: "/cv/builder" },
  },
  {
    id: "cv-review",
    icon: ScanSearch,
    title: "تقييم سيرتك + محادثة معها",
    subtitle: "اعرف ما الذي يحتاج تحسيناً ولماذا",
    color: "purple",
    body: [
      "ارفع PDF سيرتك. خلال ٣٠ ثانية: radar chart لجودة كل قسم (Contact / Summary / Experience / Education / Skills / Achievements / Language quality)، قائمة نقاط الضعف باقتباس حرفي، اقتراحات إعادة كتابة، وفحص الامتثال السعودي (تواريخ هجرية، خدمة العلم، رابط جدارات).",
      "ثمّ تحدّث مع سيرتك. اسأل 'لماذا قسم خبرتي ضعيف؟'، 'كيف أحسّن الملخّص؟'، 'هل سيرتي مناسبة لوظيفة حكومية؟'. كل جواب فيه justification يشرح المنطق.",
    ],
    features: [
      "Radar chart ٧ أبعاد",
      "اقتراحات إعادة كتابة قابلة للتطبيق",
      "فحص امتثال PDPL",
      "محادثة multi-turn مع التبرير",
    ],
    cta: { label: "حلّل سيرتي", href: "/cv/review" },
  },
  {
    id: "question-bank",
    icon: BookOpen,
    title: "بنك أسئلة IPA — جدارات حكومية",
    subtitle: "محتوى متخصّص للقطاع العام السعودي",
    color: "blue",
    body: [
      "بنك أسئلة منظَّم حسب: ٨ مسارات وظيفية (HR، IT، مالية، إدارة عامة، إدارة معلومات، مكتبات، تحوّل رقمي، خدمة المواطن) و٨ جدارات (اتخاذ القرار، خدمة المواطن، العمل الجماعي، الأخلاقيات، إلخ).",
      "كل سؤال: مستوى صعوبة، إجابة نموذجية، معايير STAR rubric، وحالة (draft / review / approved). محتوى جاهز للنمو مع خبراء IPA.",
    ],
    features: [
      "٨ مسارات × ٨ جدارات",
      "حوكمة محتوى: draft → review → approved",
      "إجابات نموذجية بالعربية والإنجليزية",
    ],
    cta: null,
  },
  {
    id: "instructor",
    icon: Users,
    title: "للمدرّبين والجامعات — لوحة الدفعات",
    subtitle: "تدريب جماعي بقابلية قياس",
    color: "teal",
    body: [
      "أنشئ دفعات، سجّل طلاباً، أنشئ مهام (مقابلة / سيرة / اختبار / تأمّل) مع موعد تسليم. تابع تقدّم كل طالب.",
      "أهمّ ميزة: تعليقات timestamped على لحظات محدّدة في فيديو إجابة الطالب. الطالب يفتح التعليق، ينقر، الفيديو يقفز للحظة. تعلّم سياقي حقيقي.",
    ],
    features: [
      "RLS: المدرّب يرى دفعاته فقط",
      "تعليقات بـ timestamp على الفيديو",
      "تتبّع المهام + تواريخ التسليم",
    ],
    cta: { label: "لوحة المدرّب", href: "/dashboard/instructor" },
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "أمان وخصوصية بمعايير سعودية",
    subtitle: "PDPL + RLS صارم + موافقات صريحة",
    color: "rose",
    body: [
      "كل بيانات الطالب محميّة بـ Row-Level Security على مستوى Postgres. لا تسرّب بين الطلاب، لا تسرّب من تدريب لتقييم، لا تسرّب بين دفعات.",
      "موافقات PDPL صريحة قبل إرسال أي صوت/فيديو/سيرة لمحرك واكب للذكاء الاصطناعي. يمكن إلغاء الموافقة في أي وقت.",
      "Rate limiting per-user (٥-٣٠ طلب/دقيقة حسب الـ endpoint). حماية ضد prompt injection: تنظيف input + delimiters صارمة في الـ prompts.",
    ],
    features: [
      "PDPL compliant",
      "RLS على مستوى Postgres",
      "Rate limiting per-user",
      "Prompt injection guards",
      "Audit trail للموافقات",
    ],
    cta: null,
  },
];

const Features = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero */}
      <section className="py-20 bg-gradient-to-bl from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-semibold border border-primary/20 mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            صفحة المزايا الكاملة
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight mb-4">
            كل ما تقدّمه المنصّة — بالتفصيل
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            دليل شامل لكل ميزة، كيف تعمل، ولماذا بُنيَت بهذه الطريقة.
          </p>
        </div>
      </section>

      {/* Sections */}
      <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
        {sections.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={s.id} id={s.id} className="rounded-2xl shadow-lg overflow-hidden">
              <div className={`h-1.5 bg-${s.color}-500`} />
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-${s.color}-500/15 flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`w-7 h-7 text-${s.color}-700 dark:text-${s.color}-300`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant="outline" className="text-[10px] mb-1">
                      الميزة {i + 1} من {sections.length}
                    </Badge>
                    <h2 className="text-xl md:text-2xl font-bold text-foreground">{s.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{s.subtitle}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {s.body.map((p, pi) => (
                    <p key={pi} className="text-sm md:text-base text-foreground leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-2 pt-2">
                  {s.features.map((f, fi) => (
                    <div
                      key={fi}
                      className="flex items-start gap-2 text-sm p-2.5 rounded-lg bg-muted/40"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {s.cta && (
                  <div className="pt-3 border-t border-border">
                    <Button asChild className="rounded-xl">
                      <Link to={s.cta.href}>
                        {s.cta.label}
                        <ChevronLeft className="w-4 h-4 mr-1" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Final CTA */}
        <div className="rounded-3xl bg-primary p-10 md:p-14 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-bl from-primary via-primary to-primary/80" />
          <div className="relative z-10 space-y-5">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground">
              جاهز للبدء؟
            </h2>
            <p className="text-primary-foreground/80 max-w-md mx-auto">
              أنشئ حسابك وادخل وضع التدريب في أقلّ من دقيقتين.
            </p>
            <Button size="lg" variant="secondary" className="rounded-2xl px-10 py-7" asChild>
              <Link to="/login?tab=signup">
                ابدأ الآن
                <ChevronLeft className="w-5 h-5 mr-1" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            العودة للرئيسية
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Features;
