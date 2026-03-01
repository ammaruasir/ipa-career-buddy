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
  Plus, Pencil, Trash2, Loader2, Shield, Download, Server, Briefcase, Clock
} from "lucide-react";

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

  useEffect(() => {
    if (!authLoading && (!user || role !== "admin")) {
      navigate("/dashboard");
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    if (!user || role !== "admin") return;
    loadQuestions();
    loadUsers();
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
                  <p className="p-8 text-center text-muted-foreground font-tajawal">لا توجد أسئلة بعد — سيقوم الذكاء الاصطناعي بتوليد الأسئلة تلقائياً</p>
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
                              <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
};

export default AdminSettings;
