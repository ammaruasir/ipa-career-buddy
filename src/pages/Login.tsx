import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Briefcase, Loader2, Shield, GraduationCap, ArrowRight, Users } from "lucide-react";

const QUICK_ACCOUNTS = [
  { label: "مسؤول", email: "admin@test.com", password: "00000000", role: "admin" as const },
  { label: "موارد بشرية", email: "hr@test.com", password: "00000000", role: "hr" as const },
  { label: "مرشح", email: "student1@test.com", password: "00000000", role: "candidate" as const },
  { label: "مرشح", email: "ammar@admin.com", password: "00000000", role: "candidate" as const },
];
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("tab") === "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(!!searchParams.get("forgot"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignup) {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("تم إنشاء الحساب بنجاح! يرجى تأكيد بريدك الإلكتروني");
        setEmail("");
        setPassword("");
        setFullName("");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("خطأ في البريد الإلكتروني أو كلمة المرور");
      } else {
        const redirect = searchParams.get("redirect");
        navigate(redirect || "/dashboard");
      }
    }
    setLoading(false);
  };

  const handleQuickLogin = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("فشل تسجيل الدخول السريع");
      setLoading(false);
    } else {
      const redirect = searchParams.get("redirect");
      navigate(redirect || "/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("يرجى إدخال البريد الإلكتروني");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("حدث خطأ في إرسال رابط إعادة التعيين");
    } else {
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني");
    }
    setLoading(false);
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-secondary/5" />
        <Link to="/" className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-2 hover:bg-muted/60">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>
        <Card className="w-full max-w-md rounded-2xl shadow-xl relative z-10">
          <CardHeader className="text-center space-y-4 pb-2">
            <img src="/ipa-logo.png" alt="معهد الإدارة العامة" className="mx-auto w-16 h-16 rounded-2xl object-contain" />
            <CardTitle className="text-2xl font-bold">نسيت كلمة المرور؟</CardTitle>
            <CardDescription>أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="rounded-xl"
                  dir="ltr"
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-xl py-6 text-lg" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "إرسال رابط إعادة التعيين"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-primary hover:underline">
                العودة لتسجيل الدخول
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-secondary/5" />
      <Link to="/" className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-2 hover:bg-muted/60">
        <ArrowRight className="w-4 h-4" />
        العودة للرئيسية
      </Link>
      <Card className="w-full max-w-md rounded-2xl shadow-xl relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <img src="/ipa-logo.png" alt="معهد الإدارة العامة" className="mx-auto w-16 h-16 rounded-2xl object-contain" />
          <CardTitle className="text-2xl font-bold">
            {isSignup ? "إنشاء حساب جديد" : "تسجيل الدخول"}
          </CardTitle>
          <CardDescription>
            {isSignup
              ? "انضم لمنصة المقابلات الذكية - معهد الإدارة العامة وابدأ التدريب"
              : "ادخل إلى حسابك في منصة المقابلات الذكية - معهد الإدارة العامة"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="rounded-xl text-right"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="rounded-xl"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl"
                dir="ltr"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full rounded-xl py-6 text-lg" disabled={loading}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignup ? (
                "إنشاء الحساب"
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {!isSignup && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-sm text-muted-foreground hover:text-primary hover:underline block w-full"
              >
                نسيت كلمة المرور؟
              </button>
            )}
            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setEmail(""); setPassword(""); setFullName(""); }}
              className="text-sm text-primary hover:underline"
            >
              {isSignup ? "لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب جديد"}
            </button>
          </div>

          {!isSignup && (
            <div className="mt-6">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">دخول سريع للتجربة</span>
                </div>
              </div>
              <div className="space-y-2">
                {QUICK_ACCOUNTS.map((acc) => {
                  const Icon = acc.role === "admin" ? Shield : acc.role === "hr" ? Users : GraduationCap;
                  return (
                    <Button
                      key={acc.email}
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl justify-between py-5"
                      disabled={loading}
                      onClick={() => handleQuickLogin(acc.email, acc.password)}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{acc.label}</span>
                      </span>
                      <span className="text-xs text-muted-foreground" dir="ltr">{acc.email}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
