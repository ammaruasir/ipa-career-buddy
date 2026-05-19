import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toArabicNumerals } from "@/lib/arabic-utils";
import {
  ArrowRight, Loader2, User, GripVertical, Briefcase, LogOut, FileText,
} from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "applied", label: "مقدّم", color: "bg-muted text-muted-foreground" },
  { key: "screening", label: "فرز", color: "bg-warning/10 text-warning" },
  { key: "interviewing", label: "مقابلة", color: "bg-primary/10 text-primary" },
  { key: "offered", label: "عرض وظيفي", color: "bg-secondary/10 text-secondary" },
  { key: "hired", label: "تم التعيين", color: "bg-success/10 text-success" },
  { key: "rejected", label: "مرفوض", color: "bg-destructive/10 text-destructive" },
];

interface AppRow {
  id: string;
  user_id: string;
  vacancy_id: string;
  pipeline_stage: string;
  status: string;
  created_at: string;
  profile?: { full_name: string | null; major: string | null };
  vacancy?: { title: string; department: string | null };
}

const HiringPipeline = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVacancy, setFilterVacancy] = useState("all");
  const [dragItem, setDragItem] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "hr" && role !== "admin") { navigate("/dashboard"); return; }
    if (!user || !role) return;

    const load = async () => {
      const [aRes, vRes] = await Promise.all([
        supabase.from("job_applications").select("*"),
        supabase.from("job_vacancies").select("*").order("created_at", { ascending: false }),
      ]);

      const applications = aRes.data || [];
      const vacs = vRes.data || [];

      // Fetch profiles for all applicants
      const userIds = [...new Set(applications.map((a: any) => a.user_id))];
      const profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: pData } = await supabase.from("profiles").select("user_id, full_name, major").in("user_id", userIds);
        (pData || []).forEach((p: any) => { profiles[p.user_id] = p; });
      }

      const vacsMap: Record<string, any> = {};
      vacs.forEach((v: any) => { vacsMap[v.id] = v; });

      const enriched: AppRow[] = applications.map((a: any) => ({
        ...a,
        pipeline_stage: a.pipeline_stage || "applied",
        profile: profiles[a.user_id] || { full_name: null, major: null },
        vacancy: vacsMap[a.vacancy_id] ? { title: vacsMap[a.vacancy_id].title, department: vacsMap[a.vacancy_id].department } : undefined,
      }));

      setApps(enriched);
      setVacancies(vacs);
      setLoading(false);
    };
    load();
  }, [user, role, authLoading, navigate]);

  const moveToStage = async (appId: string, newStage: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, pipeline_stage: newStage } : a))
    );
    const { error } = await supabase
      .from("job_applications")
      .update({ pipeline_stage: newStage } as any)
      .eq("id", appId);
    if (error) {
      toast.error("حدث خطأ في تحديث المرحلة");
    } else {
      toast.success("تم نقل المرشح بنجاح");
    }
  };

  const handleDragStart = (appId: string) => setDragItem(appId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (stage: string) => {
    if (dragItem) {
      moveToStage(dragItem, stage);
      setDragItem(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredApps = filterVacancy === "all" ? apps : apps.filter((a) => a.vacancy_id === filterVacancy);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/hr")} className="rounded-xl">
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-bold text-foreground">مراحل التوظيف</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterVacancy} onValueChange={setFilterVacancy}>
              <SelectTrigger className="rounded-xl w-[250px]">
                <SelectValue placeholder="فلترة حسب الوظيفة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الوظائف</SelectItem>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stage stats */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {STAGES.map((s) => {
            const count = filteredApps.filter((a) => a.pipeline_stage === s.key).length;
            return (
              <Badge key={s.key} variant="outline" className={`text-sm px-4 py-2 ${s.color}`}>
                {s.label}: {toArabicNumerals(count)}
              </Badge>
            );
          })}
        </div>

        {/* Kanban Board */}
        <div data-tour="pipeline-board" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 min-h-[60vh]">
          {STAGES.map((stage) => {
            const stageApps = filteredApps.filter((a) => a.pipeline_stage === stage.key);
            return (
              <div
                key={stage.key}
                data-tour={`pipeline-column-${stage.key}`}
                className="rounded-2xl border border-border bg-muted/30 p-3 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.key)}
              >
                <div className={`rounded-xl px-3 py-2 mb-3 text-center text-sm font-bold ${stage.color}`}>
                  {stage.label} ({toArabicNumerals(stageApps.length)})
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[60vh]">
                  {stageApps.map((app) => (
                    <Card
                      key={app.id}
                      className="rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      draggable
                      onDragStart={() => handleDragStart(app.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {app.profile?.full_name || "مرشح"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {app.vacancy?.title || "—"}
                            </p>
                            {app.profile?.major && (
                              <p className="text-xs text-muted-foreground truncate">{app.profile.major}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(app.created_at).toLocaleDateString("ar-SA")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {stageApps.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">لا يوجد</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HiringPipeline;
