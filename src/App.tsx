import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import DashboardRouter from "./pages/DashboardRouter";
import CandidateDashboard from "./pages/CandidateDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateDetail from "./pages/CandidateDetail";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Retry wrapper for lazy imports to handle stale chunk errors
const lazyRetry = (importFn: () => Promise<any>, retries = 3): ReturnType<typeof lazy> =>
  lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        if (i === retries - 1) {
          // Last retry failed - force reload to get fresh chunks
          window.location.reload();
          throw error;
        }
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw new Error("Failed to load module");
  });

// Lazy load interview pages (heavy media components)
const TextInterview = lazyRetry(() => import("./pages/TextInterview"));
const VoiceInterview = lazyRetry(() => import("./pages/VoiceInterview"));
const VideoInterview = lazyRetry(() => import("./pages/VideoInterview"));
const InterviewResults = lazyRetry(() => import("./pages/InterviewResults"));
const JobVacancies = lazyRetry(() => import("./pages/JobVacancies"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const ProfileSettings = lazyRetry(() => import("./pages/ProfileSettings"));
const InterviewSettings = lazyRetry(() => import("./pages/InterviewSettings"));
const AdminSettings = lazyRetry(() => import("./pages/AdminSettings"));

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/dashboard/candidate" element={<CandidateDashboard />} />
              <Route path="/dashboard/admin" element={<AdminDashboard />} />
              <Route path="/dashboard/admin/candidate/:id" element={<CandidateDetail />} />
              <Route path="/jobs" element={<JobVacancies />} />
              <Route path="/interview/text" element={<TextInterview />} />
              <Route path="/interview/voice" element={<VoiceInterview />} />
              <Route path="/interview/video" element={<VideoInterview />} />
              <Route path="/interview/:id/results" element={<InterviewResults />} />
              <Route path="/settings/profile" element={<ProfileSettings />} />
              <Route path="/settings/interview" element={<InterviewSettings />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
