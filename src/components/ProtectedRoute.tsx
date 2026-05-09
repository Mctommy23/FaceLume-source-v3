import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary drop-shadow-[0_0_12px_hsl(var(--primary))]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/get-started" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
