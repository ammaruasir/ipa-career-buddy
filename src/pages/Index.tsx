import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GraduationCap,
  PenLine,
  MessagesSquare,
  ScanSearch,
  Briefcase,
  Users,
  Shield,
  Brain,
  FileText,
  LogIn,
  UserPlus,
  Menu,
  Star,
  ChevronLeft,
  Award,
  TrendingUp,
  CheckCircle2,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Mic,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "الرئيسية", href: "#" },
  { label: "ماذا نقدّم", href: "#features" },
  { label: "كيف نعمل", href: "#how-it-works" },
  { label: "ما يميّزنا", href: "#differentiators" },
  { label: "تواصل", href: "#footer" },
];

const Index = () => {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "م";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── Sticky Navigation ── */}
      <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/ipa-logo.png"
              alt="معهد الإدارة العامة"
              className="w-11 h-11 rounded-xl object-contain shadow-md group-hover:shadow-lg transition-shadow"
            />
            <div className="hidden sm:block">
              <h2 className="text-base font-bold text-foreground leading-tight">
                منصّة تدريب IPA الذكية
              </h2>
              <p className="text-[11px] text-muted-foreground">
                تدرّب · ابنِ سيرتك · انطلق للوظيفة الحكومية
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border p-0.5 hover:border-primary/40 transition-colors">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      لوحة التحكم
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 text-destructive">
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login" className="gap-1.5">
                    <LogIn className="w-4 h-4" />
                    تسجيل الدخول
                  </Link>
                </Button>
                <Button size="sm" className="rounded-xl" asChild>
                  <Link to="/login?tab=signup" className="gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    ابدأ مجاناً
                  </Link>
                </Button>
              </div>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-12">
                <nav className="flex flex-col gap-1">
                  {navLinks.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="px-4 py-3 text-base font-medium text-foreground hover:bg-muted rounded-xl transition-colors"
                    >
                      {l.label}
                    </a>
                  ))}
                  <div className="border-t border-border my-3" />
                  {!user && (
                    <>
                      <Button variant="outline" className="w-full rounded-xl" asChild>
                        <Link to="/login" onClick={() => setMobileOpen(false)}>تسجيل الدخول</Link>
                      </Button>
                      <Button className="w-full rounded-xl mt-2" asChild>
                        <Link to="/login?tab=signup" onClick={() => setMobileOpen(false)}>ابدأ مجاناً</Link>
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 hero-gradient opacity-90" />
        <div className="absolute top-20 right-[10%] w-72 h-72 rounded-full bg-secondary/10 blur-3xl animate-float" />
        <div className="absolute bottom-10 left-[15%] w-56 h-56 rounded-full bg-primary/10 blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-7">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full text-sm font-semibold border border-primary/20">
              <Shield className="w-4 h-4" />
              معهد الإدارة العامة (IPA) · متوافقة مع رؤية ٢٠٣٠
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.15] tracking-tight">
              تدرّب · ابنِ سيرتك
              <br />
              <span className="text-primary">انطلق للوظيفة الحكومية</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              منصّة تدريب متكاملة بـ AI عربي. تدرّب على المقابلات بأمان، ابنِ سيرتك بطرق متعدّدة،
              واحصل على تغذية راجعة تعليمية تشرح لك "لماذا" — لا فقط درجة.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                size="lg"
                className="rounded-2xl text-base px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
                asChild
              >
                <Link to={user ? "/dashboard" : "/login?tab=signup"}>
                  ابدأ التدريب المجاني
                  <ChevronLeft className="w-5 h-5 mr-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-2xl text-base px-10 py-7 border-2"
                asChild
              >
                <a href="#features">اعرف ماذا نقدّم</a>
              </Button>
            </div>
          </div>

          {/* Stats — training-first */}
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-6 shadow-lg">
              {[
                { value: "آمن للفشل", label: "وضع تدريب خاص بك", icon: GraduationCap },
                { value: "STAR + DISC", label: "تحليل لكل إجابة", icon: Brain },
                { value: "٣ طرق للسيرة", label: "محادثة · يدوي · تقييم", icon: FileText },
              ].map((stat, i) => (
                <div key={i} className="text-center space-y-1">
                  <stat.icon className="w-5 h-5 mx-auto text-secondary mb-1" />
                  <p className="text-xl md:text-2xl font-extrabold text-primary">{stat.value}</p>
                  <p className="text-xs md:text-sm text-muted-foreground font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid (6 cards) ── */}
      <section id="features" className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">ماذا نقدّم</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              منصّة كاملة لرحلتك التدريبية
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              من جلسة التدريب الأولى إلى المقابلة الحقيقية — كل أداة تحتاجها بالعربية الفصحى ودعم
              إنجليزي.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: GraduationCap,
                title: "وضع التدريب (آمن للفشل)",
                desc: "كل جلسة تدريب خاصّة بك. لا يراها HR. تخطئ، تتعلّم، تكرّر بدون قلق.",
                badges: ["practice mode", "STAR coaching"],
                href: "/login?tab=signup",
                grad: "from-emerald-500 to-emerald-300",
              },
              {
                icon: Target,
                title: "تقييم رسمي بمعايير IPA",
                desc: "عند الجاهزية، شغّل وضع التقييم. DISC + ٥ أبعاد + توصية معتمَدة للوظائف الحكومية.",
                badges: ["DISC", "٥ أبعاد"],
                href: "/jobs",
                grad: "from-primary to-primary/60",
              },
              {
                icon: PenLine,
                title: "منشئ سيرة ذاتية ذكي",
                desc: "Stepper من ٧ خطوات. اكتب وصفاً حرّاً، AI يحوّله إلى STAR bullets احترافية.",
                badges: ["AI assist", "حفظ تلقائي"],
                href: "/cv/builder",
                grad: "from-secondary to-secondary/60",
              },
              {
                icon: MessagesSquare,
                title: "سيرة من الصفر بالمحادثة",
                desc: "١٥ سؤال موجَّه. AI يقترح إجابات. تنتهي بمسوّدة سيرة جاهزة للتعديل.",
                badges: ["محادثة موجَّهة", "جديد"],
                href: "/cv/interview",
                grad: "from-amber-500 to-amber-300",
              },
              {
                icon: ScanSearch,
                title: "تقييم وحوار حول سيرتك",
                desc: "ارفع PDF. احصل على radar للأقسام، اقتراحات، ومحادثة تشرح لماذا كل ملاحظة.",
                badges: ["justifications", "PDPL آمن"],
                href: "/cv/review",
                grad: "from-purple-500 to-purple-300",
              },
              {
                icon: Users,
                title: "للمدرّبين: لوحة الدفعات",
                desc: "أنشئ دفعات IPA، تابع تقدّم الطلاب، أضف تعليقات timestamped على إجاباتهم.",
                badges: ["IPA-grade", "RLS-secure"],
                href: "/dashboard/instructor",
                grad: "from-blue-500 to-blue-300",
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <Card
                  key={i}
                  className="group rounded-2xl border-2 border-transparent hover:border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  <div className={`h-1.5 bg-gradient-to-l ${f.grad}`} />
                  <CardContent className="p-6 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {f.badges.map((b) => (
                        <span
                          key={b}
                          className="text-[11px] bg-primary/5 text-primary px-2.5 py-1 rounded-full font-medium"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={f.href}
                      className="inline-flex items-center text-sm text-primary hover:underline pt-1"
                    >
                      تجربة الميزة
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Button variant="outline" size="lg" className="rounded-2xl" asChild>
              <Link to="/features">
                صفحة المزايا الكاملة
                <ChevronLeft className="w-5 h-5 mr-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Three Learning Paths ── */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">كيف تعمل</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">ثلاث رحلات تعليمية</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              اختر مسارك بحسب موقعك من رحلة الوظيفة.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                step: "١",
                title: "المسار التدريبي",
                color: "emerald",
                stages: [
                  "ابدأ جلسة practice",
                  "تتلقّى STAR coaching لكل إجابة",
                  "ترى الفجوات وتكرّر",
                ],
                outcome: "جاهزية للمقابلات الحقيقية",
              },
              {
                step: "٢",
                title: "مسار السيرة الذاتية",
                color: "amber",
                stages: [
                  "محادثة / منشئ يدوي / رفع موجود",
                  "AI يحلّل ويقترح",
                  "تحدّث مع سيرتك للتفهّم",
                ],
                outcome: "سيرة معتمَدة لـ IPA",
              },
              {
                step: "٣",
                title: "المسار المؤسسي (للمدرّبين)",
                color: "primary",
                stages: [
                  "إنشاء دفعة + تسجيل طلاب",
                  "إنشاء مهام + متابعة",
                  "تعليقات timestamped",
                ],
                outcome: "تقدّم قابل للقياس",
              },
            ].map((p, i) => (
              <Card key={i} className="rounded-2xl shadow-lg overflow-hidden">
                <div
                  className={`p-5 text-center bg-${p.color}-500/10 border-b border-${p.color}-500/20`}
                >
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${p.color}-500/20 text-${p.color}-700 dark:text-${p.color}-300 font-bold text-lg mb-2`}
                  >
                    {p.step}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{p.title}</h3>
                </div>
                <CardContent className="p-5 space-y-3">
                  <ul className="space-y-2">
                    {p.stages.map((s, si) => (
                      <li key={si} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">الناتج:</p>
                    <p className="text-sm font-semibold text-foreground">{p.outcome}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Differentiators ── */}
      <section id="differentiators" className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">ما يميّزنا</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              لماذا منصّة IPA وليس أداة عامّة؟
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {[
              {
                icon: Mic,
                title: "صوت سعودي حقيقي",
                desc: "محاوِر بصوت ElevenLabs العربي — هيثم/سناء.",
              },
              {
                icon: Brain,
                title: "تغذية STAR + إعادة كتابة",
                desc: "لكل إجابة: تحليل، نسخة محسّنة، وإجابة نموذجية.",
              },
              {
                icon: Sparkles,
                title: "Justifications لكل ملاحظة",
                desc: "تتعلّم لماذا — لا فقط ماذا. observation + rule + why.",
              },
              {
                icon: ShieldCheck,
                title: "PDPL + RLS صارم",
                desc: "موافقات صريحة + rate limiting + اعتماد ملكية.",
              },
            ].map((d, i) => {
              const Icon = d.icon;
              return (
                <Card key={i} className="rounded-2xl text-center p-5 shadow-md">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/10 flex items-center justify-center mb-3">
                    <Icon className="w-6 h-6 text-secondary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1.5">{d.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">آراء المستخدمين</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">من تجارب طلاب IPA</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "أحمد الغامدي",
                role: "طالب IPA — برنامج الإدارة العامة",
                quote:
                  "وضع التدريب غيّر كل شيء. كنت أتجمّد في المقابلات السابقة. الآن أدخل ٥ جلسات practice، أقرأ الـ STAR coaching، أتحسّن. مقابلتي الرسمية كانت أسهل من التدريبات.",
              },
              {
                name: "نورة القحطاني",
                role: "خرّيجة موارد بشرية",
                quote:
                  "بدأت سيرتي من الصفر بالمحادثة — ١٥ سؤال فقط، وحصلت على مسوّدة احترافية. ثم استخدمت تقييم السيرة وفهمت لماذا قسم الإنجازات لديّ ضعيف، مع أمثلة محدّدة.",
              },
              {
                name: "د. خالد العنزي",
                role: "مدرّب IPA",
                quote:
                  "لوحة الدفعات وفّرت عليّ ساعات. أضع تعليقات على لحظة محدّدة من فيديو الطالب، وهو يرى التعليق مع timestamp. التعلّم تسارع.",
              },
            ].map((t, i) => (
              <Card key={i} className="rounded-2xl shadow-md hover:shadow-lg transition-shadow border-0 bg-background">
                <CardContent className="p-7 space-y-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, si) => (
                      <Star key={si} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-foreground leading-relaxed text-sm">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {t.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-primary rounded-3xl p-12 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-bl from-primary via-primary to-primary/80" />
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-secondary/20 blur-3xl" />
            <div className="relative z-10 space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground">
                ابدأ رحلتك التدريبية مع IPA
              </h2>
              <p className="text-primary-foreground/80 text-base max-w-md mx-auto">
                مجّاناً. خمس دقائق لإنشاء حسابك، وأنت في وضع التدريب الأوّل.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="rounded-2xl text-base px-10 py-7 shadow-lg hover:shadow-xl transition-all"
                asChild
              >
                <Link to="/login?tab=signup">
                  أنشئ حسابك المجاني
                  <ChevronLeft className="w-5 h-5 mr-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="footer" className="border-t border-border bg-card pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="/ipa-logo.png" alt="IPA" className="w-10 h-10 rounded-xl object-contain" />
                <div>
                  <h3 className="font-bold text-foreground">منصّة تدريب IPA</h3>
                  <p className="text-xs text-muted-foreground">إعداد للوظائف الحكومية بالذكاء الاصطناعي</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                منصّة تدريب رائدة لإعداد الكوادر السعودية للقطاع العام — تدريب مقابلات + سيرة ذاتية +
                تغذية تعليمية تشرح "لماذا".
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-foreground">الميزات</h3>
              <ul className="space-y-2">
                {[
                  { l: "وضع التدريب", h: "#features" },
                  { l: "منشئ السيرة", h: "/cv/builder" },
                  { l: "تقييم السيرة + chat", h: "/cv/review" },
                  { l: "للمدرّبين", h: "/dashboard/instructor" },
                  { l: "صفحة المزايا الكاملة", h: "/features" },
                ].map((l) => (
                  <li key={l.l}>
                    {l.h.startsWith("#") ? (
                      <a href={l.h} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l.l}
                      </a>
                    ) : (
                      <Link to={l.h} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l.l}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-foreground">تواصل ومعلومات</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>البريد: info@ipa-training.sa</li>
                <li>الرياض، المملكة العربية السعودية</li>
                <li>متوافقة مع نظام حماية البيانات (PDPL)</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} منصّة تدريب IPA — جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
