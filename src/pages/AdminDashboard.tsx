import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toArabicNumerals, formatArabicPercent } from "@/lib/arabic-utils";
import {
  Users, Calendar, TrendingUp, Award, LogOut, Shield,
  Search, Eye, Loader2, Radio, Settings,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد الانتظار", variant: "outline" },
  in_progress: { label: "جارية", variant: "secondary" },
  completed: { label: "مكتملة", variant: "default" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

const typeLabels: Record<string, string> = { text: "نصية", voice: "صوتية", video: "فيديو" };

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
];

const AdminDashboard = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [hrNotes, setHrNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "admin" && role !== "hr") { navigate("/dashboard/candidate"); return; }
    if (!user || !role) return;

    const load = async () => {
      const [iRes, eRes, pRes, nRes] = await Promise.all([
        supabase.from("interviews").select("*").order("created_at", { ascending: false }),
        supabase.from("evaluations").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("hr_notes").select("*"),
      ]);
      setInterviews(iRes.data || []);
      setEvaluations(eRes.data || []);
      setProfiles(pRes.data || []);
      setHrNotes(nRes.data || []);
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

  // Stats
  const uniqueCandidates = new Set(interviews.map((i) => i.user_id)).size;
  const today = new Date().toISOString().split("T")[0];
  const interviewsToday = interviews.filter((i) => i.created_at.startsWith(today)).length;
  const acceptedCount = hrNotes.filter((n) => n.action === "accepted").length;
  const totalActions = hrNotes.filter((n) => ["accepted", "rejected"].includes(n.action)).length;
  const acceptRate = totalActions > 0 ? Math.round((acceptedCount / totalActions) * 100) : 0;
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((s, e) => s + (e.overall_score || 0), 0) / evaluations.length)
    : 0;

  // Live monitoring
  const liveInterviews = interviews.filter((i) => i.status === "in_progress");

  // Filtered table
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const evalMap = Object.fromEntries(evaluations.map((e) => [e.interview_id, e]));

  const filteredInterviews = interviews.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (searchQuery) {
      const name = profileMap[i.user_id]?.full_name || "";
      const pos = i.job_position || "";
      const q = searchQuery.toLowerCase();
      if (!name.toLowerCase().includes(q) && !pos.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Charts data
  const scoreBuckets = [
    { range: "0-20", count: 0 }, { range: "21-40", count: 0 },
    { range: "41-60", count: 0 }, { range: "61-80", count: 0 }, { range: "81-100", count: 0 },
  ];
  evaluations.forEach((e) => {
    const s = e.overall_score || 0;
    if (s <= 20) scoreBuckets[0].count++;
    else if (s <= 40) scoreBuckets[1].count++;
    else if (s <= 60) scoreBuckets[2].count++;
    else if (s <= 80) scoreBuckets[3].count++;
    else scoreBuckets[4].count++;
  });

  const typeCounts = Object.entries(
    interviews.reduce((acc: Record<string, number>, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ name: typeLabels[type] || type, value: count as number }));

  // Daily volume (last 30 days)
  const dailyVolume: Record<string, number> = {};
  const now = new Date();
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    dailyVolume[date.toISOString().split("T")[0]] = 0;
  }
  interviews.forEach((i) => {
    const day = i.created_at.split("T")[0];
    if (dailyVolume[day] !== undefined) dailyVolume[day]++;
  });
  const dailyData = Object.entries(dailyVolume).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  // Radar
  const radarData = [
    { subject: "التواصل", value: evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.communication_score || 0), 0) / evaluations.length) : 0 },
    { subject: "تقني", value: evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.technical_score || 0), 0) / evaluations.length) : 0 },
    { subject: "ثقافي", value: evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.personality_match || 0), 0) / evaluations.length) : 0 },
    { subject: "الثقة", value: evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.confidence_score || 0), 0) / evaluations.length) : 0 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">لوحة الإدارة</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/settings">
                <Settings className="w-4 h-4 ml-1" />
                إعدادات النظام
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="w-4 h-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "إجمالي المرشحين", value: toArabicNumerals(uniqueCandidates), color: "bg-primary/10 text-primary" },
            { icon: Calendar, label: "مقابلات اليوم", value: toArabicNumerals(interviewsToday), color: "bg-secondary/10 text-secondary" },
            { icon: Award, label: "نسبة القبول", value: formatArabicPercent(acceptRate), color: "bg-success/10 text-success" },
            { icon: TrendingUp, label: "متوسط الدرجات", value: formatArabicPercent(avgScore), color: "bg-warning/10 text-warning" },
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

        {/* Live Monitoring */}
        {liveInterviews.length > 0 && (
          <Card className="rounded-2xl shadow-lg border-secondary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="w-5 h-5 text-destructive animate-pulse" />
                المقابلات الجارية الآن ({liveInterviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {liveInterviews.map((iv) => (
                  <div key={iv.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="font-medium text-foreground">{profileMap[iv.user_id]?.full_name || "مرشح"}</span>
                      <span className="text-sm text-muted-foreground">— {iv.job_position}</span>
                    </div>
                    <Badge variant="secondary">{typeLabels[iv.type] || iv.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو المنصب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] rounded-xl"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="in_progress">جارية</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px] rounded-xl"><SelectValue placeholder="النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="text">نصية</SelectItem>
              <SelectItem value="voice">صوتية</SelectItem>
              <SelectItem value="video">فيديو</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Candidates Table */}
        <Card className="rounded-2xl shadow-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">المنصب</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">الدرجة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInterviews.slice(0, 50).map((iv) => {
                const p = profileMap[iv.user_id];
                const ev = evalMap[iv.id];
                const st = statusMap[iv.status] || statusMap.pending;
                return (
                  <TableRow key={iv.id}>
                    <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                    <TableCell>{iv.job_position}</TableCell>
                    <TableCell>{typeLabels[iv.type] || iv.type}</TableCell>
                    <TableCell>{ev ? `${ev.overall_score}%` : "—"}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="rounded-xl" asChild>
                        <Link to={`/dashboard/admin/candidate/${iv.id}`}>
                          <Eye className="w-4 h-4 ml-1" />
                          عرض
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredInterviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد نتائج</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Analytics */}
        <h3 className="text-xl font-bold text-foreground">التحليلات</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Distribution */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">توزيع الدرجات</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={scoreBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", direction: "rtl" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="العدد" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Interview Types */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">أنواع المقابلات</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={typeCounts} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {typeCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily Volume */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">حجم المقابلات اليومي</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", direction: "rtl" }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--secondary))" strokeWidth={2} name="المقابلات" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Skills Radar */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">متوسط المهارات</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <PolarRadiusAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="المتوسط" />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
