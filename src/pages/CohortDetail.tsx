import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Users, Plus, Loader2, BookOpen, FileText, UserPlus,
} from "lucide-react";

const CohortDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [cohort, setCohort] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const [newAssign, setNewAssign] = useState({
    title: "", description: "", type: "interview", interview_type: "text",
    target_track: "", required_questions: 8, due_at: "",
  });
  const [creatingAssign, setCreatingAssign] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user || !id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, authLoading]);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: cohortData }, { data: enrollRows }, { data: assignRows }] = await Promise.all([
      supabase.from("cohorts").select("*").eq("id", id).maybeSingle(),
      supabase.from("enrollments").select("*").eq("cohort_id", id),
      supabase.from("assignments").select("*").eq("cohort_id", id).order("created_at", { ascending: false }),
    ]);

    setCohort(cohortData);
    setAssignments(assignRows || []);

    // Fetch student profiles + recent eval scores
    const studentIds = (enrollRows || []).map((e: any) => e.student_id);
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, major")
        .in("user_id", studentIds);

      // Latest evaluations per student — fetch interviews for these students
      // then their evaluations separately (simpler than a deep nested join).
      const { data: studentInterviews } = await supabase
        .from("interviews")
        .select("id, user_id")
        .in("user_id", studentIds);
      const interviewIds = (studentInterviews || []).map((i: any) => i.id);
      const interviewToUser: Record<string, string> = {};
      (studentInterviews || []).forEach((i: any) => { interviewToUser[i.id] = i.user_id; });

      const { data: evals } = interviewIds.length > 0
        ? await supabase
            .from("evaluations")
            .select("overall_score, interview_id")
            .in("interview_id", interviewIds)
        : { data: [] as any[] };

      const evalByUser: Record<string, number[]> = {};
      (evals || []).forEach((e: any) => {
        const uid = interviewToUser[e.interview_id];
        if (!uid) return;
        evalByUser[uid] = evalByUser[uid] || [];
        if (e.overall_score != null) evalByUser[uid].push(e.overall_score);
      });

      setStudents((enrollRows || []).map((e: any) => {
        const profile = (profiles || []).find((p: any) => p.user_id === e.student_id) || {};
        const scores = evalByUser[e.student_id] || [];
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return { ...e, ...profile, sessions: scores.length, avg_score: avg };
      }));
    } else {
      setStudents([]);
    }
    setLoading(false);
  };

  const enrollByEmail = async () => {
    if (!enrollEmail.trim() || !id) return;
    setEnrolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-cohort", {
        body: { action: "enroll_student_by_email", cohort_id: id, email: enrollEmail.trim() },
      });
      if (error) {
        const msg = (error as any).context?.error || error.message || "تعذّر التسجيل";
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("تم تسجيل الطالب في الدفعة");
      setEnrollEmail("");
      await loadAll();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "تعذّر التسجيل");
    } finally {
      setEnrolling(false);
    }
  };

  const createAssignment = async () => {
    if (!newAssign.title.trim() || !id) return;
    setCreatingAssign(true);
    try {
      const { error } = await supabase.from("assignments").insert({
        cohort_id: id,
        title: newAssign.title,
        description: newAssign.description || null,
        type: newAssign.type,
        interview_type: newAssign.type === "interview" ? newAssign.interview_type : null,
        target_track: newAssign.target_track || null,
        required_questions: newAssign.required_questions || null,
        due_at: newAssign.due_at || null,
      });
      if (error) throw error;
      toast.success("تم إنشاء المهمة");
      setAssignDialogOpen(false);
      setNewAssign({ title: "", description: "", type: "interview", interview_type: "text", target_track: "", required_questions: 8, due_at: "" });
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error("تعذّر إنشاء المهمة");
    } finally {
      setCreatingAssign(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!cohort) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <Card><CardContent className="p-8 space-y-3 text-center">
        <p>الدفعة غير موجودة أو ليس لك صلاحية عرضها.</p>
        <Button onClick={() => navigate("/dashboard/instructor")}>عودة</Button>
      </CardContent></Card>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold">{cohort.name}</h1>
            {cohort.track && <Badge variant="outline">{cohort.track}</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/instructor")}>
            عودة <ArrowRight className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students"><Users className="w-4 h-4 ml-1.5" /> الطلاب ({students.length})</TabsTrigger>
            <TabsTrigger value="assignments"><BookOpen className="w-4 h-4 ml-1.5" /> المهام ({assignments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-5 h-5" /> تسجيل طالب</CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="البريد الإلكتروني للطالب"
                  type="email"
                  value={enrollEmail}
                  onChange={(e) => setEnrollEmail(e.target.value)}
                />
                <Button disabled={enrolling} onClick={enrollByEmail}>
                  {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : "تسجيل"}
                </Button>
              </CardContent>
            </Card>

            {students.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">لا يوجد طلاب مسجّلون بعد.</CardContent></Card>
            ) : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-right">التخصص</TableHead>
                      <TableHead className="text-right">الجلسات</TableHead>
                      <TableHead className="text-right">متوسط الدرجة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.full_name || "—"}</TableCell>
                        <TableCell>{s.major || "—"}</TableCell>
                        <TableCell>{s.sessions}</TableCell>
                        <TableCell>{s.avg_score != null ? `${s.avg_score}/100` : "—"}</TableCell>
                        <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 ml-2" /> مهمة جديدة</Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader><DialogTitle>إنشاء مهمة تدريبية</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>العنوان</Label><Input value={newAssign.title} onChange={(e) => setNewAssign({ ...newAssign, title: e.target.value })} /></div>
                    <div><Label>الوصف</Label><Textarea rows={2} value={newAssign.description} onChange={(e) => setNewAssign({ ...newAssign, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>نوع المهمة</Label>
                        <Select value={newAssign.type} onValueChange={(v) => setNewAssign({ ...newAssign, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="interview">مقابلة تدريبية</SelectItem>
                            <SelectItem value="cv">إعداد سيرة ذاتية</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newAssign.type === "interview" && (
                        <div><Label>نوع المقابلة</Label>
                          <Select value={newAssign.interview_type} onValueChange={(v) => setNewAssign({ ...newAssign, interview_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">نصية</SelectItem>
                              <SelectItem value="voice">صوتية</SelectItem>
                              <SelectItem value="video">فيديو</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>المسار المستهدف</Label><Input value={newAssign.target_track} onChange={(e) => setNewAssign({ ...newAssign, target_track: e.target.value })} /></div>
                      <div><Label>عدد الأسئلة</Label><Input type="number" value={newAssign.required_questions} onChange={(e) => setNewAssign({ ...newAssign, required_questions: parseInt(e.target.value) || 0 })} /></div>
                    </div>
                    <div><Label>تاريخ الاستحقاق</Label><Input type="datetime-local" value={newAssign.due_at} onChange={(e) => setNewAssign({ ...newAssign, due_at: e.target.value })} /></div>
                  </div>
                  <DialogFooter>
                    <Button disabled={creatingAssign || !newAssign.title.trim()} onClick={createAssignment}>
                      {creatingAssign ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ الإنشاء...</> : "إنشاء"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {assignments.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد مهام بعد.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments.map((a) => (
                  <Card key={a.id} className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate(`/dashboard/instructor/assignment/${a.id}`)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        {a.type === "cv" ? <FileText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                        <span className="font-semibold">{a.title}</span>
                      </div>
                      {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{a.type === "interview" ? "مقابلة" : "سيرة ذاتية"}</Badge>
                        {a.interview_type && <Badge variant="outline">{a.interview_type}</Badge>}
                        {a.target_track && <Badge variant="outline">{a.target_track}</Badge>}
                      </div>
                      {a.due_at && <p className="text-xs text-muted-foreground">الاستحقاق: {new Date(a.due_at).toLocaleString("ar-SA")}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CohortDetail;
