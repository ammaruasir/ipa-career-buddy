import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toArabicNumerals, formatArabicPercent } from "@/lib/arabic-utils";
import {
  MessageSquare, Mic, Video, LogOut, Briefcase,
  BarChart3, Clock, CheckCircle2, Loader2, TrendingUp,
  ChevronDown, ChevronUp, Sparkles, Settings, FileText,
  MapPin, Building2, Send, GraduationCap,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد الانتظار", variant: "outline" },
  in_progress: { label: "جارية", variant: "secondary" },
  completed: { label: "مكتملة", variant: "default" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

const typeMap: Record<string, { label: string; icon: typeof MessageSquare }> = {
  text: { label: "نصية", icon: MessageSquare },
  voice: { label: "صوتية", icon: Mic },
  video: { label: "فيديو", icon: Video },
};

const CandidateDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user) return;

    const load = async () => {
      const [profileRes, interviewsRes, appsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("interviews").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("job_applications").select("*, job_vacancies(title, department, location, employment_type)").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProfile(profileRes.data);
      const ivs = interviewsRes.data || [];
      setInterviews(ivs);
      setApplications((appsRes.data as any) || []);

      const completedIds = ivs.filter((i: any) => i.status === "completed").map((i: any) => i.id);
      if (completedIds.length > 0) {
        const { data: evals } = await supabase
          .from("evaluations")
          .select("*")
          .in("interview_id", completedIds)
          .order("created_at", { ascending: true });
        setEvaluations(evals || []);
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const completed = interviews.filter((i) => i.status === "completed").length;
  const inProgress = interviews.filter((i) => i.status === "in_progress").length;
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((s, e) => s + (e.overall_score || 0), 0) / evaluations.length)
    : 0;

  const chartData = evaluations.map((e, idx) => ({
    name: `مقابلة ${idx + 1}`,
    score: e.overall_score || 0,
  }));

  const recentEvals = evaluations.slice(-3).reverse();

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "المرشح";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">لوحة المرشح</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/career-guidance">
                <GraduationCap className="w-4 h-4 ml-1" />
                الإرشاد المهني
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings/profile">
                <Settings className="w-4 h-4 ml-1" />
                الملف الشخصي
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings/interview">
                <Mic className="w-4 h-4 ml-1" />
                إعدادات المقابلة
              </Link>
            </Button>
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="w-4 h-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-l from-primary/10 via-secondary/5 to-transparent p-8 border border-border">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            مرحباً {displayName}، أهلاً بك في بوابة المقابلات الذكية
          </h1>
          <p className="text-muted-foreground">تابع تقدمك وابدأ مقابلات جديدة لتحسين أدائك</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{toArabicNumerals(interviews.length)}</p>
                <p className="text-sm text-muted-foreground">إجمالي المقابلات</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatArabicPercent(avgScore)}</p>
                <p className="text-sm text-muted-foreground">متوسط التقييم</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{toArabicNumerals(inProgress)}</p>
                <p className="text-sm text-muted-foreground">مقابلات جارية</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Browse Jobs */}
        <Card className="rounded-2xl shadow-lg border-2 border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-6 h-6 text-primary" />
              <div>
                <p className="font-bold text-foreground">استعرض الوظائف المتاحة</p>
                <p className="text-sm text-muted-foreground">تصفح الوظائف الشاغرة وقدّم على المناسب لك</p>
              </div>
            </div>
            <Button asChild className="rounded-xl">
              <Link to="/jobs">تصفح الوظائف</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Practice Mode */}
        <Card className="rounded-2xl shadow-lg border-dashed border-2 border-secondary/40">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-secondary" />
              <div>
                <p className="font-bold text-foreground">وضع التدريب</p>
                <p className="text-sm text-muted-foreground">تدرب على مقابلات وهمية مع الذكاء الاصطناعي</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["text", "voice", "video"] as const).map((t) => {
                const { label, icon: Icon } = typeMap[t];
                return (
                  <Button key={t} variant="outline" className="rounded-2xl h-auto py-5 flex flex-col gap-2 hover:border-secondary/50 transition-all" asChild>
                    <Link to={`/interview/${t}?practice=true`}>
                      <Icon className="w-7 h-7 text-secondary" />
                      <span className="text-base font-semibold">تدريب {label}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Progress Chart */}
        {chartData.length > 1 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">تطور أدائك</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      direction: "rtl",
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} name="الدرجة" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Feedback */}
        {recentEvals.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">آخر التقييمات</h3>
            <div className="space-y-3">
              {recentEvals.map((ev) => {
                const interview = interviews.find((i) => i.id === ev.interview_id);
                const isExpanded = expandedFeedback === ev.id;
                const strengths = Array.isArray(ev.strengths) ? ev.strengths : [];
                return (
                  <Card key={ev.id} className="rounded-2xl shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedFeedback(isExpanded ? null : ev.id)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{ev.overall_score || 0}%</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{interview?.job_position || "مقابلة"}</p>
                            <p className="text-sm text-muted-foreground">{ev.recommendation || ""}</p>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      {isExpanded && (
                        <div className="mt-4 space-y-3 border-t border-border pt-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div><p className="text-xs text-muted-foreground">التواصل</p><Progress value={ev.communication_score || 0} className="h-2 mt-1" /></div>
                            <div><p className="text-xs text-muted-foreground">تقني</p><Progress value={ev.technical_score || 0} className="h-2 mt-1" /></div>
                            <div><p className="text-xs text-muted-foreground">ثقافي</p><Progress value={ev.personality_match || 0} className="h-2 mt-1" /></div>
                          </div>
                          {strengths.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-foreground mb-1">نقاط القوة:</p>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {strengths.slice(0, 3).map((s: string, i: number) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                          {ev.ai_feedback_ar && <p className="text-sm text-muted-foreground italic">{ev.ai_feedback_ar}</p>}
                          <Button size="sm" variant="outline" className="rounded-xl" asChild>
                            <Link to={`/interview/${ev.interview_id}/results`}>عرض التفاصيل الكاملة</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* My Applications */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> طلباتي
          </h3>
          {applications.length === 0 ? (
            <Card className="rounded-2xl shadow-lg">
              <CardContent className="p-8 text-center">
                <Send className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">لم تقدّم على أي وظيفة بعد.</p>
                <Button asChild variant="outline" className="mt-4 rounded-xl">
                  <Link to="/jobs">تصفح الوظائف</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const vacancy = app.job_vacancies;
                const appStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                  applied: { label: "تم التقديم", variant: "outline" },
                  interviewing: { label: "قيد المقابلة", variant: "secondary" },
                  accepted: { label: "مقبول", variant: "default" },
                  rejected: { label: "مرفوض", variant: "destructive" },
                };
                const appStatus = appStatusMap[app.status] || appStatusMap.applied;
                const empTypeMap: Record<string, string> = { full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد مؤقت" };
                return (
                  <Card key={app.id} className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{vacancy?.title || "وظيفة"}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            {vacancy?.department && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{vacancy.department}</span>}
                            {vacancy?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{vacancy.location}</span>}
                            {vacancy?.employment_type && <span>{empTypeMap[vacancy.employment_type] || vacancy.employment_type}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            قُدّم في {new Date(app.created_at).toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={appStatus.variant}>{appStatus.label}</Badge>
                        {app.interview_id && (
                          <Button size="sm" variant="ghost" className="rounded-xl" asChild>
                            <Link to={`/interview/${app.interview_id}/results`}>النتائج</Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Interview History */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-4">سجل المقابلات</h3>
          {interviews.length === 0 ? (
            <Card className="rounded-2xl shadow-lg">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground text-lg">لم تجرِ أي مقابلات بعد. ابدأ مقابلتك الأولى!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => {
                const status = statusMap[interview.status] || statusMap.pending;
                const type = typeMap[interview.type] || typeMap.text;
                const Icon = type.icon;
                const ev = evaluations.find((e) => e.interview_id === interview.id);
                return (
                  <Card key={interview.id} className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{interview.job_position}</p>
                          <p className="text-sm text-muted-foreground">مقابلة {type.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {ev && <Badge variant="secondary" className="rounded-full">{ev.overall_score}%</Badge>}
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {interview.status === "completed" && (
                          <Button size="sm" variant="ghost" className="rounded-xl" asChild>
                            <Link to={`/interview/${interview.id}/results`}>عرض النتائج</Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard;
