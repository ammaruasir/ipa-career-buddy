import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  Users,
  Calendar,
  ArrowLeft,
  LogOut,
  TrendingUp,
  ClipboardList,
} from "lucide-react";

interface Cohort {
  id: string;
  name: string;
  track: string | null;
  status: string;
  start_date: string;
  end_date: string;
  capacity: number;
}

interface CohortStats {
  cohortId: string;
  enrollmentCount: number;
  avgScore: number | null;
  activeAssignments: number;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  planned:   { label: "مخطّطة",  tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  active:    { label: "نشطة",   tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  completed: { label: "مكتمَلة", tone: "bg-muted text-muted-foreground" },
  archived:  { label: "مؤرشَفة", tone: "bg-muted text-muted-foreground" },
};

const InstructorDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [stats, setStats] = useState<Record<string, CohortStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user) return;

    const load = async () => {
      const { data: cohortRows } = await supabase
        .from("cohorts")
        .select("id, name, track, status, start_date, end_date, capacity")
        .order("start_date", { ascending: false });

      const list = (cohortRows || []) as unknown as Cohort[];
      setCohorts(list);

      // Fetch stats per cohort in parallel
      const statResults = await Promise.all(
        list.map(async (c) => {
          const [enrollments, assignments] = await Promise.all([
            supabase
              .from("enrollments")
              .select("student_id", { count: "exact", head: true })
              .eq("cohort_id", c.id)
              .eq("status", "active"),
            supabase
              .from("assignments")
              .select("id", { count: "exact", head: true })
              .eq("cohort_id", c.id)
              .gt("due_at", new Date().toISOString()),
          ]);

          return {
            cohortId: c.id,
            enrollmentCount: enrollments.count ?? 0,
            avgScore: null,
            activeAssignments: assignments.count ?? 0,
          } as CohortStats;
        })
      );

      const statMap: Record<string, CohortStats> = {};
      for (const s of statResults) statMap[s.cohortId] = s;
      setStats(statMap);

      setLoading(false);
    };

    load();
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">لوحة المدرّب</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        {/* Hero */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/5 to-primary/10 p-6">
          <h2 className="text-xl font-bold text-foreground mb-2">
            مرحباً بك في فضاء التدريب
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            هنا تتابع دفعاتك، تنشئ المهام، وتترك تعليقات تعليمية على إجابات طلابك ضمن مقاطع المقابلات.
            كل تعليق تكتبه يصل للطالب مع رابط مباشر للحظة الزمنية في الفيديو.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="w-4 h-4" />
                إجمالي الدفعات
              </div>
              <p className="text-2xl font-bold text-foreground">{cohorts.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="w-4 h-4" />
                دفعات نشطة
              </div>
              <p className="text-2xl font-bold text-foreground">
                {cohorts.filter((c) => c.status === "active").length}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="w-4 h-4" />
                إجمالي الطلاب
              </div>
              <p className="text-2xl font-bold text-foreground">
                {Object.values(stats).reduce((sum, s) => sum + s.enrollmentCount, 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <ClipboardList className="w-4 h-4" />
                مهام مفتوحة
              </div>
              <p className="text-2xl font-bold text-foreground">
                {Object.values(stats).reduce((sum, s) => sum + s.activeAssignments, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cohorts list */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">دفعاتك</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : cohorts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>لا توجد دفعات معيّنة لك بعد.</p>
                <p className="text-xs mt-2">يقوم الأدمن بتعيين الدفعات للمدرّبين.</p>
              </div>
            ) : (
              cohorts.map((c) => {
                const s = stats[c.id];
                const statusInfo = STATUS_LABEL[c.status] || STATUS_LABEL.planned;
                return (
                  <Link
                    key={c.id}
                    to={`/dashboard/instructor/cohort/${c.id}`}
                    className="block rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{c.name}</h3>
                          <Badge className={statusInfo.tone}>{statusInfo.label}</Badge>
                          {c.track && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {c.track}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(c.start_date).toLocaleDateString("ar-SA")}
                            <span className="opacity-50">→</span>
                            {new Date(c.end_date).toLocaleDateString("ar-SA")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {s?.enrollmentCount ?? 0} / {c.capacity}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5" />
                            {s?.activeAssignments ?? 0} مهامّ مفتوحة
                          </span>
                        </div>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstructorDashboard;
