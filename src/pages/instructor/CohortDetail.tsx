import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Users,
  Calendar,
  ClipboardList,
  Plus,
  GraduationCap,
  ChevronLeft,
} from "lucide-react";

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  track: string | null;
  status: string;
  start_date: string;
  end_date: string;
  capacity: number;
}

interface Enrollment {
  id: string;
  student_id: string;
  status: string;
  enrolled_at: string;
  profile: {
    full_name: string | null;
  } | null;
}

interface Assignment {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_at: string;
  target_track: string | null;
}

const ASSIGNMENT_TYPE_LABEL: Record<string, string> = {
  interview: "مقابلة",
  cv: "سيرة ذاتية",
  quiz: "اختبار",
  reflection: "تأمّل",
};

const CohortDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user || !id) return;

    const load = async () => {
      const [cohortRes, enrollRes, assignRes] = await Promise.all([
        supabase
          .from("cohorts")
          .select("*")
          .eq("id", id)
          .single(),
        supabase
          .from("enrollments")
          .select("id, student_id, status, enrolled_at")
          .eq("cohort_id", id)
          .eq("status", "active"),
        supabase
          .from("assignments")
          .select("*")
          .eq("cohort_id", id)
          .order("due_at", { ascending: true }),
      ]);

      setCohort((cohortRes.data as unknown as Cohort) ?? null);
      const rawEnrollments = (enrollRes.data as unknown as Enrollment[]) ?? [];
      setAssignments((assignRes.data as unknown as Assignment[]) ?? []);

      // Fetch profile names in batch
      if (rawEnrollments.length > 0) {
        const studentIds = rawEnrollments.map((e) => e.student_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", studentIds);

        const profileMap: Record<string, { full_name: string | null }> = {};
        for (const p of profiles || []) {
          profileMap[(p as any).user_id] = { full_name: (p as any).full_name };
        }

        setEnrollments(
          rawEnrollments.map((e) => ({
            ...e,
            profile: profileMap[e.student_id] ?? null,
          })),
        );
      } else {
        setEnrollments([]);
      }

      setLoading(false);
    };

    load();
  }, [user, authLoading, id, navigate]);

  if (loading || !cohort) {
    return (
      <div className="min-h-screen bg-background p-8" dir="rtl">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">{cohort.name}</h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/instructor">
              العودة للوحة المدرّب
              <ArrowRight className="w-4 h-4 mr-2" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        {/* Cohort summary */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">{cohort.name}</h2>
                {cohort.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                    {cohort.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {cohort.track && <Badge variant="outline">{cohort.track}</Badge>}
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {cohort.status === "active" ? "نشطة" : cohort.status}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(cohort.start_date).toLocaleDateString("ar-SA")} →{" "}
                {new Date(cohort.end_date).toLocaleDateString("ar-SA")}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {enrollments.length} / {cohort.capacity} طالب
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="students" dir="rtl">
          <TabsList>
            <TabsTrigger value="students">الطلاب</TabsTrigger>
            <TabsTrigger value="assignments">المهام</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">طلاب الدفعة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {enrollments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>لا يوجد طلاب مسجّلون بعد.</p>
                  </div>
                ) : (
                  enrollments.map((e) => (
                    <Link
                      key={e.id}
                      to={`/dashboard/instructor/student/${e.student_id}`}
                      className="flex items-center justify-between rounded-xl border border-border p-3 hover:border-primary/40 hover:bg-muted/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
                          {e.profile?.full_name?.[0] ?? "؟"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {e.profile?.full_name ?? "(بدون اسم)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            سُجِّل في{" "}
                            {new Date(e.enrolled_at).toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">مهام الدفعة</CardTitle>
                <Button size="sm" variant="outline" disabled className="rounded-xl">
                  <Plus className="w-3.5 h-3.5 ml-1.5" />
                  إنشاء مهمة (قريباً)
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {assignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>لا توجد مهام بعد.</p>
                  </div>
                ) : (
                  assignments.map((a) => {
                    const overdue = new Date(a.due_at) < new Date();
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-normal">
                              {ASSIGNMENT_TYPE_LABEL[a.type] ?? a.type}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              {a.title}
                            </span>
                          </div>
                          <Badge
                            className={
                              overdue
                                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            }
                          >
                            {overdue ? "متأخّرة" : "مفتوحة"}
                          </Badge>
                        </div>
                        {a.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {a.description}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          موعد التسليم:{" "}
                          {new Date(a.due_at).toLocaleString("ar-SA")}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CohortDetail;
