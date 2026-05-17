import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Loader2, MessageSquare, Send } from "lucide-react";

const AssignmentView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [annotation, setAnnotation] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user || !id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, authLoading]);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: aData }, { data: subs }] = await Promise.all([
      supabase.from("assignments").select("*").eq("id", id).maybeSingle(),
      supabase.from("assignment_submissions").select("*").eq("assignment_id", id),
    ]);
    setAssignment(aData);

    // Enrich submissions with student name + linked interview score
    const studentIds = (subs || []).map((s) => s.student_id);
    const interviewIds = (subs || []).map((s) => s.interview_id).filter(Boolean) as string[];

    const [{ data: profiles }, { data: evals }] = await Promise.all([
      studentIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds)
        : Promise.resolve({ data: [] as any[] }),
      interviewIds.length > 0
        ? supabase.from("evaluations").select("interview_id, overall_score").in("interview_id", interviewIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    setSubmissions((subs || []).map((s: any) => {
      const profile = (profiles || []).find((p: any) => p.user_id === s.student_id);
      const ev = (evals || []).find((e: any) => e.interview_id === s.interview_id);
      return { ...s, full_name: profile?.full_name, score: ev?.overall_score };
    }));
    setLoading(false);
  };

  const sendFeedback = async (submissionId: string, targetType: "submission" | "interview", targetId: string) => {
    const text = (annotation[submissionId] || "").trim();
    if (!text || !user) return;
    setPosting(submissionId);
    try {
      const { error } = await supabase.from("instructor_feedback").insert({
        instructor_id: user.id,
        target_type: targetType,
        target_id: targetId,
        annotation_text: text,
      });
      if (error) throw error;
      // Mark submission reviewed
      await supabase
        .from("assignment_submissions")
        .update({ status: "reviewed" })
        .eq("id", submissionId);
      toast.success("تم إرسال التعليق");
      setAnnotation((prev) => ({ ...prev, [submissionId]: "" }));
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error("تعذّر الإرسال");
    } finally {
      setPosting(null);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!assignment) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <Card><CardContent className="p-8 text-center space-y-3">
        <p>المهمة غير موجودة.</p>
        <Button onClick={() => navigate("/dashboard/instructor")}>عودة</Button>
      </CardContent></Card>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold">{assignment.title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>عودة <ArrowRight className="w-4 h-4 mr-2" /></Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">تفاصيل المهمة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{assignment.description || "لا يوجد وصف"}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{assignment.type === "interview" ? "مقابلة" : "سيرة ذاتية"}</Badge>
              {assignment.interview_type && <Badge variant="outline">{assignment.interview_type}</Badge>}
              {assignment.target_track && <Badge variant="outline">{assignment.target_track}</Badge>}
              {assignment.required_questions && <Badge variant="outline">{assignment.required_questions} أسئلة</Badge>}
              {assignment.due_at && <Badge variant="outline">حتى: {new Date(assignment.due_at).toLocaleDateString("ar-SA")}</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-5 h-5" /> التسليمات</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {submissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد تسليمات بعد.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الدرجة</TableHead>
                    <TableHead className="text-right">تاريخ التسليم</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => (
                    <>
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.full_name || "—"}</TableCell>
                        <TableCell><Badge variant={s.status === "reviewed" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                        <TableCell>{s.score != null ? `${s.score}/100` : "—"}</TableCell>
                        <TableCell className="text-xs">{s.submitted_at ? new Date(s.submitted_at).toLocaleString("ar-SA") : "—"}</TableCell>
                        <TableCell>
                          {s.interview_id && (
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/interview/${s.interview_id}/results`)}>
                              فتح النتائج
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${s.id}-fb`}>
                        <TableCell colSpan={5}>
                          <div className="flex gap-2 items-end pt-1">
                            <Textarea
                              rows={2}
                              placeholder="أضف تعليقاً تعليمياً للطالب (يظهر له في نتائجه)..."
                              value={annotation[s.id] || ""}
                              onChange={(e) => setAnnotation((p) => ({ ...p, [s.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              disabled={posting === s.id || !(annotation[s.id] || "").trim() || !s.interview_id}
                              onClick={() => s.interview_id && sendFeedback(s.id, "interview", s.interview_id)}
                            >
                              {posting === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 ml-1.5" /> إرسال</>}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssignmentView;
