import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TitleBar } from "./TitleBar";
import { TermsGate, hasAcceptedTerms } from "./TermsGate";
import { useAuth } from "@/hooks/useAuth";
import logoMark from "@/assets/facelume-mark.png";

const isElectron = () =>
  typeof window !== "undefined" && Boolean((window as any).facelume?.isElectron);

// Hard cap on splash visibility — UI must appear within this budget no matter
// what auth/profile/SDK bootstrapping is still doing in the background.
const SPLASH_MAX_MS = 2000;

const STAGES = [
  { at: 0, label: "Loading UI" },
  { at: 600, label: "Connecting services" },
  { at: 1300, label: "Preparing AI engine" },
] as const;

/**
 * Wraps the app when running inside Electron:
 *  - native-feeling custom title bar
 *  - launch loading splash (≤2s, non-blocking)
 *  - disables the browser context menu
 *
 * In a regular browser, renders children unchanged.
 */
export const ElectronShell = ({ children }: { children: ReactNode }) => {
  const electron = isElectron();
  const [loading, setLoading] = useState(electron);
  const [stage, setStage] = useState<string>(STAGES[0].label);
  const [termsAccepted, setTermsAccepted] = useState(() =>
    electron ? hasAcceptedTerms() : true,
  );
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  // In Electron, terms gate appears AFTER sign-in but BEFORE the studio.
  const showTerms = electron && !!user && !termsAccepted;

  // Desktop-first routing: enforce login → terms → activation → studio.
  // Only runs inside Electron; the web app keeps its landing + public routes.
  useEffect(() => {
    if (!electron) return;
    if (authLoading) return;

    const AUTH_PATHS = ["/get-started", "/auth", "/reset-password"];
    const isAuthPath = AUTH_PATHS.includes(pathname);

    if (!user) {
      if (!isAuthPath) navigate("/get-started", { replace: true });
      return;
    }
    if (!profile) return;

    const activated = profile.is_activated || profile.is_admin;

    if (isAuthPath || pathname === "/" || pathname === "/dashboard") {
      navigate(activated ? "/app" : "/activate", { replace: true });
      return;
    }
    if (!activated && pathname === "/app") {
      navigate("/activate", { replace: true });
    }
  }, [electron, authLoading, user, profile, pathname, navigate]);

  useEffect(() => {
    if (!electron) return;
    // Suppress right-click context menu globally inside the desktop app.
    const onCtx = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onCtx);
    return () => window.removeEventListener("contextmenu", onCtx);
  }, [electron]);

  // Splash budget: drive staged messages and force-hide at SPLASH_MAX_MS.
  // We never wait for auth/profile/SDK — the underlying UI renders behind
  // the splash and is fully interactive the moment it lifts.
  useEffect(() => {
    if (!electron || !loading) return;
    const start = performance.now();
    const stageTimers = STAGES.map((s) =>
      window.setTimeout(() => setStage(s.label), s.at),
    );
    const hide = window.setTimeout(() => setLoading(false), SPLASH_MAX_MS);
    // If auth resolves quickly AND we're already on the destination route,
    // lift the splash sooner for a snappier feel.
    const earlyCheck = window.setInterval(() => {
      if (authLoading) return;
      // Need at least 400ms so the brand mark is perceptible.
      if (performance.now() - start < 400) return;
      setLoading(false);
      window.clearInterval(earlyCheck);
    }, 100);
    return () => {
      stageTimers.forEach(clearTimeout);
      clearTimeout(hide);
      clearInterval(earlyCheck);
    };
  }, [electron, loading, authLoading]);


  // Tag <body> when on the studio route (web OR Electron) so global CSS
  // can disable page scroll while the studio uses its own sidebar layout.
  useEffect(() => {
    const onStudio = pathname === "/app";
    if (onStudio) document.body.setAttribute("data-studio-active", "true");
    else document.body.removeAttribute("data-studio-active");
    return () => document.body.removeAttribute("data-studio-active");
  }, [pathname]);

  if (!electron) return <>{children}</>;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex-1 min-h-0 overflow-auto relative">
        {children}
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background animate-in fade-in duration-150">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary blur-3xl opacity-70 rounded-full" />
              <img
                src={logoMark}
                alt="FaceLume"
                width={96}
                height={96}
                className="relative w-24 h-24 object-contain drop-shadow-[0_0_24px_hsl(var(--primary)/0.8)]"
              />
            </div>
            <div className="font-display font-black text-2xl tracking-[0.3em]">
              FACE<span className="neon-text">LUME</span>
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>{stage}</span>
            </div>
          </div>
        )}
        {showTerms && !loading && (
          <TermsGate onAccept={() => setTermsAccepted(true)} />
        )}
      </div>
    </div>
  );
};
