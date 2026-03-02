import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle2, FileText, User, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { nationalities, citiesByNationality, educationLevels, genderOptions, commonMajors } from "@/lib/location-data";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePickerWithYears } from "@/components/ui/date-picker-with-years";

const CompleteProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeSkills, setResumeSkills] = useState<any>(null);
  const [resumeName, setResumeName] = useState("");

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date>();
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [major, setMajor] = useState("");
  const [gpa, setGpa] = useState("");
  const [experienceYears, setExperienceYears] = useState("");

  // Validation errors
  const [phoneError, setPhoneError] = useState("");
  const [gpaError, setGpaError] = useState("");

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
        setNationality((data as any).nationality || "");
        setCity((data as any).city || "");
        setGender((data as any).gender || "");
        setEducationLevel((data as any).education_level || "");
        setExperienceYears((data as any).experience_years?.toString() || "");
        if ((data as any).date_of_birth) {
          setDateOfBirth(new Date((data as any).date_of_birth));
        }
        if ((data as any).resume_url) {
          setResumeUploaded(true);
          setResumeName("السيرة الذاتية المرفوعة");
        }
        if ((data as any).profile_completed) {
          navigate("/dashboard", { replace: true });
        }
      }
    };
    load();
  }, [user, navigate]);

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

  const isStep1Valid = fullName && dateOfBirth && gender && nationality && city && phone && !phoneError && educationLevel && major && !gpaError;

  const handleSaveStep1 = async () => {
    if (!user || !isStep1Valid) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        major,
        gpa: gpa || null,
        date_of_birth: dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : null,
        gender,
        nationality,
        city,
        education_level: educationLevel,
        experience_years: experienceYears ? parseInt(experienceYears) : 0,
      } as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setStep(2);
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
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "حجم الملف يجب أن لا يتجاوز 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    setResumeSkills(null);
    const path = `${user.id}/resume.pdf`;
    const { error } = await supabase.storage.from("resumes").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "خطأ في رفع الملف", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(path);
      await supabase
        .from("profiles")
        .update({ resume_url: urlData.publicUrl } as any)
        .eq("user_id", user.id);
      setResumeUploaded(true);
      setResumeName(file.name);
      toast({ title: "تم رفع السيرة الذاتية بنجاح، جاري التحليل..." });

      setAnalyzing(true);
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
        toast({ title: "تم رفع الملف لكن تعذر التحليل التلقائي", variant: "destructive" });
      }
      setAnalyzing(false);
    }
    setUploading(false);
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ profile_completed: true } as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم إكمال الملف الشخصي بنجاح! 🎉" });
      navigate("/dashboard", { replace: true });
    }
    setSaving(false);
  };

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
      <div className="bg-primary text-primary-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold font-tajawal">أكمل ملفك الشخصي</h1>
          <p className="mt-2 text-primary-foreground/80 font-tajawal">أكمل بياناتك للبدء في التقديم على الوظائف</p>
        </div>
      </div>

      {/* Progress */}
      <div className="container mx-auto px-4 max-w-2xl mt-6">
        <div className="flex items-center gap-4 mb-2">
          <div className={cn("flex items-center gap-2 text-sm font-tajawal", step >= 1 ? "text-primary font-bold" : "text-muted-foreground")}>
            <User className="w-4 h-4" />
            البيانات الشخصية
          </div>
          <div className="flex-1 h-px bg-border" />
          <div className={cn("flex items-center gap-2 text-sm font-tajawal", step >= 2 ? "text-primary font-bold" : "text-muted-foreground")}>
            <Briefcase className="w-4 h-4" />
            السيرة الذاتية
          </div>
        </div>
        <Progress value={step === 1 ? 50 : 100} className="h-2" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-tajawal flex items-center gap-2">
                <User className="w-5 h-5" />
                البيانات الشخصية
              </CardTitle>
              <CardDescription className="font-tajawal">يرجى إدخال بياناتك الشخصية بدقة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label className="font-tajawal">الاسم الكامل *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أدخل اسمك الكامل" />
                </div>

                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label className="font-tajawal">تاريخ الميلاد *</Label>
                  <DatePickerWithYears
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    minAge={16}
                    maxAge={80}
                    placeholder="اختر تاريخ الميلاد"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <Label className="font-tajawal">الجنس *</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="اختر الجنس" /></SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nationality */}
                <div className="space-y-2">
                  <Label className="font-tajawal">الجنسية *</Label>
                  <SearchableSelect
                    options={nationalities}
                    value={nationality}
                    onValueChange={(v) => { setNationality(v); setCity(""); }}
                    placeholder="اختر الجنسية"
                    searchPlaceholder="ابحث عن الجنسية..."
                    emptyMessage="لا توجد نتائج"
                  />
                </div>

                {/* City */}
                <div className="space-y-2">
                  <Label className="font-tajawal">المدينة *</Label>
                  <SearchableSelect
                    options={cities}
                    value={city}
                    onValueChange={setCity}
                    placeholder={nationality ? "اختر المدينة" : "اختر الجنسية أولاً"}
                    searchPlaceholder="ابحث عن المدينة..."
                    emptyMessage="لا توجد نتائج"
                    disabled={!nationality}
                    allowCustom
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="font-tajawal">رقم الهاتف *</Label>
                  <Input
                    value={phone}
                    onChange={(e) => validatePhone(e.target.value)}
                    placeholder="+966 5XX XXX XXXX"
                    dir="ltr"
                    className={phoneError ? "border-destructive" : ""}
                  />
                  {phoneError && <p className="text-xs text-destructive font-tajawal">{phoneError}</p>}
                </div>

                {/* Education Level */}
                <div className="space-y-2">
                  <Label className="font-tajawal">المستوى التعليمي *</Label>
                  <Select value={educationLevel} onValueChange={setEducationLevel}>
                    <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                    <SelectContent>
                      {educationLevels.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Major */}
                <div className="space-y-2">
                  <Label className="font-tajawal">التخصص *</Label>
                  <SearchableSelect
                    options={commonMajors}
                    value={major}
                    onValueChange={setMajor}
                    placeholder="اختر التخصص"
                    searchPlaceholder="ابحث عن التخصص..."
                    emptyMessage="لا توجد نتائج"
                    allowCustom
                  />
                </div>

                {/* GPA */}
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

                {/* Experience Years */}
                <div className="space-y-2">
                  <Label className="font-tajawal">سنوات الخبرة</Label>
                  <Input type="number" min="0" max="50" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="0" dir="ltr" />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveStep1} disabled={saving || !isStep1Valid} className="font-tajawal min-w-[140px]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  التالي
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-tajawal flex items-center gap-2">
                <FileText className="w-5 h-5" />
                السيرة الذاتية
              </CardTitle>
              <CardDescription className="font-tajawal">ارفع سيرتك الذاتية بصيغة PDF (اختياري - يمكنك إضافتها لاحقاً)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                resumeUploaded ? "border-success bg-success/5" : "border-border hover:border-primary/50"
              )}>
                {resumeUploaded ? (
                  <div className="space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                    <p className="font-tajawal font-bold text-success">تم رفع السيرة الذاتية</p>
                    <p className="text-sm text-muted-foreground font-tajawal">{resumeName}</p>
                    <Label htmlFor="resume-reupload" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span className="font-tajawal">تغيير الملف</span>
                      </Button>
                    </Label>
                    <input id="resume-reupload" type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="font-tajawal font-medium">اسحب الملف هنا أو اضغط للرفع</p>
                    <p className="text-sm text-muted-foreground font-tajawal">PDF فقط، بحد أقصى 5MB</p>
                    <Label htmlFor="resume-upload" className="cursor-pointer">
                      <Button variant="outline" asChild disabled={uploading}>
                        <span className="font-tajawal">{uploading ? "جاري الرفع..." : "اختر ملف"}</span>
                      </Button>
                    </Label>
                    <input id="resume-upload" type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                  </div>
                )}
              </div>

              {uploading && <Progress value={60} className="h-2" />}

              {analyzing && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="font-tajawal text-sm text-primary">جاري تحليل السيرة الذاتية بالذكاء الاصطناعي...</p>
                </div>
              )}

              {resumeSkills && !analyzing && (
                <div className="space-y-3 p-4 rounded-xl bg-success/5 border border-success/20">
                  <p className="font-tajawal font-bold text-success flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> تم تحليل السيرة بنجاح</p>
                  {resumeSkills.summary && <p className="font-tajawal text-sm text-muted-foreground">{resumeSkills.summary}</p>}
                  {resumeSkills.technical_skills?.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-tajawal text-xs font-bold">المهارات التقنية:</p>
                      <div className="flex flex-wrap gap-1">{resumeSkills.technical_skills.map((s: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>)}</div>
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

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="font-tajawal">
                  رجوع
                </Button>
                <Button onClick={handleComplete} disabled={saving} className="font-tajawal min-w-[140px]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  {resumeUploaded ? "إكمال التسجيل" : "تخطي وإكمال"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CompleteProfile;
