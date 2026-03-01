import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Palette, BookOpen, SlidersHorizontal, Key, Users, Settings,
  Plus, Pencil, Trash2, Loader2, Shield, Download, Server
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

  // Question bank
  const [questions, setQuestions] = useState<QuestionTemplate[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [qDialog, setQDialog] = useState(false);
  const [editingQ, setEditingQ] = useState<QuestionTemplate | null>(null);
  const [qForm, setQForm] = useState({ question_text: "", category: "general", difficulty: "medium", interview_type: "text" as "text" | "voice" | "video" });

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Scoring weights
  const [weights, setWeights] = useState(() => {
    const stored = localStorage.getItem("scoring_weights");
    return stored ? JSON.parse(stored) : { technical: 30, communication: 25, confidence: 25, personality: 20 };
  });

  // Branding
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem("brand_color") || "#006C35");

  // System
  const [maintenance, setMaintenance] = useState(() => localStorage.getItem("maintenance_mode") === "true");

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
    setUsers((profiles || []).map((p) => ({ ...p, role: roleMap.get(p.user_id) || "student" })));
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

  const updateWeight = (key: string, val: number[]) => {
    const updated = { ...weights, [key]: val[0] };
    setWeights(updated);
    localStorage.setItem("scoring_weights", JSON.stringify(updated));
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").update({ role: newRole } as any).eq("user_id", userId);
    loadUsers();
    toast({ title: "تم تحديث الصلاحية" });
  };

  const handleMaintenance = (val: boolean) => {
    setMaintenance(val);
    localStorage.setItem("maintenance_mode", String(val));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const difficultyMap: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
  const typeMap: Record<string, string> = { text: "كتابي", voice: "صوتي", video: "فيديو" };

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
            <TabsTrigger value="users" className="font-tajawal"><Users className="w-4 h-4 ml-1" /> المستخدمون</TabsTrigger>
            <TabsTrigger value="branding" className="font-tajawal"><Palette className="w-4 h-4 ml-1" /> الهوية</TabsTrigger>
            <TabsTrigger value="system" className="font-tajawal"><Server className="w-4 h-4 ml-1" /> النظام</TabsTrigger>
          </TabsList>

          {/* Questions */}
          <TabsContent value="questions" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-tajawal">بنك الأسئلة</h2>
              <Button onClick={openAddQ} className="font-tajawal"><Plus className="w-4 h-4 ml-1" /> إضافة سؤال</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {loadingQ ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : questions.length === 0 ? (
                  <p className="p-8 text-center text-muted-foreground font-tajawal">لا توجد أسئلة بعد</p>
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
            <Card>
              <CardContent className="space-y-6 pt-6">
                {[
                  { key: "technical", label: "المهارات التقنية" },
                  { key: "communication", label: "مهارات التواصل" },
                  { key: "confidence", label: "الثقة بالنفس" },
                  { key: "personality", label: "الشخصية" },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-tajawal">{item.label}</Label>
                      <span className="text-sm font-bold">{weights[item.key]}%</span>
                    </div>
                    <Slider value={[weights[item.key]]} onValueChange={(v) => updateWeight(item.key, v)} min={0} max={100} step={5} />
                  </div>
                ))}
                {(() => {
                  const total: number = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);
                  return (
                    <p className="text-sm text-muted-foreground font-tajawal">
                      المجموع: {total}%
                      {total !== 100 && <span className="text-destructive mr-2">(يجب أن يكون المجموع ١٠٠٪)</span>}
                    </p>
                  );
                })()}
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
                              {u.role === "admin" ? "مدير" : u.role === "hr" ? "موارد بشرية" : "طالب"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={(val) => updateUserRole(u.user_id, val)}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">طالب</SelectItem>
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
                    <input type="color" value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); localStorage.setItem("brand_color", e.target.value); }} className="w-12 h-10 rounded border cursor-pointer" />
                    <span className="text-sm text-muted-foreground">{primaryColor}</span>
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
                    <Switch checked={maintenance} onCheckedChange={handleMaintenance} />
                  </div>
                  {maintenance && (
                    <p className="text-sm text-warning font-tajawal bg-warning/10 p-2 rounded">
                      ⚠️ المنصة في وضع الصيانة حالياً
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-tajawal flex items-center gap-2"><Key className="w-4 h-4" /> مفاتيح API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {["OpenAI", "Twilio"].map((name) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="font-tajawal">{name}</span>
                      <span className="text-muted-foreground font-mono">••••••••</span>
                    </div>
                  ))}
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-tajawal flex items-center gap-2"><Server className="w-4 h-4" /> التخزين</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-tajawal">المستخدم</span>
                      <span className="text-muted-foreground">٢.٥ GB / ١٠ GB</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "25%" }} />
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
    </div>
  );
};

export default AdminSettings;
