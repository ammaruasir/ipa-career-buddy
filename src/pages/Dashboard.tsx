import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare, Mic, Video, LogOut, GraduationCap,
  BarChart3, Clock, CheckCircle2, Loader2
} from "lucide-react";

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

const Dashboard = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (user) {
      supabase
        .from("interviews")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setInterviews(data || []);
          setLoading(false);
        });
    }
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">لوحة التحكم</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{interviews.length}</p>
                <p className="text-sm text-muted-foreground">إجمالي المقابلات</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completed}</p>
                <p className="text-sm text-muted-foreground">مقابلات مكتملة</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{inProgress}</p>
                <p className="text-sm text-muted-foreground">مقابلات جارية</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Start */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-4">ابدأ مقابلة جديدة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["text", "voice", "video"] as const).map((type) => {
              const { label, icon: Icon } = typeMap[type];
              return (
                <Button
                  key={type}
                  variant="outline"
                  className="rounded-2xl h-auto py-6 flex flex-col gap-3 shadow-lg hover:shadow-xl transition-all hover:border-primary/30"
                  asChild
                >
                  <Link to={`/interview/${type}`}>
                    <Icon className="w-8 h-8 text-primary" />
                    <span className="text-lg font-semibold">مقابلة {label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
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

export default Dashboard;
