import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const DashboardRouter = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    // Wait until role is resolved (non-null) before routing
    if (role === null) return;
    
    if (role === "admin" || role === "hr") {
      navigate("/dashboard/admin", { replace: true });
    } else {
      navigate("/dashboard/candidate", { replace: true });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default DashboardRouter;
