import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import DashboardRouter from "./pages/DashboardRouter";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateDetail from "./pages/CandidateDetail";
import NotFound from "./pages/NotFound";

// Lazy load interview pages (heavy media components)
const TextInterview = lazy(() => import("./pages/TextInterview"));
const VoiceInterview = lazy(() => import("./pages/VoiceInterview"));
const VideoInterview = lazy(() => import("./pages/VideoInterview"));
const InterviewResults = lazy(() => import("./pages/InterviewResults"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const InterviewSettings = lazy(() => import("./pages/InterviewSettings"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));

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
              <Route path="/dashboard/student" element={<StudentDashboard />} />
              <Route path="/dashboard/admin" element={<AdminDashboard />} />
              <Route path="/dashboard/admin/candidate/:id" element={<CandidateDetail />} />
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
