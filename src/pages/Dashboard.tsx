import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Zap, Crown, Activity, Play, ArrowUpRight, Settings, Clock, KeyRound, Lock, Loader2 } from "lucide-react";

const Dashboard = () => {
  const { profile, user, loading } = useAuth();
  const navigate = useNavigate();
  const name = profile?.display_name || user?.email?.split("@")[0] || "Streamer";
  const credits = profile?.credits ?? 0;
  const minutes = Math.floor(credits / 120); // 2 credits/sec × 60s = 120 credits/min
  const plan = profile?.plan || "starter";
  const isActivated = !!profile?.is_activated || !!profile?.is_admin;

  const [activation, setActivation] = useState<{ device_id: string; access_key: string; paid: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/get-started", { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("activations")
        .select("device_id, access_key, paid")
        .eq("user_id", user.id)
        .order("activated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActivation(data);
    })();
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <title>Dashboard — FaceLume</title>
      <meta name="description" content="Your FaceLume control center: credits, plan, and quick access to the streaming studio." />

      <div className="min-h-screen relative">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-3xl rounded-full pointer-events-none" />

        <main className="relative pt-28 pb-16 container">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-sm font-mono text-muted-foreground tracking-widest uppercase mb-2">Welcome back</p>
              <h1 className="font-display font-black text-4xl md:text-5xl">
                Hello, <span className="neon-text">{name}</span>
              </h1>
            </div>
            {isActivated ? (
              <Link to="/app">
                <Button variant="hero" size="lg">
                  <Play /> Launch Studio
                </Button>
              </Link>
            ) : (
              <Link to="/activate">
                <Button variant="hero" size="lg">
                  <Lock /> Activate account
                </Button>
              </Link>
            )}
          </div>

          {/* Activation banner */}
          {!isActivated && (
            <div className="relative mb-10">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary-glow opacity-40 blur-md rounded-2xl" />
              <div className="relative glass-strong rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/15 border border-primary/30">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg mb-1">Activate your account</h2>
                    <p className="text-sm text-muted-foreground">
                      Pay the one-time fee to unlock the studio and receive 1,200 starter credits.
                    </p>
                  </div>
                </div>
                <Link to="/activate">
                  <Button variant="hero">Activate now</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            <StatCard
              icon={Zap}
              label="Credits"
              value={credits.toLocaleString()}
              hint={`${credits.toLocaleString()} credits remaining`}
              accent="primary"
            />
            <StatCard
              icon={Crown}
              label="Current plan"
              value={plan.toUpperCase()}
              hint="Manage subscription"
              accent="secondary"
            />
            <StatCard
              icon={Activity}
              label="Sessions"
              value="0"
              hint="This month"
              accent="accent"
            />
          </div>

          {/* Quick actions */}
          <div className="grid lg:grid-cols-3 gap-5 mb-10">
            <ActionCard
              to={isActivated ? "/app" : "/activate"}
              icon={isActivated ? Sparkles : Lock}
              title={isActivated ? "Start a session" : "Activate account"}
              description={
                isActivated
                  ? "Open the live AI transformation studio and go live in seconds."
                  : "Complete the one-time activation to unlock the studio."
              }
              cta={isActivated ? "Open studio" : "Activate now"}
            />
            <ActionCard
              to="/#pricing"
              icon={ArrowUpRight}
              title="Upgrade plan"
              description="Unlock more credits, higher resolution, and priority GPU lanes."
              cta="See plans"
            />
            <ActionCard
              to="#"
              icon={Settings}
              title="Account settings"
              description="Update your display name, avatar, and security preferences."
              cta="Coming soon"
              disabled
            />
          </div>

          {/* License */}
          {activation?.paid && (
            <div className="glass-strong rounded-2xl p-6 mb-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/15 border border-primary/30">
                    <KeyRound className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg mb-1">Desktop license active</h2>
                    <p className="text-xs text-muted-foreground font-mono">
                      Device <span className="text-foreground">{activation.device_id}</span>
                    </p>
                  </div>
                </div>
                <code className="font-mono text-sm text-primary-glow bg-background/60 rounded-lg px-3 py-2 border border-border/60 break-all">
                  {activation.access_key}
                </code>
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-xl flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Recent Activity
              </h2>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-mono text-sm tracking-widest uppercase mb-2">No sessions yet</p>
              <p className="text-sm">Launch the studio to start your first transformation.</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

const StatCard = ({ icon: Icon, label, value, hint, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; accent: "primary" | "secondary" | "accent";
}) => {
  const ring = accent === "primary" ? "from-primary to-primary-glow" : accent === "secondary" ? "from-secondary to-accent" : "from-accent to-primary";
  return (
    <div className="relative group">
      <div className={`absolute -inset-0.5 bg-gradient-to-br ${ring} opacity-30 blur-md rounded-2xl group-hover:opacity-60 transition-opacity`} />
      <div className="relative glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
          <Icon className={`w-5 h-5 ${accent === "primary" ? "text-primary" : accent === "secondary" ? "text-secondary" : "text-accent"}`} />
        </div>
        <div className="font-display font-black text-3xl mb-1">{value}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
};

const ActionCard = ({ to, icon: Icon, title, description, cta, disabled }: {
  to: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; cta: string; disabled?: boolean;
}) => {
  const content = (
    <div className={`glass rounded-2xl p-6 h-full transition-all ${disabled ? "opacity-60" : "hover:border-primary/50 hover:-translate-y-0.5 cursor-pointer"}`}>
      <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <span className="text-xs font-mono uppercase tracking-widest text-primary-glow inline-flex items-center gap-1">
        {cta} <ArrowUpRight className="w-3 h-3" />
      </span>
    </div>
  );
  if (disabled) return content;
  return <Link to={to}>{content}</Link>;
};

export default Dashboard;
