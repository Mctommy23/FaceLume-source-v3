import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const ActivatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary drop-shadow-[0_0_12px_hsl(var(--primary))]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/get-started" state={{ from: location }} replace />;
  }

  // Admins bypass the activation gate — they get full access without activating.
  if (!profile?.is_activated && !profile?.is_admin) {
    return <Navigate to="/activate" replace />;
  }

  return <>{children}</>;
};
