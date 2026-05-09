import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TopUpModal } from "@/components/TopUpModal";
import { BADGE_LABEL, CREDIT_PLANS, formatMinutes } from "@/lib/creditPlans";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const Credits = () => {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <title>Buy Streaming Time — FaceLume</title>
      <meta
        name="description"
        content="Top up your FaceLume streaming time. Pay with crypto via Atlos. Time never expires."
      />

      <div className="min-h-screen relative">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

        <main className="relative pt-28 pb-16 container max-w-6xl">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>

          <div className="text-center mb-10">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-accent mb-3">
              Top up
            </p>
            <h1 className="font-display font-black text-4xl md:text-5xl mb-3">
              Buy <span className="neon-text">streaming time</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Pick a plan and stream live in real time. Time never expires — top up whenever you need more.
            </p>
            {profile && (
              <p className="mt-4 text-sm font-mono">
                Current balance:{" "}
                <span className="text-primary-glow font-bold">
                  {profile.credits.toLocaleString()} credits
                </span>
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CREDIT_PLANS.map((plan) => {
              const highlight = plan.badge === "popular";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative rounded-2xl p-6 flex flex-col transition-all hover:-translate-y-1",
                    highlight
                      ? "glass-strong border-primary/50 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.6)]"
                      : "glass hover:border-primary/30",
                  )}
                >
                  {plan.badge && (
                    <span
                      className={cn(
                        "absolute -top-3 right-6 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] rounded-md font-bold",
                        plan.badge === "popular"
                          ? "bg-gradient-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {BADGE_LABEL[plan.badge]}
                    </span>
                  )}

                  <div className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">
                    {plan.name}
                  </div>

                  <div className="flex items-end gap-2 mb-4">
                    <span
                      className={cn(
                        "font-display font-black text-5xl leading-none",
                        highlight ? "neon-text" : "text-foreground",
                      )}
                    >
                      ${plan.amountUsd}
                    </span>
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground pb-2">
                      USD
                    </span>
                  </div>

                  <div className="text-secondary font-semibold text-lg">
                    {plan.timeLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mb-6">
                    (includes {plan.credits.toLocaleString()} credits)
                  </div>

                  <Button
                    variant={highlight ? "hero" : "glass"}
                    className="w-full mt-auto font-mono uppercase tracking-[0.2em] text-xs"
                    onClick={() => setOpen(true)}
                  >
                    <Sparkles /> Buy now
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Streaming time is deducted in real time during your live session. Internally, 1 credit = 1 second.
          </p>
        </main>
      </div>

      <TopUpModal open={open} onOpenChange={setOpen} onCredited={refreshProfile} />
    </>
  );
};

export default Credits;
