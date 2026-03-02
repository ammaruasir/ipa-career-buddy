import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, Briefcase, MapPin, Building2, Clock, Search, Loader2, Send,
} from "lucide-react";
import { toast } from "sonner";
import InterviewTypeDialog from "@/components/interview/InterviewTypeDialog";
import EligibilityDialog from "@/components/interview/EligibilityDialog";

interface Vacancy {
  id: string;
  title: string;
  description: string | null;
  requirements: string[];
  department: string | null;
  location: string | null;
  employment_type: string;
  created_at: string;
}

const employmentTypeMap: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  contract: "عقد مؤقت",
};

const JobVacancies = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [showTypeDialog, setShowTypeDialog] = useState(false);

  // Eligibility state
  const [showEligibility, setShowEligibility] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);
  const [noResume, setNoResume] = useState(false);

  useEffect(() => { loadVacancies(); }, []);
  useEffect(() => { if (user) loadUserApplications(); }, [user]);

  useEffect(() => {
    const applyId = searchParams.get("apply");
    if (applyId && user && !authLoading && vacancies.length > 0) {
      const vacancy = vacancies.find((v) => v.id === applyId);
      if (vacancy && !applications.has(applyId)) {
        handleApplyClick(vacancy);
      }
    }
  }, [user, authLoading, vacancies, applications]);

  const loadVacancies = async () => {
    const { data } = await supabase.from("job_vacancies").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setVacancies((data as any) || []);
    setLoading(false);
  };

  const loadUserApplications = async () => {
    if (!user) return;
    const { data } = await supabase.from("job_applications").select("vacancy_id").eq("user_id", user.id);
    setApplications(new Set((data || []).map((a: any) => a.vacancy_id)));
  };

  const handleApplyClick = async (vacancy: Vacancy) => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/jobs?apply=${vacancy.id}`)}`);
      return;
    }
    setSelectedVacancy(vacancy);
    setEligibilityResult(null);
    setNoResume(false);
    setShowEligibility(true);
    setEligibilityLoading(true);

    // Fetch user profile for resume_skills
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const resumeUrl = (profile as any)?.resume_url;
    const resumeSkills = (profile as any)?.resume_skills;
    const requirements = Array.isArray(vacancy.requirements) ? vacancy.requirements : [];

    if (!resumeUrl && requirements.length > 0) {
      setNoResume(true);
      setEligibilityLoading(false);
      return;
    }

    if (requirements.length === 0) {
      // No requirements, skip eligibility check
      setEligibilityLoading(false);
      setShowEligibility(false);
      await applyToJob(vacancy);
      return;
    }

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("check-eligibility", {
        body: {
          resume_skills: resumeSkills || {},
          requirements,
          job_title: vacancy.title,
        },
      });

      if (fnError) throw fnError;
      if (fnData?.error) {
        toast.error(fnData.error);
        setShowEligibility(false);
      } else {
        setEligibilityResult(fnData);
      }
    } catch (e) {
      console.error("Eligibility check failed:", e);
      toast.error("تعذر فحص الأهلية، يمكنك التقديم مباشرة");
      setShowEligibility(false);
      await applyToJob(vacancy);
    }
    setEligibilityLoading(false);
  };

  const applyToJob = async (vacancy?: Vacancy) => {
    const v = vacancy || selectedVacancy;
    if (!v || !user) return;
    setApplying(v.id);
    const { error } = await supabase.from("job_applications").insert({
      vacancy_id: v.id,
      user_id: user.id,
      status: "applied",
    } as any);
    if (error) {
      toast.error("حدث خطأ أثناء التقديم");
    } else {
      toast.success("تم التقديم بنجاح! اختر نوع المقابلة للبدء.");
      setApplications((prev) => new Set(prev).add(v.id));
      setSelectedVacancy(v);
      setShowTypeDialog(true);
    }
    setApplying(null);
  };

  const handleEligibilityProceed = async () => {
    setShowEligibility(false);
    await applyToJob();
  };

  const handleInterviewTypeSelect = (type: "text" | "voice" | "video") => {
    if (!selectedVacancy) return;
    setShowTypeDialog(false);
    navigate(`/interview/${type}?job=${encodeURIComponent(selectedVacancy.title)}&vacancy_id=${selectedVacancy.id}`);
  };

  const departments = [...new Set(vacancies.map((v) => v.department).filter(Boolean))] as string[];

  const filtered = vacancies.filter((v) => {
    const matchSearch = !search || v.title.includes(search) || v.description?.includes(search);
    const matchDept = deptFilter === "all" || v.department === deptFilter;
    return matchSearch && matchDept;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/dashboard/candidate")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <img src="/ipa-logo.png" alt="معهد الإدارة العامة" className="w-10 h-10 rounded-xl object-contain" />
          <h2 className="text-lg font-bold">الوظائف المتاحة</h2>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-l from-primary/10 via-secondary/5 to-transparent p-8 border border-border">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">استعرض الوظائف المتاحة</h1>
          <p className="text-muted-foreground">اختر الوظيفة المناسبة وقدّم عليها لبدء مقابلتك الذكية</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن وظيفة..." className="pr-10" />
          </div>
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="جميع الأقسام" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأقسام</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {filtered.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">لا توجد وظائف متاحة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((vacancy) => {
              const hasApplied = applications.has(vacancy.id);
              const requirements = Array.isArray(vacancy.requirements) ? vacancy.requirements : [];
              return (
                <Card key={vacancy.id} className="rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{vacancy.title}</CardTitle>
                        <CardDescription className="mt-1">{vacancy.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{employmentTypeMap[vacancy.employment_type] || vacancy.employment_type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {vacancy.department && <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{vacancy.department}</span>}
                      {vacancy.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{vacancy.location}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(vacancy.created_at).toLocaleDateString("ar-SA")}</span>
                    </div>
                    {requirements.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {requirements.slice(0, 4).map((req, i) => <Badge key={i} variant="outline" className="text-xs">{req}</Badge>)}
                        {requirements.length > 4 && <Badge variant="outline" className="text-xs">+{requirements.length - 4}</Badge>}
                      </div>
                    )}
                    <Button
                      className="w-full rounded-xl"
                      disabled={hasApplied || applying === vacancy.id}
                      onClick={() => handleApplyClick(vacancy)}
                    >
                      {applying === vacancy.id ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      ) : hasApplied ? "تم التقديم مسبقاً" : (
                        <><Send className="w-4 h-4 ml-2" /> قدّم الآن</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <EligibilityDialog
        open={showEligibility}
        onOpenChange={setShowEligibility}
        loading={eligibilityLoading}
        result={eligibilityResult}
        noResume={noResume}
        onProceed={handleEligibilityProceed}
        onGoToProfile={() => { setShowEligibility(false); navigate("/settings/profile"); }}
        vacancyTitle={selectedVacancy?.title || ""}
      />

      <InterviewTypeDialog
        open={showTypeDialog}
        onOpenChange={setShowTypeDialog}
        onSelect={handleInterviewTypeSelect}
        vacancyTitle={selectedVacancy?.title || ""}
      />
    </div>
  );
};

export default JobVacancies;
