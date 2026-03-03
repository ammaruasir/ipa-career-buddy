import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Briefcase, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("tab") === "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
      <Card className="w-full max-w-md rounded-2xl shadow-xl relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <img src="/ipa-logo.png" alt="معهد الإدارة العامة" className="mx-auto w-16 h-16 rounded-2xl object-contain" />
          <CardTitle className="text-2xl font-bold">
            {isSignup ? "إنشاء حساب جديد" : "تسجيل الدخول"}
          </CardTitle>
          <CardDescription>
            {isSignup
              ? "انضم لمنصة المقابلات الذكية وابدأ التدريب"
              : "ادخل إلى حسابك في منصة المقابلات الذكية"}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
