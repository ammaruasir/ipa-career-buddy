import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toArabicNumerals, formatArabicPercent } from "@/lib/arabic-utils";
import { ArrowRight, Loader2, Users } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--warning))", "hsl(var(--destructive))"];

interface CandidateEval {
  id: string;
  user_id: string;
  full_name: string;
  interview_id: string;
  job_position: string;
  overall_score: number;
  communication_score: number;
  technical_score: number;
  personality_match: number;
  confidence_score: number;
  recommendation: string;
  personality_type: string;
}

const CandidateCompare = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [candidates, setCandidates] = useState<CandidateEval[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "hr" && role !== "admin") { navigate("/dashboard"); return; }
    if (!user || !role) return;

    const load = async () => {
      const { data: vacs } = await supabase.from("job_vacancies").select("*").order("created_at", { ascending: false });
      setVacancies(vacs || []);
      setLoading(false);
    };
    load();
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!selectedVacancy) { setCandidates([]); return; }
    const load = async () => {
      // Get applications for this vacancy
      const { data: apps } = await supabase
        .from("job_applications")
        .select("user_id, interview_id")
        .eq("vacancy_id", selectedVacancy);
      if (!apps || apps.length === 0) { setCandidates([]); return; }

      const interviewIds = apps.filter((a: any) => a.interview_id).map((a: any) => a.interview_id);
      if (interviewIds.length === 0) { setCandidates([]); return; }

      const [evRes, ivRes, profRes] = await Promise.all([
        supabase.from("evaluations").select("*").in("interview_id", interviewIds),
        supabase.from("interviews").select("id, user_id, job_position").in("id", interviewIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", apps.map((a: any) => a.user_id)),
      ]);

      const interviews = ivRes.data || [];
      const profiles: Record<string, string> = {};
      (profRes.data || []).forEach((p: any) => { profiles[p.user_id] = p.full_name || "مرشح"; });

      const merged: CandidateEval[] = (evRes.data || []).map((ev: any) => {
        const iv = interviews.find((i: any) => i.id === ev.interview_id);
        return {
          id: ev.id,
          user_id: iv?.user_id || "",
          full_name: profiles[iv?.user_id || ""] || "مرشح",
          interview_id: ev.interview_id,
          job_position: iv?.job_position || "",
          overall_score: ev.overall_score || 0,
          communication_score: ev.communication_score || 0,
          technical_score: ev.technical_score || 0,
          personality_match: ev.personality_match || 0,
          confidence_score: ev.confidence_score || 0,
          recommendation: ev.recommendation || "",
          personality_type: ev.personality_type || "",
        };
      });
      setCandidates(merged);
      setSelectedIds([]);
    };
    load();
  }, [selectedVacancy]);

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const selected = candidates.filter((c) => selectedIds.includes(c.id));

  const radarData = [
    { metric: "التواصل", ...Object.fromEntries(selected.map((c, i) => [`c${i}`, c.communication_score])) },
    { metric: "التقنية", ...Object.fromEntries(selected.map((c, i) => [`c${i}`, c.technical_score])) },
    { metric: "الشخصية", ...Object.fromEntries(selected.map((c, i) => [`c${i}`, c.personality_match])) },
    { metric: "الثقة", ...Object.fromEntries(selected.map((c, i) => [`c${i}`, c.confidence_score])) },
    { metric: "الإجمالي", ...Object.fromEntries(selected.map((c, i) => [`c${i}`, c.overall_score])) },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/hr")} className="rounded-xl">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">مقارنة المرشحين</h2>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Vacancy Selection */}
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-3">اختر الوظيفة لعرض المرشحين المتاحين للمقارنة:</p>
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="rounded-xl max-w-md">
                <SelectValue placeholder="اختر وظيفة" />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.title} — {v.department || ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Candidates List */}
        {candidates.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">اختر ٢-٤ مرشحين للمقارنة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      selectedIds.includes(c.id)
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/30"
                    }`}
                    onClick={() => toggleCandidate(c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedIds.includes(c.id)} />
                      <div>
                        <p className="font-semibold text-foreground">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          الدرجة: {formatArabicPercent(c.overall_score)} — {c.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {candidates.length === 0 && selectedVacancy && (
          <p className="text-center text-muted-foreground py-12">لا يوجد مرشحون بتقييمات لهذه الوظيفة</p>
        )}

        {/* Comparison */}
        {selected.length >= 2 && (
          <>
            {/* Radar Chart */}
            <Card className="rounded-2xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-base">مقارنة بصرية</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {selected.map((c, i) => (
                      <Radar
                        key={c.id}
                        name={c.full_name}
                        dataKey={`c${i}`}
                        stroke={COLORS[i]}
                        fill={COLORS[i]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Comparison Table */}
            <Card className="rounded-2xl shadow-lg overflow-x-auto">
              <CardHeader>
                <CardTitle className="text-base">جدول المقارنة</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right p-3 text-muted-foreground">المعيار</th>
                      {selected.map((c, i) => (
                        <th key={c.id} className="text-center p-3" style={{ color: COLORS[i] }}>
                          {c.full_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "الدرجة الكلية", key: "overall_score" },
                      { label: "التواصل", key: "communication_score" },
                      { label: "الكفاءة التقنية", key: "technical_score" },
                      { label: "التوافق الثقافي", key: "personality_match" },
                      { label: "الثقة", key: "confidence_score" },
                    ].map((row) => (
                      <tr key={row.key} className="border-b border-border/50">
                        <td className="p-3 text-foreground font-medium">{row.label}</td>
                        {selected.map((c) => {
                          const val = (c as any)[row.key] || 0;
                          const best = Math.max(...selected.map((s) => (s as any)[row.key] || 0));
                          return (
                            <td key={c.id} className="text-center p-3">
                              <span className={`font-bold ${val === best ? "text-success" : "text-foreground"}`}>
                                {formatArabicPercent(val)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-b border-border/50">
                      <td className="p-3 text-foreground font-medium">نوع الشخصية</td>
                      {selected.map((c) => (
                        <td key={c.id} className="text-center p-3">
                          <Badge variant="outline">{c.personality_type || "—"}</Badge>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 text-foreground font-medium">التوصية</td>
                      {selected.map((c) => (
                        <td key={c.id} className="text-center p-3">
                          <Badge variant={c.recommendation?.includes("غير") ? "destructive" : "default"}>
                            {c.recommendation || "—"}
                          </Badge>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default CandidateCompare;
