import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Mic,
  Video,
  GraduationCap,
  BarChart3,
  Shield,
  Brain,
  FileText,
  LogIn,
  UserPlus,
  Menu,
  X,
  Star,
  ChevronLeft,
  Award,
  Users,
  TrendingUp,
  CheckCircle2,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "الرئيسية", href: "#" },
  { label: "المقابلات", href: "#features" },
  { label: "كيف تعمل", href: "#how-it-works" },
  { label: "الدعم", href: "#footer" },
];

const Index = () => {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "م";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Navigation ── */}
      <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-base font-bold text-foreground leading-tight">معهد الإدارة العامة</h2>
              <p className="text-[11px] text-muted-foreground">منصة المقابلات الذكية</p>
            </div>
          </Link>

          {/* Desktop nav links */}
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

          {/* Auth area */}
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
                    إنشاء حساب
                  </Link>
                </Button>
              </div>
            )}

            {/* Mobile menu */}
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
                        <Link to="/login?tab=signup" onClick={() => setMobileOpen(false)}>إنشاء حساب</Link>
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden py-24 md:py-36">
        {/* Animated gradient bg */}
        <div className="absolute inset-0 hero-gradient opacity-90" />
        {/* Decorative floating shapes */}
        <div className="absolute top-20 right-[10%] w-72 h-72 rounded-full bg-secondary/10 blur-3xl animate-float" />
        <div className="absolute bottom-10 left-[15%] w-56 h-56 rounded-full bg-primary/10 blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full text-sm font-semibold border border-primary/20">
              <Shield className="w-4 h-4" />
              مدعوم بالذكاء الاصطناعي المتقدم
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.15] tracking-tight">
              المقابلات الذكية
              <br />
              <span className="text-primary">مستقبل التوظيف يبدأ هنا</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              منصة متطورة باستخدام الذكاء الاصطناعي لإعداد طلاب معهد الإدارة العامة لسوق العمل
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button
                size="lg"
                className="rounded-2xl text-base px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
                asChild
              >
                <Link to="/interview/text">
                  ابدأ المقابلة التجريبية
                  <ChevronLeft className="w-5 h-5 mr-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-2xl text-base px-10 py-7 border-2"
                asChild
              >
                <a href="#features">تعرف على المزيد</a>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-6 shadow-lg">
              {[
                { value: "١٠٠٠+", label: "مقابلة مكتملة", icon: Users },
                { value: "٩٥%", label: "دقة التحليل", icon: TrendingUp },
                { value: "٥٠+", label: "شركة شريكة", icon: Award },
              ].map((stat, i) => (
                <div key={i} className="text-center space-y-1">
                  <stat.icon className="w-5 h-5 mx-auto text-secondary mb-1" />
                  <p className="text-2xl md:text-3xl font-extrabold text-primary">{stat.value}</p>
                  <p className="text-xs md:text-sm text-muted-foreground font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">مميزات المنصة</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">كل ما تحتاجه للتميز في المقابلات</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">أدوات متقدمة مصممة خصيصاً لمساعدتك على التحضير والنجاح</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Card 1 */}
            <Card className="group rounded-2xl border-2 border-transparent hover:border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-l from-primary to-primary/60" />
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Video className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">مقابلات فيديو ذكية</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  سجّل مقابلتك بالفيديو واحصل على تحليل فوري يشمل المحتوى ونبرة الصوت والثقة بالنفس باستخدام الذكاء الاصطناعي
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs bg-primary/5 text-primary px-3 py-1 rounded-full font-medium">تحليل الفيديو</span>
                  <span className="text-xs bg-primary/5 text-primary px-3 py-1 rounded-full font-medium">تقييم الثقة</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2 */}
            <Card className="group rounded-2xl border-2 border-transparent hover:border-secondary/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-l from-secondary to-secondary/60" />
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <Brain className="w-7 h-7 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">تحليل الشخصية الآلي</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  تقييم شخصيتك المهنية وفق نموذج DISC لتحديد نقاط القوة وأسلوب العمل المناسب لك ولبيئة العمل المستهدفة
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs bg-secondary/5 text-secondary px-3 py-1 rounded-full font-medium">نموذج DISC</span>
                  <span className="text-xs bg-secondary/5 text-secondary px-3 py-1 rounded-full font-medium">توافق مهني</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3 */}
            <Card className="group rounded-2xl border-2 border-transparent hover:border-accent/40 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-l from-accent to-accent/60" />
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <BarChart3 className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground">تقارير احترافية</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  احصل على تقارير مفصّلة بصيغة PDF تشمل درجاتك التفصيلية ونقاط التحسين مع شهادة إتمام معتمدة
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs bg-accent/10 text-accent-foreground px-3 py-1 rounded-full font-medium">تقرير PDF</span>
                  <span className="text-xs bg-accent/10 text-accent-foreground px-3 py-1 rounded-full font-medium">شهادة إتمام</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">خطوات بسيطة</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">كيف تعمل المنصة؟</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { step: "١", icon: LogIn, title: "سجل الدخول", desc: "سجل الدخول بحسابك في معهد الإدارة العامة" },
              { step: "٢", icon: MessageSquare, title: "اختر نوع المقابلة", desc: "اختر بين المقابلة الكتابية أو الصوتية أو الفيديو" },
              { step: "٣", icon: Mic, title: "أجب على الأسئلة", desc: "أجب على أسئلة الذكاء الاصطناعي المخصصة لمجالك" },
              { step: "٤", icon: Award, title: "احصل على تقييمك", desc: "استلم تقييماً مفصلاً مع شهادة إتمام المقابلة" },
            ].map((item, i) => (
              <div key={i} className="relative text-center group">
                {/* Connector line (hidden on first and mobile) */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-8 -left-4 w-8 h-0.5 bg-border" />
                )}
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors duration-300">
                  <item.icon className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
                </div>
                <span className="inline-block text-xs font-bold text-secondary mb-2">الخطوة {item.step}</span>
                <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-3">
            <span className="text-sm font-semibold text-secondary tracking-wide">آراء المتدربين</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">ماذا يقول طلابنا؟</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "أحمد الغامدي",
                role: "خريج إدارة أعمال",
                quote: "المنصة ساعدتني على اجتياز مقابلتي الأولى بثقة. التقييم الفوري من الذكاء الاصطناعي أظهر لي نقاط ضعفي قبل المقابلة الحقيقية.",
              },
              {
                name: "نورة القحطاني",
                role: "خريجة موارد بشرية",
                quote: "تحليل الشخصية وفق نموذج DISC كان مفيداً جداً. فهمت نقاط قوتي وكيف أقدمها في المقابلات بشكل أفضل.",
              },
              {
                name: "محمد العتيبي",
                role: "خريج تقنية معلومات",
                quote: "أنصح كل طالب في المعهد باستخدام هذه المنصة. التدريب على المقابلة الصوتية كان كأنه مقابلة حقيقية.",
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
              <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground">جاهز لخوض تجربة المقابلة الذكية؟</h2>
              <p className="text-primary-foreground/80 text-base max-w-md mx-auto">
                سجل الآن وابدأ بالتدريب على مقابلاتك الوظيفية مع تقنيات الذكاء الاصطناعي
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
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">معهد الإدارة العامة</h3>
                  <p className="text-xs text-muted-foreground">منصة المقابلات الذكية</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                منصة رائدة في التدريب على المقابلات الوظيفية باستخدام الذكاء الاصطناعي، مصممة خصيصاً لطلاب معهد الإدارة العامة.
              </p>
            </div>

            {/* Quick links */}
            <div className="space-y-4">
              <h3 className="font-bold text-foreground">روابط سريعة</h3>
              <ul className="space-y-2">
                {["سياسة الخصوصية", "الشروط والأحكام", "مركز المساعدة", "تواصل معنا"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="font-bold text-foreground">تواصل معنا</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>البريد: info@ipa.edu.sa</li>
                <li>الهاتف: ٩٢٠٠٠٤٩٥٦</li>
                <li>الرياض، المملكة العربية السعودية</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} معهد الإدارة العامة - جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
