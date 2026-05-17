import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Users, Calendar, Loader2, ChevronLeft, LogOut,
} from "lucide-react";

const InstructorDashboard = () => {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCohort, setNewCohort] = useState({ name: "", description: "", track: "", start_date: "", end_date: "" });
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && user && role && role !== "instructor" && role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!user) return;
    loadCohorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, authLoading]);

  const loadCohorts = async () => {
    if (!user) return;
    setLoading(true);
    const { data: cohortRows } = await supabase
      .from("cohorts")
      .select("*")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false });

    // Count enrollments per cohort
    const ids = (cohortRows || []).map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: enrollRows } = await supabase
        .from("enrollments")
        .select("cohort_id")
        .in("cohort_id", ids);
      (enrollRows || []).forEach((e: any) => { counts[e.cohort_id] = (counts[e.cohort_id] || 0) + 1; });
    }
    setCohorts((cohortRows || []).map((c) => ({ ...c, student_count: counts[c.id] || 0 })));
    setLoading(false);
  };

  const createCohort = async () => {
    if (!user || !newCohort.name.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("cohorts").insert({
        instructor_id: user.id,
        name: newCohort.name,
        description: newCohort.description || null,
        track: newCohort.track || null,
        start_date: newCohort.start_date || null,
        end_date: newCohort.end_date || null,
      });
      if (error) throw error;
      toast.success("تم إنشاء الدفعة");
      setNewCohort({ name: "", description: "", track: "", start_date: "", end_date: "" });
      setDialogOpen(false);
      await loadCohorts();
    } catch (e) {
      console.error(e);
      toast.error("تعذّر إنشاء الدفعة");
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">لوحة المدرّب</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/login"))}>
            <LogOut className="w-4 h-4 ml-1.5" /> تسجيل خروج
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">دفعاتي التدريبية</h2>
            <p className="text-muted-foreground text-sm mt-1">إجمالي الدفعات: {cohorts.length}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" /> دفعة جديدة</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إنشاء دفعة تدريبية</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>اسم الدفعة</Label><Input value={newCohort.name} onChange={(e) => setNewCohort({ ...newCohort, name: e.target.value })} placeholder="مثال: دفعة الإدارة العامة 1446-2" /></div>
                <div><Label>الوصف</Label><Textarea rows={2} value={newCohort.description} onChange={(e) => setNewCohort({ ...newCohort, description: e.target.value })} /></div>
                <div><Label>المسار</Label>
                  <Select value={newCohort.track} onValueChange={(v) => setNewCohort({ ...newCohort, track: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر مساراً" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="الإدارة العامة">الإدارة العامة</SelectItem>
                      <SelectItem value="تقنية المعلومات">تقنية المعلومات</SelectItem>
                      <SelectItem value="الموارد البشرية">الموارد البشرية</SelectItem>
                      <SelectItem value="الشؤون المالية">الشؤون المالية</SelectItem>
                      <SelectItem value="إدارة المعلومات">إدارة المعلومات</SelectItem>
                      <SelectItem value="المكتبات">المكتبات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>تاريخ البداية</Label><Input type="date" value={newCohort.start_date} onChange={(e) => setNewCohort({ ...newCohort, start_date: e.target.value })} /></div>
                  <div><Label>تاريخ النهاية</Label><Input type="date" value={newCohort.end_date} onChange={(e) => setNewCohort({ ...newCohort, end_date: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={creating || !newCohort.name.trim()} onClick={createCohort}>
                  {creating ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ الإنشاء...</> : "إنشاء"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {cohorts.length === 0 && (
          <Card><CardContent className="p-12 text-center space-y-3">
            <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد دفعات بعد — ابدأ بإنشاء دفعتك الأولى.</p>
          </CardContent></Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cohorts.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate(`/dashboard/instructor/cohort/${c.id}`)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="line-clamp-1">{c.name}</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {c.track && <Badge variant="outline">{c.track}</Badge>}
                {c.description && <p className="text-muted-foreground line-clamp-2">{c.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{c.student_count} طالب</span>
                  {c.start_date && (
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{c.start_date}</span>
                  )}
                </div>
                <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">{c.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboard;
