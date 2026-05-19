import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toArabicNumerals, formatArabicPercent } from "@/lib/arabic-utils";
import {
  Users, FileText, TrendingUp, Award, LogOut,
  Search, Eye, Loader2, Briefcase, GraduationCap,
  ChevronDown, ChevronUp, Star, AlertCircle, Kanban, GitCompareArrows, Radio,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
];

interface CandidateRow {
  user_id: string;
  full_name: string;
  major: string | null;
  education_level: string | null;
  experience_years: number | null;
  resume_skills: any;
  resume_url: string | null;
  city: string | null;
  nationality: string | null;
}

const HRDashboard = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "hr" && role !== "admin") { navigate("/dashboard/candidate"); return; }
    if (!user || !role) return;

    const load = async () => {
      const [pRes, vRes, aRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, major, education_level, experience_years, resume_skills, resume_url, city, nationality"),
        supabase.from("job_vacancies").select("*").order("created_at", { ascending: false }),
        supabase.from("job_applications").select("*"),
      ]);
      setCandidates((pRes.data || []) as CandidateRow[]);
      setVacancies(vRes.data || []);
      setApplications(aRes.data || []);
      setLoading(false);
    };
    load();
  }, [user, role, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Extract skills from resume_skills field
  const getSkills = (rs: any): string[] => {
    if (!rs) return [];
    if (Array.isArray(rs)) return rs;
    const skills: string[] = [];
    if (rs.technical_skills) skills.push(...(Array.isArray(rs.technical_skills) ? rs.technical_skills : []));
    if (rs.soft_skills) skills.push(...(Array.isArray(rs.soft_skills) ? rs.soft_skills : []));
    if (rs.languages) skills.push(...(Array.isArray(rs.languages) ? rs.languages : []));
    return skills;
  };

  const getCertifications = (rs: any): string[] => {
    if (!rs || !rs.certifications) return [];
    return Array.isArray(rs.certifications) ? rs.certifications : [];
  };

  const getSummary = (rs: any): string => {
    if (!rs || !rs.summary) return "";
    return rs.summary;
  };

  // Compute match percentage for a candidate against a vacancy's requirements
  const computeMatch = (candidateSkills: string[], requirements: any[]): number => {
    if (!requirements || requirements.length === 0) return 0;
    const reqTexts = requirements.map((r: any) => (typeof r === "string" ? r : r.text || r.name || "").toLowerCase());
    if (reqTexts.length === 0) return 0;
    const matched = reqTexts.filter((req: string) =>
      candidateSkills.some((s) => s.toLowerCase().includes(req) || req.includes(s.toLowerCase()))
    );
    return Math.round((matched.length / reqTexts.length) * 100);
  };

  // All unique skills across candidates
  const allSkillsMap: Record<string, number> = {};
  candidates.forEach((c) => {
    getSkills(c.resume_skills).forEach((s) => {
      allSkillsMap[s] = (allSkillsMap[s] || 0) + 1;
    });
  });
  const topSkills = Object.entries(allSkillsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const uniqueSkillNames = Object.keys(allSkillsMap).sort();

  // Candidates with resumes
  const candidatesWithResume = candidates.filter((c) => c.resume_url);
  const candidatesWithSkills = candidates.filter((c) => getSkills(c.resume_skills).length > 0);

  // Filter candidates
  const filtered = candidates.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (c.full_name || "").toLowerCase();
      const skills = getSkills(c.resume_skills).join(" ").toLowerCase();
      if (!name.includes(q) && !skills.includes(q)) return false;
    }
    if (skillFilter !== "all") {
      const skills = getSkills(c.resume_skills).map((s) => s.toLowerCase());
      if (!skills.some((s) => s.includes(skillFilter.toLowerCase()))) return false;
    }
    return true;
  });

  // Vacancy-based matching
  const selectedVacancyData = selectedVacancy !== "all" ? vacancies.find((v) => v.id === selectedVacancy) : null;
  const matchedCandidates = selectedVacancyData
    ? filtered
        .map((c) => ({
          ...c,
          matchPercent: computeMatch(getSkills(c.resume_skills), selectedVacancyData.requirements || []),
        }))
        .sort((a, b) => b.matchPercent - a.matchPercent)
    : filtered.map((c) => ({ ...c, matchPercent: -1 }));

  // Chart data: skill distribution
  const skillChartData = topSkills.map(([name, count]) => ({ name, count }));

  // Chart data: education levels
  const eduCounts: Record<string, number> = {};
  candidates.forEach((c) => {
    const level = c.education_level || "غير محدد";
    eduCounts[level] = (eduCounts[level] || 0) + 1;
  });
  const eduChartData = Object.entries(eduCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">لوحة تحليل السير الذاتية</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/proctor">
                <Radio className="w-4 h-4 ml-1 text-destructive" />
                المراقبة المباشرة
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/hr/pipeline">
                <Kanban className="w-4 h-4 ml-1" />
                مراحل التوظيف
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/hr/compare">
                <GitCompareArrows className="w-4 h-4 ml-1" />
                مقارنة المرشحين
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/admin">
                <Briefcase className="w-4 h-4 ml-1" />
                لوحة الإدارة
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
        {/* Stats */}
        <div data-tour="hr-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "إجمالي المرشحين", value: toArabicNumerals(candidates.length), color: "bg-primary/10 text-primary" },
            { icon: FileText, label: "سير ذاتية مرفوعة", value: toArabicNumerals(candidatesWithResume.length), color: "bg-secondary/10 text-secondary" },
            { icon: Star, label: "مهارات مستخرجة", value: toArabicNumerals(candidatesWithSkills.length), color: "bg-success/10 text-success" },
            { icon: TrendingUp, label: "إجمالي المهارات الفريدة", value: toArabicNumerals(uniqueSkillNames.length), color: "bg-warning/10 text-warning" },
          ].map((stat, i) => (
            <Card key={i} className="rounded-2xl shadow-lg">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Vacancy Matcher */}
        <Card className="rounded-2xl shadow-lg border-2 border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              مطابقة المرشحين مع الوظائف
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="rounded-xl max-w-md">
                <SelectValue placeholder="اختر وظيفة لعرض نسب التطابق" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المرشحين (بدون مطابقة)</SelectItem>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.title} — {v.department || ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVacancyData && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">متطلبات الوظيفة:</span>
                {(selectedVacancyData.requirements || []).map((r: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{typeof r === "string" ? r : r.text || r.name || ""}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو المهارة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 rounded-xl"
            />
          </div>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-[200px] rounded-xl"><SelectValue placeholder="فلترة بالمهارة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المهارات</SelectItem>
              {topSkills.slice(0, 20).map(([skill]) => (
                <SelectItem key={skill} value={skill}>{skill}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Candidates Table */}
        <Card data-tour="hr-candidates-table" className="rounded-2xl shadow-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المرشح</TableHead>
                <TableHead className="text-right">التخصص</TableHead>
                <TableHead className="text-right">الخبرة</TableHead>
                <TableHead className="text-right">المهارات</TableHead>
                {selectedVacancyData && <TableHead className="text-right">نسبة التطابق</TableHead>}
                <TableHead className="text-right">السيرة</TableHead>
                <TableHead className="text-right">التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchedCandidates.slice(0, 50).map((c) => {
                const skills = getSkills(c.resume_skills);
                const certs = getCertifications(c.resume_skills);
                const summary = getSummary(c.resume_skills);
                const isExpanded = expandedCandidate === c.user_id;

                return (
                  <>
                    <TableRow key={c.user_id} className="cursor-pointer" onClick={() => setExpandedCandidate(isExpanded ? null : c.user_id)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{c.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.city}{c.nationality ? ` • ${c.nationality}` : ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.major || "—"}</TableCell>
                      <TableCell className="text-sm">{c.experience_years != null ? `${toArabicNumerals(c.experience_years)} سنوات` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {skills.slice(0, 3).map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {skills.length > 3 && <Badge variant="outline" className="text-xs">+{toArabicNumerals(skills.length - 3)}</Badge>}
                          {skills.length === 0 && <span className="text-xs text-muted-foreground">لا توجد</span>}
                        </div>
                      </TableCell>
                      {selectedVacancyData && (
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress
                              value={c.matchPercent}
                              className={`h-2 flex-1 ${c.matchPercent >= 70 ? "[&>div]:bg-success" : c.matchPercent >= 40 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"}`}
                            />
                            <span className="text-sm font-bold">{formatArabicPercent(c.matchPercent)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {c.resume_url ? (
                          <Badge variant="default" className="text-xs">مرفوعة</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">غير مرفوعة</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${c.user_id}-detail`}>
                        <TableCell colSpan={selectedVacancyData ? 7 : 6}>
                          <div className="p-4 space-y-4 bg-muted/30 rounded-xl">
                            {/* Summary */}
                            {summary && (
                              <div>
                                <p className="text-sm font-semibold text-foreground mb-1">الملخص</p>
                                <p className="text-sm text-muted-foreground">{summary}</p>
                              </div>
                            )}

                            {/* All Skills */}
                            <div>
                              <p className="text-sm font-semibold text-foreground mb-2">جميع المهارات</p>
                              <div className="flex flex-wrap gap-1.5">
                                {skills.length > 0 ? skills.map((s, i) => {
                                  const isMatched = selectedVacancyData &&
                                    (selectedVacancyData.requirements || []).some((r: any) => {
                                      const rText = (typeof r === "string" ? r : r.text || r.name || "").toLowerCase();
                                      return s.toLowerCase().includes(rText) || rText.includes(s.toLowerCase());
                                    });
                                  return (
                                    <Badge key={i} variant={isMatched ? "default" : "secondary"} className="text-xs">
                                      {isMatched && <Star className="w-3 h-3 ml-1" />}
                                      {s}
                                    </Badge>
                                  );
                                }) : <span className="text-sm text-muted-foreground">لم يتم استخراج مهارات بعد</span>}
                              </div>
                            </div>

                            {/* Certifications */}
                            {certs.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-foreground mb-2">الشهادات</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {certs.map((cert, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      <GraduationCap className="w-3 h-3 ml-1" />
                                      {cert}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Education & Experience */}
                            <div className="flex gap-6 text-sm">
                              {c.education_level && <span><strong>المؤهل:</strong> {c.education_level}</span>}
                              {c.experience_years != null && <span><strong>الخبرة:</strong> {toArabicNumerals(c.experience_years)} سنوات</span>}
                            </div>

                            {/* Link to applications */}
                            {applications.some((a) => a.user_id === c.user_id) && (
                              <div className="pt-2 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                  هذا المرشح قدّم على {toArabicNumerals(applications.filter((a) => a.user_id === c.user_id).length)} وظيفة
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {matchedCandidates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={selectedVacancyData ? 7 : 6} className="text-center text-muted-foreground py-8">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    لا توجد نتائج مطابقة
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Analytics */}
        <h3 className="text-xl font-bold text-foreground">تحليلات المهارات</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Skills */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">أكثر المهارات شيوعاً</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={skillChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", direction: "rtl" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="عدد المرشحين" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Education Distribution */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">توزيع المؤهلات</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={eduChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {eduChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
