import { useEffect, useMemo, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  KeyRound,
  CreditCard,
  CheckCircle2,
  Copy,
  ShieldCheck,
  Wallet,
  Radio,
  Sparkles,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ACTIVATION_FEE_USD = 50;
const STARTER_CREDITS = 1200;

const Activate = () => {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState<"pay" | "done">("pay");
  const [busy, setBusy] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/get-started", { replace: true });
      return;
    }
    // Admins skip activation entirely — send them straight to the dashboard.
    if (profile?.is_admin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    // Already activated → skip the activation page entirely and go to the studio.
    if (profile?.is_activated) {
      navigate("/app", { replace: true });
    }
  }, [user, profile, loading, navigate]);

  // Load Atlos checkout script + fetch public Merchant ID once.
  useEffect(() => {
    if (!document.getElementById("atlos-js")) {
      const s = document.createElement("script");
      s.id = "atlos-js";
      s.src = "https://atlos.io/packages/app/atlos.js";
      s.async = true;
      document.body.appendChild(s);
    }
    supabase.functions.invoke("atlos-config").then(({ data }) => {
      if (data?.merchantId) setMerchantId(data.merchantId);
    });
  }, []);

  type PayStage = "idle" | "wallet" | "confirming" | "unlocked" | "timeout";
  const [payStage, setPayStage] = useState<PayStage>("idle");
  const [pollCount, setPollCount] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<string>("");

  // Derive a short 8-digit numeric reference from the full internal orderId
  // for display purposes. The full orderId is still what Atlos sees on the
  // backend; this is only a friendlier label for the user.
  const shortOrderRef = useMemo(() => {
    if (!activeOrderId) return "";
    let h = 0;
    for (let i = 0; i < activeOrderId.length; i++) {
      h = (h * 31 + activeOrderId.charCodeAt(i)) >>> 0;
    }
    return String(10000000 + (h % 90000000));
  }, [activeOrderId]);

  // Poll profile after checkout closes — webhook flips is_activated to true.
  const pollActivated = async (attempts = 30) => {
    if (!user) return;
    setPayStage("confirming");
    setPollCount(0);
    for (let i = 0; i < attempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      setPollCount(i + 1);
      const { data } = await supabase
        .from("profiles")
        .select("is_activated")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.is_activated) {
        await refreshProfile();
        try { sessionStorage.setItem("facelume:justActivated", "1"); } catch { /* ignore */ }
        setPayStage("unlocked");
        setTimeout(() => {
          setStep("done");
          setBusy(null);
        }, 700);
        toast.success("Activation complete!");
        return;
      }
    }
    setPayStage("timeout");
    setBusy(null);
    toast.message("Still waiting for confirmation. Refresh in a moment if your payment went through.");
  };

  const completePayment = async () => {
    if (!user) return;
    if (busy === "pay") return; // guard against double-clicks
    if (!merchantId) {
      toast.error("Crypto checkout is not configured yet. Please try again shortly.");
      return;
    }
    const atlos = (window as unknown as { atlos?: { Pay: (opts: Record<string, unknown>) => void } }).atlos;
    if (!atlos?.Pay) {
      toast.error("Checkout failed to load. Please refresh the page.");
      return;
    }

    // Re-check activation status server-side before opening checkout, so a user
    // who already paid in another tab/session never creates a duplicate order.
    const { data: fresh } = await supabase
      .from("profiles")
      .select("is_activated")
      .eq("id", user.id)
      .maybeSingle();
    if (fresh?.is_activated) {
      await refreshProfile();
      setStep("done");
      toast.success("Your account is already activated.");
      return;
    }

    // Also check for an already-processed activation order for this user.
    // The webhook records every successful activation in `activation_orders`;
    // if one exists, the on-chain payment is done and we should not start a new one.
    const { data: existingOrders } = await supabase
      .from("activation_orders")
      .select("order_id")
      .eq("user_id", user.id)
      .limit(1);
    if (existingOrders && existingOrders.length > 0) {
      toast.message("An activation payment was already processed for your account. Refreshing...");
      await refreshProfile();
      return;
    }

    // Stable OrderId per user — repeated clicks reuse the same id, so the
    // webhook's UNIQUE(order_id) constraint dedupes any duplicate deliveries
    // and we never spawn parallel activation orders for the same account.
    const orderId = `activation_${user.id}`;
    setActiveOrderId(orderId);
    setBusy("pay");
    setPayStage("wallet");
    atlos.Pay({
      merchantId,
      orderId,
      orderAmount: ACTIVATION_FEE_USD,
      orderCurrency: "USD",
      onCompleted: () => {
        toast.success("Payment received. Confirming on-chain...");
        pollActivated();
      },
      onCanceled: () => {
        setBusy(null);
        setPayStage("idle");
        toast.message("Payment canceled.");
      },
    });
  };

  const copyKey = async () => {
    if (!profile?.license_key) return;
    await navigator.clipboard.writeText(profile.license_key);
    toast.success("License key copied");
  };

  const stepIndex = useMemo(() => (step === "pay" ? 0 : 1), [step]);

  return (
    <>
      <title>Activate Your Account — FaceLume</title>
      <meta
        name="description"
        content="Activate your FaceLume account with a one-time payment to unlock streaming and start buying credits."
      />

      <div className="min-h-screen relative">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/15 blur-3xl rounded-full pointer-events-none" />

        <main className="relative pt-16 pb-16 container max-w-3xl">
          <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
            <Button
              variant="glass"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/get-started", { replace: true });
              }}
            >
              <LogOut className="w-4 h-4" /> Log out
            </Button>
          </div>
          <div className="mb-8 text-center">
            <p className="text-sm font-mono text-muted-foreground tracking-widest uppercase mb-2">
              One-time activation
            </p>
            <h1 className="font-display font-black text-4xl md:text-5xl mb-3">
              Activate Your <span className="neon-text">Account</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Pay the one-time activation fee to unlock streaming. After this, you can top up credits
              anytime.
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {["Payment", "Activated"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                    i <= stepIndex
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_0_16px_hsl(var(--primary)/0.6)]"
                      : "bg-background/40 text-muted-foreground border-border"
                  }`}
                >
                  {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-mono uppercase tracking-widest ${
                    i <= stepIndex ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {i < 1 && <div className="w-8 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-primary opacity-30 blur-2xl rounded-3xl" />
              <div className="relative glass-strong rounded-3xl p-8 md:p-10">
                {step === "pay" && (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-secondary/15 border border-secondary/30">
                        <CreditCard className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <h2 className="font-display font-bold text-xl mb-1">
                          One-time activation fee
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Unlock your account and receive {STARTER_CREDITS} starter credits.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/30 p-5 space-y-3">
                      <Row label="Account" value={user?.email ?? ""} mono />
                      <Row
                        label="Activation fee"
                        value={`$${ACTIVATION_FEE_USD}.00 USD`}
                        accent
                      />
                      <Row label="Includes" value={`${STARTER_CREDITS} starter credits`} />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Secure crypto checkout via Atlos. Pay with BTC, ETH, USDC, USDT and more.
                    </div>

                    {activeOrderId && (
                      <div className="rounded-xl border border-border/60 bg-background/30 p-4 space-y-2">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                          Order ID
                        </Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 font-mono text-sm md:text-base text-primary-glow tracking-widest bg-background/60 rounded-lg px-3 py-2 border border-border/60">
                            {shortOrderRef}
                          </code>
                          <Button
                            variant="glass"
                            size="icon"
                            onClick={async () => {
                              await navigator.clipboard.writeText(shortOrderRef);
                              toast.success("Order ID copied");
                            }}
                            aria-label="Copy order ID"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Reference this ID when reporting payment issues.
                        </p>
                      </div>
                    )}

                    {payStage !== "idle" && (
                      <PaymentTimeline stage={payStage} pollCount={pollCount} maxPolls={30} />
                    )}

                    <Button
                      onClick={completePayment}
                      variant="hero"
                      size="lg"
                      className="w-full"
                      disabled={busy === "pay"}
                    >
                      {busy === "pay" ? <Loader2 className="animate-spin" /> : <CreditCard />}
                      {payStage === "confirming"
                        ? "Confirming on-chain..."
                        : payStage === "wallet"
                        ? "Waiting for wallet..."
                        : `Activate for $${ACTIVATION_FEE_USD}`}
                    </Button>
                  </div>
                )}

                {step === "done" && profile && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <div className="inline-flex p-4 rounded-full bg-primary/20 border border-primary/40 mb-2">
                        <CheckCircle2 className="w-10 h-10 text-primary" />
                      </div>
                      <h2 className="font-display font-bold text-2xl">Account activated</h2>
                      <p className="text-sm text-muted-foreground">
                        You're all set. Jump into the studio or top up credits anytime.
                      </p>
                    </div>

                    {profile.license_key && (
                      <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-3">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5" /> License key
                        </Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 font-mono text-sm md:text-base text-primary-glow break-all bg-background/60 rounded-lg px-3 py-2.5 border border-border/60">
                            {profile.license_key}
                          </code>
                          <Button variant="glass" size="icon" onClick={copyKey} aria-label="Copy license key">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <Link to="/app">
                        <Button variant="hero" size="lg" className="w-full">
                          <Sparkles /> Open Studio
                        </Button>
                      </Link>
                      <Link to="/credits">
                        <Button variant="glass" size="lg" className="w-full">
                          Buy credits
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

const Row = ({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={`${mono ? "font-mono" : "font-medium"} ${
        accent ? "text-primary-glow font-display font-bold text-base" : "text-foreground"
      } text-right break-all`}
    >
      {value}
    </span>
  </div>
);

type PayStageT = "idle" | "wallet" | "confirming" | "unlocked" | "timeout";

const PaymentTimeline = ({
  stage,
  pollCount,
  maxPolls,
}: {
  stage: PayStageT;
  pollCount: number;
  maxPolls: number;
}) => {
  const order: PayStageT[] = ["wallet", "confirming", "unlocked"];
  const activeIdx = stage === "timeout" ? 1 : order.indexOf(stage);

  const steps = [
    {
      key: "wallet" as const,
      label: "Waiting for wallet",
      sub: "Approve the transaction in your crypto wallet",
      Icon: Wallet,
    },
    {
      key: "confirming" as const,
      label: "Checking confirmations",
      sub:
        stage === "confirming"
          ? `Polling network · attempt ${pollCount}/${maxPolls}`
          : "Verifying the on-chain payment",
      Icon: Radio,
    },
    {
      key: "unlocked" as const,
      label: "Account unlocked",
      sub: "Activation flag set on your profile",
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4 space-y-3">
      {steps.map((s, i) => {
        const done = i < activeIdx || stage === "unlocked";
        const active = i === activeIdx && stage !== "unlocked" && stage !== "timeout";
        const failed = stage === "timeout" && i === 1;
        return (
          <div key={s.key} className="flex items-start gap-3">
            <div
              className={`mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                done
                  ? "bg-primary/20 border-primary text-primary"
                  : active
                  ? "bg-primary/10 border-primary/60 text-primary animate-pulse"
                  : failed
                  ? "bg-destructive/15 border-destructive/60 text-destructive"
                  : "bg-background/40 border-border text-muted-foreground"
              }`}
            >
              {active ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : done ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <s.Icon className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex-1">
              <div
                className={`text-sm font-medium ${
                  done || active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Activate;
