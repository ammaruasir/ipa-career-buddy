import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Camera, Globe, Bell, Lock, User, Loader2 } from "lucide-react";

const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score: 25, label: "ضعيف", color: "bg-destructive" };
  if (score <= 2) return { score: 50, label: "متوسط", color: "bg-warning" };
  if (score <= 3) return { score: 75, label: "جيد", color: "bg-primary" };
  return { score: 100, label: "قوي", color: "bg-success" };
};

const ProfileSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [major, setMajor] = useState("");
  const [gpa, setGpa] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [notifications, setNotifications] = useState(() => {
    const stored = localStorage.getItem("notification_prefs");
    return stored ? JSON.parse(stored) : { email: true, sms: false, inApp: true };
  });

  const [lang, setLang] = useState(() => localStorage.getItem("app_lang") || "ar");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, major, gpa, avatar_url")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone((data as any).phone || "");
        setMajor((data as any).major || "");
        setGpa((data as any).gpa || "");
        setAvatarUrl(data.avatar_url);
      }
    };
    load();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "خطأ في رفع الصورة", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      toast({ title: "تم تحديث الصورة بنجاح" });
    }
    setUploading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, major, gpa } as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حفظ البيانات بنجاح" });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleNotificationChange = (key: string, val: boolean) => {
    const updated = { ...notifications, [key]: val };
    setNotifications(updated);
    localStorage.setItem("notification_prefs", JSON.stringify(updated));
  };

  const handleLangSwitch = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem("app_lang", newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  };

  const strength = getPasswordStrength(newPassword);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate(-1)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold font-tajawal">إعدادات الملف الشخصي</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {/* Avatar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Camera className="w-5 h-5" /> الصورة الشخصية</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-2xl font-tajawal">{fullName?.charAt(0) || "م"}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button variant="outline" asChild disabled={uploading}>
                  <span>{uploading ? "جاري الرفع..." : "تغيير الصورة"}</span>
                </Button>
              </Label>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <p className="text-xs text-muted-foreground">JPG, PNG بحد أقصى 2MB</p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><User className="w-5 h-5" /> البيانات الشخصية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-tajawal">الاسم الكامل</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أدخل اسمك" />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">رقم الهاتف</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5XX XXX XXXX" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">التخصص</Label>
                <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="مثال: إدارة أعمال" />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">المعدل التراكمي</Label>
                <Input value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="مثال: 4.5" dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving} className="font-tajawal">
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ التغييرات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Lock className="w-5 h-5" /> تغيير كلمة المرور</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-tajawal">كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-tajawal text-muted-foreground">قوة كلمة المرور:</span>
                    <span className="font-tajawal font-bold">{strength.label}</span>
                  </div>
                  <Progress value={strength.score} className="h-2" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-tajawal">تأكيد كلمة المرور</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} variant="outline" className="font-tajawal">
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                تغيير كلمة المرور
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Bell className="w-5 h-5" /> إعدادات الإشعارات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "email", label: "إشعارات البريد الإلكتروني" },
              { key: "sms", label: "إشعارات الرسائل النصية" },
              { key: "inApp", label: "إشعارات داخل التطبيق" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label className="font-tajawal">{item.label}</Label>
                <Checkbox
                  checked={notifications[item.key]}
                  onCheckedChange={(checked) => handleNotificationChange(item.key, !!checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Globe className="w-5 h-5" /> اللغة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                variant={lang === "ar" ? "default" : "outline"}
                onClick={() => handleLangSwitch("ar")}
                className="font-tajawal"
              >
                العربية
              </Button>
              <Button
                variant={lang === "en" ? "default" : "outline"}
                onClick={() => handleLangSwitch("en")}
              >
                English
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSettings;
