import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Global floating Back button. Visible on every page except:
 *  - the landing page ("/")
 *  - the initial auth entry ("/get-started") where there's nowhere to go back to
 *
 * Behavior:
 *  - If there's in-app history, goes back one step.
 *  - Otherwise falls back to a sensible default based on auth state
 *    (activated users → /app, signed-in users → /dashboard, else → /).
 */
export const BackButton = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const [entryLength] = useState<number>(() =>
    typeof window !== "undefined" ? window.history.length : 1
  );

  // Hide on routes where "back" is meaningless or has its own exit UI.
  const HIDDEN_ROUTES = ["/", "/get-started", "/reset-password", "/app"];
  if (HIDDEN_ROUTES.includes(pathname)) return null;

  const handleBack = () => {
    // If we navigated within the app, history length will have grown
    // beyond what it was when this component first mounted.
    if (window.history.length > entryLength) {
      navigate(-1);
      return;
    }
    // Fallback: pick a reasonable home for the user's auth state.
    if (profile?.is_activated || profile?.is_admin) navigate("/app");
    else if (user) navigate("/dashboard");
    else navigate("/");
  };

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="fixed top-4 left-4 z-[60] flex items-center gap-2 rounded-full px-3 py-2 glass border border-border/50 backdrop-blur-xl text-sm font-medium text-foreground/90 hover:text-foreground hover:border-primary/50 hover:shadow-[0_0_16px_hsl(var(--primary)/0.4)] transition-all"
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
};
