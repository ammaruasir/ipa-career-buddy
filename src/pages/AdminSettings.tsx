import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Palette, BookOpen, SlidersHorizontal, Key, Users, Settings,
  Plus, Pencil, X, Loader2, Shield, Download, Server, Briefcase, Clock,
  MapPin, Building2, ToggleLeft, ToggleRight, Mic
} from "lucide-react";

// Fallback when the live Wakeb voice catalogue can't be fetched (e.g. function
// not deployed yet or upstream 5xx). Mirrors the previously hard-coded list.
const FALLBACK_VOICES: Array<{ voice_id: string; label: string }> = [
  { voice_id: "QsV9PCczMIklRM6xLPAS", label: "هبة منصوري — أنثى سعودية (محادثة/خدمة عملاء) ⭐" },
  { voice_id: "IK7YYZcSpmlkjKrQxbSn", label: "رائد — ذكر سعودي (رسمي/سرد)" },
  { voice_id: "yXEnnEln9armDCyhkXcA", label: "جدّاوي — ذكر سعودي شاب (هادئ/عميق)" },
  { voice_id: "IES4nrmZdUBHByLBde0P", label: "هيثم — عربي (لكنة مصرية)" },
  { voice_id: "mRdG9GYEjJmIzqbYTidv", label: "سناء — عربي أصلي (أنثوي)" },
  { voice_id: "tavIIPLplRB883FzWU0V", label: "منى — لهجة خليجية (أنثوي)" },
  { voice_id: "SAz9YHcvj6GT2YYXdXww", label: "River (أنثوي)" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (أنثوي)" },
  { voice_id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura (أنثوي)" },
  { voice_id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice (أنثوي)" },
  { voice_id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (أنثوي)" },
  { voice_id: "cgSgspJ2msm6clMCkdW9", label: "Jessica (أنثوي)" },
  { voice_id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda (أنثوي)" },
  { voice_id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger (ذكوري)" },
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", label: "George (ذكوري)" },
  { voice_id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (ذكوري)" },
  { voice_id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (ذكوري)" },
  { voice_id: "nPczCjzI2devNBz1zQrb", label: "Brian (ذكوري)" },
  { voice_id: "IKne3meq5aSn9XLyUdCD", label: "Charlie (ذكوري)" },
  { voice_id: "cjVigY5qzO86Huf0OWal", label: "Eric (ذكوري)" },
  { voice_id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum (ذكوري)" },
];

interface QuestionTemplate {
  id: string;
  question_text: string;
  category: string;
  difficulty: string;
  interview_type: "text" | "voice" | "video";
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  role?: string;
}

const AdminSettings = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, loading: settingsLoading, updateSettings } = useSystemSettings();

  // Question bank
  const [questions, setQuestions] = useState<QuestionTemplate[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [qDialog, setQDialog] = useState(false);
  const [editingQ, setEditingQ] = useState<QuestionTemplate | null>(null);
  const [qForm, setQForm] = useState({ question_text: "", category: "general", difficulty: "medium", interview_type: "text" as "text" | "voice" | "video" });

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Job positions (local edit state)
  const [newJobPosition, setNewJobPosition] = useState("");

  // Vacancies
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(true);
  const [vacancyDialog, setVacancyDialog] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<any>(null);
  const [vacancyForm, setVacancyForm] = useState({
    title: "", description: "", department: "", location: "",
    employment_type: "full_time", requirements: ""
  });
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});

  // Voice draft (only saved when admin clicks "Save")
  const [voiceDraft, setVoiceDraft] = useState<{ name: string; gender: string; voice_id: string; avatar_url: string } | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);

  // Wakeb voice catalogue: try to fetch live list; fall back to hard-coded curated set
  const [voiceOptions, setVoiceOptions] = useState<Array<{ voice_id: string; label: string }>>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    (async () => {
      setVoicesLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("wakeb-voices", { body: {} });
        if (cancelled) return;
        if (error || !data?.voices?.length) throw error || new Error("empty");
        const opts = (data.voices as Array<any>)
          .map((v) => ({
            voice_id: v.voice_id,
            label: [
              v.name,
              v.gender ? (v.gender === "female" ? "أنثوي" : "ذكوري") : null,
              v.accent || v.language,
            ].filter(Boolean).join(" — "),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "ar"));
        setVoiceOptions(opts);
      } catch {
        // Fallback to hard-coded list below.
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => {
    if (settings.interviewer_voice && !voiceDraft) {
      setVoiceDraft({
        name: settings.interviewer_voice.name || "نورة",
        gender: settings.interviewer_voice.gender || "female",
        voice_id: settings.interviewer_voice.voice_id || "QsV9PCczMIklRM6xLPAS",
        avatar_url: settings.interviewer_voice.avatar_url || "",
      });
    }
  }, [settings.interviewer_voice]);

  const voiceDirty = voiceDraft && settings.interviewer_voice && (
    voiceDraft.name !== settings.interviewer_voice.name ||
    voiceDraft.gender !== settings.interviewer_voice.gender ||
    voiceDraft.voice_id !== settings.interviewer_voice.voice_id ||
    (voiceDraft.avatar_url || "") !== (settings.interviewer_voice.avatar_url || "")
  );

  const saveVoice = async () => {
    if (!voiceDraft) return;
    setSavingVoice(true);
    const { error } = await updateSettings({ interviewer_voice: voiceDraft as any });
    setSavingVoice(false);
    if (error) {
      toast({ title: "تعذّر الحفظ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حفظ صوت المحاور", description: `تم تفعيل: ${voiceDraft.name}` });
    }
  };

  const previewVoice = async () => {
    if (!voiceDraft) return;
    setPreviewingVoice(true);
    try {
      const sample = `السلام عليكم، أنا ${voiceDraft.name}، المحاور الذكي. هذا اختبار سريع للصوت المختار.`;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token
        ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wakeb-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ text: sample, voiceId: voiceDraft.voice_id }),
        }
      );
      if (!res.ok) throw new Error(`فشل توليد الصوت (${res.status})`);
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      audio.onended = () => setPreviewingVoice(false);
    } catch (e: any) {
      toast({ title: "تعذّر تجربة الصوت", description: e.message, variant: "destructive" });
      setPreviewingVoice(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || role !== "admin")) {
      navigate("/dashboard");
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    if (!user || role !== "admin") return;
    loadQuestions();
    loadUsers();
    loadVacancies();
  }, [user, role]);

  const loadQuestions = async () => {
    setLoadingQ(true);
    const { data } = await supabase.from("question_templates").select("*").order("created_at", { ascending: false });
    setQuestions((data as any) || []);
    setLoadingQ(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
    setUsers((profiles || []).map((p) => ({ ...p, role: roleMap.get(p.user_id) || "candidate" })));
    setLoadingUsers(false);
  };

  const loadVacancies = async () => {
    setLoadingVacancies(true);
    const { data } = await supabase.from("job_vacancies").select("*").order("created_at", { ascending: false });
    setVacancies((data as any) || []);
    // Load applicant counts
    const { data: apps } = await supabase.from("job_applications").select("vacancy_id");
    const counts: Record<string, number> = {};
    (apps || []).forEach((a: any) => { counts[a.vacancy_id] = (counts[a.vacancy_id] || 0) + 1; });
    setApplicantCounts(counts);
    setLoadingVacancies(false);
  };

  const openAddVacancy = () => {
    setEditingVacancy(null);
    setVacancyForm({ title: "", description: "", department: "", location: "", employment_type: "full_time", requirements: "" });
    setVacancyDialog(true);
  };

  const openEditVacancy = (v: any) => {
    setEditingVacancy(v);
    const reqs = Array.isArray(v.requirements) ? v.requirements.join("، ") : "";
    setVacancyForm({ title: v.title, description: v.description || "", department: v.department || "", location: v.location || "", employment_type: v.employment_type || "full_time", requirements: reqs });
    setVacancyDialog(true);
  };

  const saveVacancy = async () => {
    if (!user || !vacancyForm.title.trim()) return;
    const reqs = vacancyForm.requirements.split("،").map((r) => r.trim()).filter(Boolean);
    const payload = { ...vacancyForm, requirements: reqs, created_by: user.id } as any;
    if (editingVacancy) {
      delete payload.created_by;
      await supabase.from("job_vacancies").update(payload).eq("id", editingVacancy.id);
    } else {
      await supabase.from("job_vacancies").insert(payload);
    }
    setVacancyDialog(false);
    loadVacancies();
    toast({ title: editingVacancy ? "تم تحديث الوظيفة" : "تمت إضافة الوظيفة" });
  };

  const toggleVacancyActive = async (v: any) => {
    await supabase.from("job_vacancies").update({ is_active: !v.is_active } as any).eq("id", v.id);
    loadVacancies();
  };

  const deleteVacancy = async (id: string) => {
    await supabase.from("job_vacancies").delete().eq("id", id);
    loadVacancies();
    toast({ title: "تم حذف الوظيفة" });
  };

  const openAddQ = () => {
    setEditingQ(null);
    setQForm({ question_text: "", category: "general", difficulty: "medium", interview_type: "text" });
    setQDialog(true);
  };

  const openEditQ = (q: QuestionTemplate) => {
    setEditingQ(q);
    setQForm({ question_text: q.question_text, category: q.category, difficulty: q.difficulty, interview_type: q.interview_type });
    setQDialog(true);
  };

  const saveQuestion = async () => {
    if (!user) return;
    if (editingQ) {
      await supabase.from("question_templates").update(qForm as any).eq("id", editingQ.id);
    } else {
      await supabase.from("question_templates").insert({ ...qForm, created_by: user.id } as any);
    }
    setQDialog(false);
    loadQuestions();
    toast({ title: editingQ ? "تم تحديث السؤال" : "تمت إضافة السؤال" });
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from("question_templates").delete().eq("id", id);
    loadQuestions();
    toast({ title: "تم حذف السؤال" });
  };

  const handleWeightChange = async (key: string, val: number[]) => {
    const updated = { ...settings.scoring_weights, [key]: val[0] };
    await updateSettings({ scoring_weights: updated });
  };

  const handleQuestionsPerTypeChange = async (type: string, val: number[]) => {
    const updated = { ...settings.questions_per_type, [type]: val[0] };
    await updateSettings({ questions_per_type: updated });
  };

  const handleTimePerQuestionChange = async (type: string, val: number[]) => {
    const updated = { ...settings.time_per_question, [type]: val[0] };
    await updateSettings({ time_per_question: updated });
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").update({ role: newRole } as any).eq("user_id", userId);
    loadUsers();
    toast({ title: "تم تحديث الصلاحية" });
  };

  const handleMaintenance = async (val: boolean) => {
    await updateSettings({ maintenance_mode: val });
    toast({ title: val ? "تم تفعيل وضع الصيانة" : "تم إيقاف وضع الصيانة" });
  };

  const addJobPosition = async () => {
    if (!newJobPosition.trim()) return;
    const updated = [...settings.job_positions, newJobPosition.trim()];
    await updateSettings({ job_positions: updated });
    setNewJobPosition("");
    toast({ title: "تمت إضافة الوظيفة" });
  };

  const removeJobPosition = async (index: number) => {
    const updated = settings.job_positions.filter((_, i) => i !== index);
    await updateSettings({ job_positions: updated });
    toast({ title: "تم حذف الوظيفة" });
  };

  const handleBrandColor = async (color: string) => {
    await updateSettings({ brand_color: color });
  };

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const difficultyMap: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
  const typeMap: Record<string, string> = { text: "كتابي", voice: "صوتي", video: "فيديو" };
  const weightTotal = Object.values(settings.scoring_weights).reduce((a: number, b: any) => a + (b as number), 0);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate(-1)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold font-tajawal">إعدادات النظام</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="questions" dir="rtl">
          <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto p-1 mb-6">
            <TabsTrigger value="questions" className="font-tajawal"><BookOpen className="w-4 h-4 ml-1" /> بنك الأسئلة</TabsTrigger>
            <TabsTrigger value="scoring" className="font-tajawal"><SlidersHorizontal className="w-4 h-4 ml-1" /> معايير التقييم</TabsTrigger>
            <TabsTrigger value="interview" className="font-tajawal"><Clock className="w-4 h-4 ml-1" /> إعدادات المقابلة</TabsTrigger>
            <TabsTrigger value="jobs" className="font-tajawal"><Briefcase className="w-4 h-4 ml-1" /> الوظائف</TabsTrigger>
            <TabsTrigger value="vacancies" className="font-tajawal"><Building2 className="w-4 h-4 ml-1" /> الشواغر</TabsTrigger>
            <TabsTrigger value="users" className="font-tajawal"><Users className="w-4 h-4 ml-1" /> المستخدمون</TabsTrigger>
            <TabsTrigger value="branding" className="font-tajawal"><Palette className="w-4 h-4 ml-1" /> الهوية</TabsTrigger>
            <TabsTrigger value="system" className="font-tajawal"><Server className="w-4 h-4 ml-1" /> النظام</TabsTrigger>
          </TabsList>

          {/* Questions */}
          <TabsContent value="questions" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-tajawal">بنك الأسئلة</h2>
                <p className="text-sm text-muted-foreground font-tajawal">الأسئلة هنا تُستخدم مباشرة في المقابلات بدلاً من التوليد العشوائي</p>
              </div>
              <Button onClick={openAddQ} className="font-tajawal"><Plus className="w-4 h-4 ml-1" /> إضافة سؤال</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {loadingQ ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : questions.length === 0 ? (
                  <p className="p-8 text-center text-muted-foreground font-tajawal">لا توجد أسئلة بعد — سيقوم محرك واكب للذكاء الاصطناعي بتوليد الأسئلة تلقائياً</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-tajawal">السؤال</TableHead>
                        <TableHead className="font-tajawal">النوع</TableHead>
                        <TableHead className="font-tajawal">الصعوبة</TableHead>
                        <TableHead className="font-tajawal">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questions.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="font-tajawal max-w-xs truncate">{q.question_text}</TableCell>
                          <TableCell><Badge variant="secondary" className="font-tajawal">{typeMap[q.interview_type] || q.interview_type}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="font-tajawal">{difficultyMap[q.difficulty] || q.difficulty}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" onClick={() => openEditQ(q)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)}><X className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scoring */}
          <TabsContent value="scoring" className="space-y-4">
            <h2 className="text-xl font-bold font-tajawal">أوزان معايير التقييم</h2>
            <p className="text-sm text-muted-foreground font-tajawal">هذه الأوزان تُستخدم فعلياً في حساب الدرجة النهائية للمرشح</p>
            <Card>
              <CardContent className="space-y-6 pt-6">
                {[
                  { key: "technical", label: "المهارات التقنية" },
                  { key: "communication", label: "مهارات التواصل" },
                  { key: "cultural_fit", label: "التوافق الثقافي" },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-tajawal">{item.label}</Label>
                      <span className="text-sm font-bold">{settings.scoring_weights[item.key] || 0}%</span>
                    </div>
                    <Slider
                      value={[settings.scoring_weights[item.key] || 0]}
                      onValueChange={(v) => handleWeightChange(item.key, v)}
                      min={0} max={100} step={5}
                    />
                  </div>
                ))}
                <p className="text-sm text-muted-foreground font-tajawal">
                  المجموع: {weightTotal}%
                  {weightTotal !== 100 && <span className="text-destructive mr-2">(يجب أن يكون المجموع ١٠٠٪)</span>}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interview Settings */}
          <TabsContent value="interview" className="space-y-4">
            <h2 className="text-xl font-bold font-tajawal">إعدادات المقابلة</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-tajawal">عدد الأسئلة لكل نوع</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(["text", "voice", "video"] as const).map((t) => (
                    <div key={t} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-tajawal">{typeMap[t]}</Label>
                        <span className="text-sm font-bold">{settings.questions_per_type[t]}</span>
                      </div>
                      <Slider
                        value={[settings.questions_per_type[t]]}
                        onValueChange={(v) => handleQuestionsPerTypeChange(t, v)}
                        min={3} max={15} step={1}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-tajawal">المؤقت لكل سؤال (ثانية)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(["text", "voice", "video"] as const).map((t) => (
                    <div key={t} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-tajawal">{typeMap[t]}</Label>
                        <span className="text-sm font-bold">
                          {settings.time_per_question[t] === 0 ? "بدون حد" : `${settings.time_per_question[t]} ثانية`}
                        </span>
                      </div>
                      <Slider
                        value={[settings.time_per_question[t]]}
                        onValueChange={(v) => handleTimePerQuestionChange(t, v)}
                        min={0} max={600} step={30}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Job Positions */}
          <TabsContent value="jobs" className="space-y-4">
            <h2 className="text-xl font-bold font-tajawal">الوظائف المتاحة</h2>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex gap-3">
                  <Input
                    value={newJobPosition}
                    onChange={(e) => setNewJobPosition(e.target.value)}
                    placeholder="أدخل اسم الوظيفة الجديدة..."
                    className="font-tajawal"
                    onKeyDown={(e) => e.key === "Enter" && addJobPosition()}
                  />
                  <Button onClick={addJobPosition} className="font-tajawal"><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.job_positions.map((job, i) => (
                    <Badge key={i} variant="secondary" className="font-tajawal text-sm py-2 px-3 gap-2">
                      {job}
                      <button onClick={() => removeJobPosition(i)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vacancies */}
          <TabsContent value="vacancies" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-tajawal">إدارة الشواغر الوظيفية</h2>
                <p className="text-sm text-muted-foreground font-tajawal">أضف وعدّل الوظائف المتاحة للمرشحين</p>
              </div>
              <Button onClick={openAddVacancy} className="font-tajawal"><Plus className="w-4 h-4 ml-1" /> إضافة شاغر</Button>
            </div>
            {loadingVacancies ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : vacancies.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground font-tajawal">لا توجد شواغر بعد</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {vacancies.map((v) => (
                  <Card key={v.id} className="rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold font-tajawal text-lg">{v.title}</h3>
                            <Badge variant={v.is_active ? "default" : "secondary"} className="font-tajawal">
                              {v.is_active ? "نشط" : "غير نشط"}
                            </Badge>
                            <Badge variant="outline" className="font-tajawal">
                              {applicantCounts[v.id] || 0} متقدم
                            </Badge>
                          </div>
                          {v.description && <p className="text-sm text-muted-foreground font-tajawal">{v.description}</p>}
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                            {v.department && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{v.department}</span>}
                            {v.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.location}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => toggleVacancyActive(v)} title={v.is_active ? "إيقاف" : "تفعيل"}>
                            {v.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEditVacancy(v)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteVacancy(v.id)}><X className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="space-y-4">
            <h2 className="text-xl font-bold font-tajawal">إدارة المستخدمين</h2>
            <Card>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-tajawal">الاسم</TableHead>
                        <TableHead className="font-tajawal">الصلاحية</TableHead>
                        <TableHead className="font-tajawal">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-tajawal">{u.full_name || "بدون اسم"}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="font-tajawal">
                              {u.role === "admin" ? "مدير" : u.role === "hr" ? "موارد بشرية" : "مرشح"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={(val) => updateUserRole(u.user_id, val)}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="candidate">مرشح</SelectItem>
                                <SelectItem value="hr">موارد بشرية</SelectItem>
                                <SelectItem value="admin">مدير</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding */}
          <TabsContent value="branding" className="space-y-4">
            <h2 className="text-xl font-bold font-tajawal">الهوية المؤسسية</h2>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="font-tajawal">اللون الأساسي</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.brand_color} onChange={(e) => handleBrandColor(e.target.value)} className="w-12 h-10 rounded border cursor-pointer" />
                    <span className="text-sm text-muted-foreground">{settings.brand_color}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-tajawal">رفع شعار المؤسسة</Label>
                  <Input type="file" accept="image/*" className="font-tajawal" />
                  <p className="text-xs text-muted-foreground font-tajawal">PNG أو SVG، بحد أقصى 1MB</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System */}
          <TabsContent value="system" className="space-y-4">
            <h2 className="text-xl font-bold font-tajawal">إعدادات النظام</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-tajawal flex items-center gap-2"><Shield className="w-4 h-4" /> وضع الصيانة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-tajawal">تفعيل وضع الصيانة</Label>
                    <Switch checked={settings.maintenance_mode} onCheckedChange={handleMaintenance} />
                  </div>
                  {settings.maintenance_mode && (
                    <p className="text-sm text-destructive font-tajawal bg-destructive/10 p-2 rounded">
                      ⚠️ المنصة في وضع الصيانة حالياً
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-tajawal flex items-center gap-2"><Download className="w-4 h-4" /> النسخ الاحتياطي</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="font-tajawal w-full">تصدير البيانات</Button>
                </CardContent>
              </Card>

              {/* Interviewer Voice Settings */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-tajawal flex items-center gap-2"><Mic className="w-4 h-4" /> صوت وشخصية المحاور</CardTitle>
                  <CardDescription className="font-tajawal">عدّل الاسم والجنس والصوت ثم اضغط "حفظ وتفعيل" — لن تُطبّق التغييرات إلا بعد الحفظ.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="font-tajawal">اسم المحاور/ة</Label>
                      <Input
                        value={voiceDraft?.name ?? ""}
                        onChange={(e) => setVoiceDraft((d) => d ? { ...d, name: e.target.value } : d)}
                        placeholder="مثال: نورة"
                        className="font-tajawal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-tajawal">الجنس</Label>
                      <Select
                        value={voiceDraft?.gender ?? "female"}
                        onValueChange={(v) => setVoiceDraft((d) => d ? { ...d, gender: v } : d)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">أنثى</SelectItem>
                          <SelectItem value="male">ذكر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-tajawal">صوت محرك واكب للذكاء الاصطناعي</Label>
                      <Select
                        value={voiceDraft?.voice_id ?? "QsV9PCczMIklRM6xLPAS"}
                        onValueChange={(v) => setVoiceDraft((d) => d ? { ...d, voice_id: v } : d)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={voicesLoading ? "جارٍ التحميل..." : "اختر صوتاً"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(voiceOptions.length > 0 ? voiceOptions : FALLBACK_VOICES).map((v) => (
                            <SelectItem key={v.voice_id} value={v.voice_id}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-tajawal">رابط الصورة الرمزية (Avatar URL)</Label>
                    <Input
                      type="url"
                      placeholder="https://... (اتركه فارغًا للرسم الافتراضي)"
                      value={voiceDraft?.avatar_url ?? ""}
                      onChange={(e) =>
                        setVoiceDraft((d) => (d ? { ...d, avatar_url: e.target.value } : d))
                      }
                      className="font-tajawal"
                    />
                    {voiceDraft?.avatar_url ? (
                      <div className="flex items-center gap-3 pt-1">
                        <img
                          src={voiceDraft.avatar_url}
                          alt="معاينة"
                          className="w-14 h-14 rounded-xl object-cover border"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <p className="text-xs text-muted-foreground font-tajawal">
                          ستظهر هذه الصورة بدلاً من الرسم الافتراضي للمحاور.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground font-tajawal">
                      {voiceDirty ? "⚠️ لديك تغييرات غير محفوظة" : "✓ الإعدادات الحالية مفعّلة"}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="font-tajawal"
                        onClick={previewVoice}
                        disabled={previewingVoice || !voiceDraft?.voice_id}
                      >
                        {previewingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        تجربة الصوت
                      </Button>
                      <Button
                        type="button"
                        className="font-tajawal"
                        onClick={saveVoice}
                        disabled={savingVoice || !voiceDirty}
                      >
                        {savingVoice ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                        حفظ وتفعيل
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Question Dialog */}
      <Dialog open={qDialog} onOpenChange={setQDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-tajawal">{editingQ ? "تعديل السؤال" : "إضافة سؤال جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-tajawal">نص السؤال</Label>
              <Textarea value={qForm.question_text} onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })} placeholder="اكتب السؤال هنا..." className="font-tajawal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-tajawal">نوع المقابلة</Label>
                <Select value={qForm.interview_type} onValueChange={(v) => setQForm({ ...qForm, interview_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">كتابي</SelectItem>
                    <SelectItem value="voice">صوتي</SelectItem>
                    <SelectItem value="video">فيديو</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">الصعوبة</Label>
                <Select value={qForm.difficulty} onValueChange={(v) => setQForm({ ...qForm, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">سهل</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="hard">صعب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-tajawal">التصنيف</Label>
              <Input value={qForm.category} onChange={(e) => setQForm({ ...qForm, category: e.target.value })} placeholder="مثال: تقني، سلوكي" className="font-tajawal" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveQuestion} className="font-tajawal">{editingQ ? "تحديث" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vacancy Dialog */}
      <Dialog open={vacancyDialog} onOpenChange={setVacancyDialog}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-tajawal">{editingVacancy ? "تعديل الشاغر" : "إضافة شاغر جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-tajawal">عنوان الوظيفة *</Label>
              <Input value={vacancyForm.title} onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })} placeholder="مثال: مطور برمجيات" className="font-tajawal" />
            </div>
            <div className="space-y-2">
              <Label className="font-tajawal">الوصف</Label>
              <Textarea value={vacancyForm.description} onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })} placeholder="وصف مختصر للوظيفة..." className="font-tajawal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-tajawal">القسم</Label>
                <Input value={vacancyForm.department} onChange={(e) => setVacancyForm({ ...vacancyForm, department: e.target.value })} placeholder="مثال: تقنية المعلومات" className="font-tajawal" />
              </div>
              <div className="space-y-2">
                <Label className="font-tajawal">الموقع</Label>
                <Input value={vacancyForm.location} onChange={(e) => setVacancyForm({ ...vacancyForm, location: e.target.value })} placeholder="مثال: الرياض" className="font-tajawal" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-tajawal">نوع التوظيف</Label>
              <Select value={vacancyForm.employment_type} onValueChange={(v) => setVacancyForm({ ...vacancyForm, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">دوام كامل</SelectItem>
                  <SelectItem value="part_time">دوام جزئي</SelectItem>
                  <SelectItem value="contract">عقد مؤقت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-tajawal">المتطلبات (مفصولة بفاصلة ،)</Label>
              <Input value={vacancyForm.requirements} onChange={(e) => setVacancyForm({ ...vacancyForm, requirements: e.target.value })} placeholder="مثال: خبرة 3 سنوات، بكالوريوس حاسب" className="font-tajawal" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveVacancy} className="font-tajawal">{editingVacancy ? "تحديث" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;
