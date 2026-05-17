import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const DashboardRouter = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (role === null) return;

    // For candidates, check if profile is completed
    if (role === "candidate") {
      supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data && !(data as any).profile_completed) {
            navigate("/complete-profile", { replace: true });
          } else {
            navigate("/dashboard/candidate", { replace: true });
          }
          setChecking(false);
        });
    } else if (role === "hr") {
      navigate("/dashboard/hr", { replace: true });
      setChecking(false);
    } else if (role === "instructor") {
      navigate("/dashboard/instructor", { replace: true });
      setChecking(false);
    } else {
      navigate("/dashboard/admin", { replace: true });
      setChecking(false);
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default DashboardRouter;
