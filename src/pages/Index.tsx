import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Mic, Video, GraduationCap, BarChart3, Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">معهد الإدارة العامة</h2>
              <p className="text-xs text-muted-foreground">منصة المقابلات الذكية</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">تسجيل الدخول</Link>
            </Button>
            <Button className="rounded-xl" asChild>
              <Link to="/login?tab=signup">إنشاء حساب</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-secondary/5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full text-sm font-medium">
              <Shield className="w-4 h-4" />
              مدعوم بالذكاء الاصطناعي
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight">
              استعد لمقابلتك الوظيفية
              <br />
              <span className="text-primary">بثقة واحترافية</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              منصة متكاملة تساعد طلاب معهد الإدارة العامة على التدريب على المقابلات الوظيفية
              باستخدام تقنيات الذكاء الاصطناعي المتقدمة مع تقييم فوري ومفصّل
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="rounded-xl text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-shadow" asChild>
                <Link to="/login?tab=signup">ابدأ التدريب الآن</Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl text-lg px-8 py-6" asChild>
                <Link to="#features">تعرف على المنصة</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">أنماط المقابلات المتاحة</h2>
            <p className="text-muted-foreground text-lg">اختر نمط المقابلة الذي يناسبك وابدأ التدريب</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="group relative overflow-hidden rounded-2xl border-2 border-transparent hover:border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">مقابلة نصية</h3>
                <p className="text-muted-foreground leading-relaxed">
                  تفاعل مع المحاور الذكي عبر الدردشة النصية واحصل على تقييم فوري لإجاباتك
                </p>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">تقييم فوري</span>
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">أسئلة ديناميكية</span>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden rounded-2xl border-2 border-transparent hover:border-secondary/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <Mic className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">مقابلة صوتية</h3>
                <p className="text-muted-foreground leading-relaxed">
                  تحدث بصوتك وسيتم تحليل إجاباتك وتقييم مهارات التواصل اللفظي لديك
                </p>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">تحليل صوتي</span>
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">تحويل للنص</span>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden rounded-2xl border-2 border-transparent hover:border-accent/40 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Video className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground">مقابلة فيديو</h3>
                <p className="text-muted-foreground leading-relaxed">
                  سجّل مقابلتك بالفيديو واحصل على تحليل شامل يشمل المحتوى ولغة الجسد
                </p>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">تسجيل فيديو</span>
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">تحليل شامل</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {[
              { value: "٣", label: "أنماط مقابلات", icon: BarChart3 },
              { value: "AI", label: "ذكاء اصطناعي", icon: Shield },
              { value: "٢٤/٧", label: "متاح دائماً", icon: GraduationCap },
              { value: "فوري", label: "تقييم مباشر", icon: MessageSquare },
            ].map((stat, i) => (
              <div key={i} className="space-y-2">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">{stat.value}</p>
                <p className="text-muted-foreground font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} معهد الإدارة العامة - جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
