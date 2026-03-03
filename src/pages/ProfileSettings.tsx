import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Camera, Globe, Bell, Lock, User, Loader2, FileText, Upload, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { nationalities, citiesByNationality, educationLevels, genderOptions, commonMajors } from "@/lib/location-data";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePickerWithYears } from "@/components/ui/date-picker-with-years";

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

  const [dateOfBirth, setDateOfBirth] = useState<Date>();
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [city, setCity] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [analyzingResume, setAnalyzingResume] = useState(false);
  const [resumeSkills, setResumeSkills] = useState<any>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [phoneError, setPhoneError] = useState("");
  const [gpaError, setGpaError] = useState("");

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
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone((data as any).phone || "");
        setMajor((data as any).major || "");
        setGpa((data as any).gpa || "");
        setAvatarUrl(data.avatar_url);
        setNationality((data as any).nationality || "");
        setCity((data as any).city || "");
        setGender((data as any).gender || "");
        setEducationLevel((data as any).education_level || "");
        setExperienceYears((data as any).experience_years?.toString() || "");
        setResumeUrl((data as any).resume_url || null);
        if ((data as any).resume_skills && Object.keys((data as any).resume_skills).length > 0) {
          setResumeSkills((data as any).resume_skills);
        }
        if ((data as any).date_of_birth) {
          setDateOfBirth(new Date((data as any).date_of_birth));
        }
      }
    };
    load();
  }, [user]);

  const cities = nationality ? citiesByNationality[nationality] || [] : [];

  const validatePhone = (val: string) => {
    setPhone(val);
    if (val && !/^\+?[\d\s-]{7,15}$/.test(val.replace(/\s/g, ""))) {
      setPhoneError("رقم الهاتف غير صحيح");
    } else {
      setPhoneError("");
    }
  };

  const validateGpa = (val: string) => {
    setGpa(val);
    if (val) {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 100) {
        setGpaError("المعدل يجب أن يكون بين 0 و 100");
      } else {
        setGpaError("");
      }
    } else {
      setGpaError("");
    }
  };

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
    if (phoneError || gpaError) {
      toast({ title: "يرجى تصحيح الأخطاء أولاً", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        major,
        gpa: gpa || null,
        date_of_birth: dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : null,
        gender: gender || null,
        nationality: nationality || null,
        city: city || null,
        education_level: educationLevel || null,
        experience_years: experienceYears ? parseInt(experienceYears) : 0,
      } as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حفظ البيانات بنجاح" });
    }
    setSaving(false);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast({ title: "يرجى رفع ملف PDF فقط", variant: "destructive" });
      return;
    }
    setUploadingResume(true);
    setResumeSkills(null);
    const path = `${user.id}/resume.pdf`;
    const { error } = await supabase.storage.from("resumes").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "خطأ في رفع الملف", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(path);
      const url = urlData.publicUrl;
      setResumeUrl(url);
      await supabase.from("profiles").update({ resume_url: url } as any).eq("user_id", user.id);
      toast({ title: "تم رفع السيرة الذاتية، جاري التحليل..." });

      setAnalyzingResume(true);
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("analyze-resume", {
          body: { resume_path: path },
        });
        if (fnError) throw fnError;
        if (fnData?.skills) {
          setResumeSkills(fnData.skills);
          toast({ title: "تم تحليل السيرة الذاتية بنجاح! ✨" });
        } else if (fnData?.error) {
          toast({ title: "تنبيه", description: fnData.error, variant: "destructive" });
        }
      } catch (err) {
        console.error("Resume analysis error:", err);
        toast({ title: "تم رفع الملف لكن تعذر التحليل", variant: "destructive" });
      }
      setAnalyzingResume(false);
    }
    setUploadingResume(false);
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
                <Label className="font-tajawal">تاريخ الميلاد</Label>
                <DatePickerWithYears
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  minAge={16}
                  maxAge={80}
                  placeholder="اختر تاريخ الميلاد"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">الجنس</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="اختر الجنس" /></SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">الجنسية</Label>
                <SearchableSelect
                  options={nationalities}
                  value={nationality}
                  onValueChange={(v) => { setNationality(v); setCity(""); }}
                  placeholder="اختر الجنسية"
                  searchPlaceholder="ابحث عن الجنسية..."
                />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">المدينة</Label>
                <SearchableSelect
                  options={cities}
                  value={city}
                  onValueChange={setCity}
                  placeholder={nationality ? "اختر المدينة" : "اختر الجنسية أولاً"}
                  searchPlaceholder="ابحث عن المدينة..."
                  disabled={!nationality}
                  allowCustom
                />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={(e) => validatePhone(e.target.value)}
                  placeholder="+966 5XX XXX XXXX"
                  dir="ltr"
                  className={phoneError ? "border-destructive" : ""}
                />
                {phoneError && <p className="text-xs text-destructive font-tajawal">{phoneError}</p>}
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">المستوى التعليمي</Label>
                <Select value={educationLevel} onValueChange={setEducationLevel}>
                  <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                  <SelectContent>
                    {educationLevels.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">التخصص</Label>
                <SearchableSelect
                  options={commonMajors}
                  value={major}
                  onValueChange={setMajor}
                  placeholder="اختر التخصص"
                  searchPlaceholder="ابحث عن التخصص..."
                  allowCustom
                />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">المعدل التراكمي</Label>
                <Input
                  value={gpa}
                  onChange={(e) => validateGpa(e.target.value)}
                  placeholder="مثال: 4.5"
                  dir="ltr"
                  className={gpaError ? "border-destructive" : ""}
                />
                {gpaError && <p className="text-xs text-destructive font-tajawal">{gpaError}</p>}
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">سنوات الخبرة</Label>
                <Input type="number" min="0" max="50" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="0" dir="ltr" />
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

        {/* Resume */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><FileText className="w-5 h-5" /> السيرة الذاتية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
              resumeUrl ? "border-success bg-success/5" : "border-border hover:border-primary/50"
            )}>
              {resumeUrl ? (
                <div className="space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
                  <p className="font-tajawal font-bold text-success">السيرة الذاتية مرفوعة</p>
                  <div className="flex items-center justify-center gap-2">
                    <Label htmlFor="resume-settings-upload" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span className="font-tajawal">تغيير الملف</span>
                      </Button>
                    </Label>
                  </div>
                  <input id="resume-settings-upload" type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="font-tajawal">ارفع سيرتك الذاتية (PDF)</p>
                  <Label htmlFor="resume-settings-upload2" className="cursor-pointer">
                    <Button variant="outline" asChild disabled={uploadingResume}>
                      <span className="font-tajawal">{uploadingResume ? "جاري الرفع..." : "اختر ملف"}</span>
                    </Button>
                  </Label>
                  <input id="resume-settings-upload2" type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                </div>
              )}
            </div>

            {analyzingResume && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 mt-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="font-tajawal text-sm text-primary">جاري تحليل السيرة الذاتية بمحرك واكب للذكاء الاصطناعي...</p>
              </div>
            )}

            {resumeSkills && !analyzingResume && (
              <div className="space-y-3 p-4 rounded-xl bg-success/5 border border-success/20 mt-4">
                <p className="font-tajawal font-bold text-success flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> المهارات المستخرجة من السيرة</p>
                {resumeSkills.summary && <p className="font-tajawal text-sm text-muted-foreground">{resumeSkills.summary}</p>}
                {resumeSkills.technical_skills?.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-tajawal text-xs font-bold">المهارات التقنية:</p>
                    <div className="flex flex-wrap gap-1">{resumeSkills.technical_skills.map((s: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>)}</div>
                  </div>
                )}
                {resumeSkills.soft_skills?.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-tajawal text-xs font-bold">المهارات الشخصية:</p>
                    <div className="flex flex-wrap gap-1">{resumeSkills.soft_skills.map((s: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground">{s}</span>)}</div>
                  </div>
                )}
                {resumeSkills.certifications?.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-tajawal text-xs font-bold">الشهادات:</p>
                    <div className="flex flex-wrap gap-1">{resumeSkills.certifications.map((s: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">{s}</span>)}</div>
                  </div>
                )}
              </div>
            )}
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
              <Button variant={lang === "ar" ? "default" : "outline"} onClick={() => handleLangSwitch("ar")} className="font-tajawal">العربية</Button>
              <Button variant={lang === "en" ? "default" : "outline"} onClick={() => handleLangSwitch("en")}>English</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSettings;
