import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Search, Eye, Pencil, Trash2, Loader2, Download, Shield,
} from "lucide-react";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد الانتظار", variant: "outline" },
  in_progress: { label: "جارية", variant: "secondary" },
  completed: { label: "مكتملة", variant: "default" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};
const typeLabels: Record<string, string> = { text: "نصية", voice: "صوتية", video: "فيديو" };

const AdminInterviews = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [interviews, setInterviews] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ job_position: "", type: "text", status: "pending" });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const [iRes, pRes, eRes] = await Promise.all([
      supabase.from("interviews").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("evaluations").select("interview_id, overall_score"),
    ]);
    setInterviews(iRes.data || []);
    setProfiles(pRes.data || []);
    setEvaluations(eRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "admin") { navigate("/dashboard"); return; }
    if (user && role === "admin") load();
  }, [user, role, authLoading, navigate]);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const evalMap = Object.fromEntries(evaluations.map((e) => [e.interview_id, e]));

  const filtered = interviews.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (search) {
      const name = profileMap[i.user_id]?.full_name || "";
      const q = search.toLowerCase();
      if (!name.toLowerCase().includes(q) && !(i.job_position || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((i) => next.delete(i.id));
    else filtered.forEach((i) => next.add(i.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const openEdit = (iv: any) => {
    setEditTarget(iv);
    setEditForm({ job_position: iv.job_position || "", type: iv.type, status: iv.status });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-interview", {
      body: { action: "update", id: editTarget.id, updates: editForm },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error("فشل التعديل: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success("تم التحديث");
    setEditTarget(null);
    load();
  };

  const doDelete = async (id: string) => {
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("admin-interview", {
      body: { action: "delete", id },
    });
    setWorking(false);
    if (error || (data as any)?.error) {
      toast.error("فشل الحذف: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success("تم حذف المقابلة");
    setDeleteTarget(null);
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    load();
  };

  const doBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("admin-interview", {
      body: { action: "bulk_delete", ids },
    });
    setWorking(false);
    if (error || (data as any)?.error) {
      toast.error("فشل الحذف: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success(`تم حذف ${ids.length} مقابلة`);
    setSelected(new Set());
    setBulkDeleteOpen(false);
    load();
  };

  const exportCSV = () => {
    const rows = [
      ["الاسم", "المنصب", "النوع", "الحالة", "الدرجة", "التاريخ"],
      ...filtered.map((i) => [
        profileMap[i.user_id]?.full_name || "",
        i.job_position || "",
        typeLabels[i.type] || i.type,
        statusMap[i.status]?.label || i.status,
        evalMap[i.id]?.overall_score ?? "",
        new Date(i.created_at).toLocaleString("ar-SA"),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interviews-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">إدارة المقابلات</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/admin">
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة للوحة
            </Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو المنصب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="in_progress">جارية</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="text">نصية</SelectItem>
              <SelectItem value="voice">صوتية</SelectItem>
              <SelectItem value="video">فيديو</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-xl" onClick={exportCSV}>
            <Download className="w-4 h-4 ml-2" />
            تصدير CSV
          </Button>
          <Button
            variant="destructive"
            className="rounded-xl"
            disabled={selected.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4 ml-2" />
            حذف المحدد ({selected.size})
          </Button>
        </div>

        <Card className="rounded-2xl shadow-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">المنصب</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الدرجة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((iv) => {
                const p = profileMap[iv.user_id];
                const ev = evalMap[iv.id];
                const st = statusMap[iv.status] || statusMap.pending;
                return (
                  <TableRow key={iv.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(iv.id)} onCheckedChange={() => toggleOne(iv.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                    <TableCell>{iv.job_position}</TableCell>
                    <TableCell>{typeLabels[iv.type] || iv.type}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>{ev ? `${ev.overall_score}%` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(iv.created_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                          <Link to={`/dashboard/admin/candidate/${iv.id}`}><Eye className="w-4 h-4" /></Link>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(iv)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(iv.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد نتائج</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>تعديل المقابلة</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">المنصب الوظيفي</label>
              <Input
                value={editForm.job_position}
                onChange={(e) => setEditForm({ ...editForm, job_position: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">النوع</label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">نصية</SelectItem>
                  <SelectItem value="voice">صوتية</SelectItem>
                  <SelectItem value="video">فيديو</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">الحالة</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="in_progress">جارية</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المقابلة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المقابلة وجميع البيانات المرتبطة بها (الردود، التقييم، الملاحظات، أحداث المراقبة). لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && doDelete(deleteTarget)}
              disabled={working}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف {selected.size} مقابلة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع المقابلات المحددة وبياناتها المرتبطة. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={doBulkDelete}
              disabled={working}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminInterviews;
