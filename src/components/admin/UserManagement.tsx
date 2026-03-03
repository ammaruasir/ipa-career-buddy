import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Search, Trash2, Users, Loader2 } from "lucide-react";
import { toArabicNumerals } from "@/lib/arabic-utils";

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  created_at: string;
  role: string;
}

const roleLabels: Record<string, string> = {
  candidate: "مرشح",
  hr: "موارد بشرية",
  admin: "مدير",
  student: "طالب",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  hr: "default",
  candidate: "secondary",
  student: "outline",
};

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r) => {
      rolesMap[r.user_id] = r.role;
    });

    const merged: UserWithRole[] = (profilesRes.data || []).map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      created_at: p.created_at,
      role: rolesMap[p.user_id] || "candidate",
    }));

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChangeRole = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole as any })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "خطأ في تحديث الدور", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم تحديث الدور بنجاح" });
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u)));
    }
    setUpdatingUserId(null);
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    const { data, error } = await supabase.functions.invoke("manage-user", {
      body: { action: "delete", userId },
    });

    if (error || data?.error) {
      toast({ title: "خطأ في حذف المستخدم", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "تم حذف المستخدم بنجاح" });
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    }
    setDeletingUserId(null);
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(u.full_name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          إدارة المستخدمين ({toArabicNumerals(users.length)})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 rounded-xl"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <SelectValue placeholder="الدور" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="candidate">مرشح</SelectItem>
              <SelectItem value="hr">موارد بشرية</SelectItem>
              <SelectItem value="admin">مدير</SelectItem>
              <SelectItem value="student">طالب</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">تاريخ التسجيل</TableHead>
                  <TableHead className="text-right">تغيير الدور</TableHead>
                  <TableHead className="text-right">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[u.role] || "outline"}>
                        {roleLabels[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(val) => handleChangeRole(u.user_id, val)}
                        disabled={updatingUserId === u.user_id}
                      >
                        <SelectTrigger className="w-[130px] rounded-lg h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="candidate">مرشح</SelectItem>
                          <SelectItem value="hr">موارد بشرية</SelectItem>
                          <SelectItem value="admin">مدير</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingUserId === u.user_id}
                          >
                            {deletingUserId === u.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد حذف المستخدم</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف "{u.full_name || "مستخدم"}"؟ لا يمكن التراجع عن هذا الإجراء.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteUser(u.user_id)}
                            >
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      لا يوجد مستخدمون
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserManagement;
