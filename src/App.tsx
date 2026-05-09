import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ActivatedRoute } from "@/components/ActivatedRoute";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { ElectronShell } from "@/components/electron/ElectronShell";
import { BackButton } from "@/components/BackButton";

// Eager: lightweight landing + auth pages used on cold start.
import Index from "./pages/Index.tsx";
import GetStarted from "./pages/GetStarted.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy: heavy pages (studio uses Decart SDK ~MBs, admin/dashboard rarely used
// on first paint). Splitting these keeps the initial bundle small so the
// Electron window paints instantly.
const AppPage = lazy(() => import("./pages/App.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Activate = lazy(() => import("./pages/Activate.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const AdminWebhookLogs = lazy(() => import("./pages/AdminWebhookLogs.tsx"));
const Credits = lazy(() => import("./pages/Credits.tsx"));
const Reset = lazy(() => import("./pages/Reset.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center bg-background">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <AuthProvider>
          <ElectronShell>
          <BackButton />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/get-started" element={<GetStarted />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/activate" element={<ProtectedRoute><Activate /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ActivatedRoute><Dashboard /></ActivatedRoute>} />
            <Route path="/app" element={<ActivatedRoute><AppPage /></ActivatedRoute>} />
            <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/webhook-logs" element={<AdminRoute><AdminWebhookLogs /></AdminRoute>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ElectronShell>
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
