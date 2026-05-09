import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BADGE_LABEL, CREDIT_PLANS } from "@/lib/creditPlans";
import { cn } from "@/lib/utils";

export const Pricing = () => {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="container relative">
        <div className="text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-accent mb-5">
            Streaming Time Plans
          </p>
          <h2 className="font-display font-black text-4xl md:text-6xl leading-[1.05] text-balance max-w-4xl mx-auto">
            PAY FOR TIME. <span className="neon-text">STREAM IN REAL TIME.</span>
          </h2>
          <p className="mt-6 text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
            Pick how long you want to stream. Time never expires — top up whenever you need more.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {CREDIT_PLANS.map((plan) => {
            const highlight = plan.badge === "popular";
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-2xl p-6 md:p-7 flex flex-col transition-all duration-300 hover:-translate-y-1",
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
                        ? "bg-gradient-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.6)]"
                        : "bg-secondary text-secondary-foreground shadow-[0_0_20px_hsl(var(--secondary)/0.6)]",
                    )}
                  >
                    {BADGE_LABEL[plan.badge]}
                  </span>
                )}

                <div className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-6">
                  {plan.name}
                </div>

                <div className="flex items-end gap-2 mb-5">
                  <span
                    className={cn(
                      "font-display font-black text-5xl md:text-6xl leading-none",
                      highlight ? "neon-text" : "text-foreground",
                    )}
                  >
                    ${plan.amountUsd}
                  </span>
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground pb-2">
                    USD
                  </span>
                </div>

                <div className="mb-1">
                  <div className="text-secondary font-bold text-lg">{plan.timeLabel}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    (includes {plan.credits.toLocaleString()} credits)
                  </div>
                </div>

                <div className="h-px bg-border/60 my-6" />

                <ul className="space-y-3 mb-8 text-sm flex-1 text-muted-foreground">
                  <li>Full AI engine access</li>
                  <li>All transformation presets</li>
                  <li>OBS / Theatre mode</li>
                  <li>Recording + snapshots</li>
                </ul>

                <Link to="/get-started" className="block mt-auto">
                  <Button
                    variant={highlight ? "hero" : "glass"}
                    className="w-full font-mono uppercase tracking-[0.2em] text-xs"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
