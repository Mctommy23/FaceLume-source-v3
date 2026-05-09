// Credit top-up plans.
// CORE RULE: 1 second of streaming = 2 credits (i.e. 1 credit = 0.5s).
// Pricing is presented to users as TIME (minutes/hours); credits are an
// internal implementation detail surfaced as a small "(includes X credits)" line.
export type CreditPlanId = "starter" | "pro" | "premium" | "elite";

export type PlanBadge = "popular" | "best-value";

/** Conversion constant — keep in sync with backend (decart-token / usage). */
export const CREDITS_PER_SECOND = 2;

/** Convert credits to streaming seconds. */
export const creditsToSeconds = (credits: number) => credits / CREDITS_PER_SECOND;

/** Convert seconds to credits. */
export const secondsToCredits = (seconds: number) => seconds * CREDITS_PER_SECOND;

export interface CreditPlan {
  id: CreditPlanId;
  name: string;
  credits: number;
  amountUsd: number;
  /** Human-friendly time label, e.g. "10 minutes", "2 hours". */
  timeLabel: string;
  badge?: PlanBadge;
}

export const CREDIT_PLANS: CreditPlan[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 1200, // 600s = 10 min
    amountUsd: 20,
    timeLabel: "10 minutes",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 3000, // 1500s = 25 min
    amountUsd: 45,
    timeLabel: "25 minutes",
    badge: "popular",
  },
  {
    id: "premium",
    name: "Premium",
    credits: 4800, // 2400s = 40 min
    amountUsd: 70,
    timeLabel: "40 minutes",
  },
  {
    id: "elite",
    name: "Elite",
    credits: 14400, // 7200s = 2 hours
    amountUsd: 220,
    timeLabel: "2 hours",
    badge: "best-value",
  },
];

export const BADGE_LABEL: Record<PlanBadge, string> = {
  popular: "Most Popular",
  "best-value": "Best Value",
};

/** Format a credit balance as a human-readable streaming time. */
export const formatMinutes = (credits: number) => {
  const totalSeconds = Math.max(0, Math.floor(creditsToSeconds(credits)));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0 && m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  if (h > 0) return `${h}h ${m}m`;
  if (m === 0) return `${s} seconds`;
  if (s === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return `${m}m ${s}s`;
};
