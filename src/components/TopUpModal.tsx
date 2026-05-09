import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BADGE_LABEL, CREDIT_PLANS, type CreditPlan } from "@/lib/creditPlans";
import { cn } from "@/lib/utils";

interface TopUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCredited?: () => void;
}

type Stage = "pick" | "wallet" | "confirming" | "done";

export const TopUpModal = ({ open, onOpenChange, onCredited }: TopUpModalProps) => {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string>("");
  const [selected, setSelected] = useState<CreditPlan>(
    CREDIT_PLANS.find((p) => p.badge === "popular") ?? CREDIT_PLANS[0],
  );
  const [stage, setStage] = useState<Stage>("pick");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!document.getElementById("atlos-js")) {
      const s = document.createElement("script");
      s.id = "atlos-js";
      s.src = "https://atlos.io/packages/app/atlos.js";
      s.async = true;
      document.body.appendChild(s);
    }
    if (!merchantId) {
      supabase.functions.invoke("atlos-config").then(({ data }) => {
        if (data?.merchantId) setMerchantId(data.merchantId);
      });
    }
  }, [open, merchantId]);

  // Reset stage when modal closes
  useEffect(() => {
    if (!open) {
      setStage("pick");
      setBusy(false);
    }
  }, [open]);

  const generateOrderId = () => {
    // 8-digit numeric, leading digit 1-9 to guarantee 8 digits
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(10000000 + (buf[0] % 90000000));
  };

  const pollPaid = async (orderId: string, attempts = 30) => {
    setStage("confirming");
    for (let i = 0; i < attempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data } = await supabase
        .from("credit_purchases")
        .select("status")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data?.status === "paid") {
        setStage("done");
        setBusy(false);
        toast.success(`+${selected.timeLabel} of streaming added`);
        onCredited?.();
        setTimeout(() => onOpenChange(false), 1200);
        return;
      }
    }
    setBusy(false);
    setStage("pick");
    toast.message("Still waiting for confirmation. Refresh in a moment.");
  };

  const startCheckout = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!merchantId) {
      toast.error("Crypto checkout is not configured yet. Please try again shortly.");
      return;
    }
    const atlos = (window as unknown as {
      atlos?: { Pay: (opts: Record<string, unknown>) => void };
    }).atlos;
    if (!atlos?.Pay) {
      toast.error("Checkout failed to load. Please refresh.");
      return;
    }

    // Frontend validation: ensure selected plan matches a canonical plan
    // definition exactly. This prevents stale state or tampered values from
    // being persisted into credit_purchases (which the webhook trusts to
    // grant credits).
    const canonical = CREDIT_PLANS.find((p) => p.id === selected.id);
    if (
      !canonical ||
      canonical.credits !== selected.credits ||
      canonical.amountUsd !== selected.amountUsd ||
      canonical.timeLabel !== selected.timeLabel
    ) {
      toast.error("Selected plan is invalid. Please refresh and try again.");
      return;
    }
    if (
      !Number.isInteger(canonical.credits) ||
      canonical.credits <= 0 ||
      !Number.isInteger(canonical.amountUsd) ||
      canonical.amountUsd <= 0
    ) {
      toast.error("Plan pricing is misconfigured. Please contact support.");
      return;
    }

    setBusy(true);
    // Insert pending purchase row with a short numeric order_id used by Atlos.
    // Retry on the rare 8-digit collision.
    let purchase: { id: string; order_id: string; plan: string; amount_usd: number; credits: number } | null = null;
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderId = generateOrderId();
      const { data, error } = await supabase
        .from("credit_purchases")
        .insert({
          user_id: user.id,
          plan: canonical.id,
          amount_usd: canonical.amountUsd,
          credits: canonical.credits,
          status: "pending",
          order_id: orderId,
        })
        .select("id, order_id, plan, amount_usd, credits")
        .single();
      if (data) {
        purchase = data;
        break;
      }
      lastError = error?.message || null;
      // 23505 = unique_violation on order_id → regenerate and retry
      if (!error || (error as { code?: string }).code !== "23505") break;
    }

    if (!purchase) {
      setBusy(false);
      toast.error(lastError || "Could not start checkout");
      return;
    }

    // Verify the persisted row matches the canonical plan exactly before
    // handing the order off to the payment provider.
    if (
      purchase.plan !== canonical.id ||
      purchase.credits !== canonical.credits ||
      purchase.amount_usd !== canonical.amountUsd
    ) {
      setBusy(false);
      setStage("pick");
      toast.error("Plan mismatch detected. Please refresh and try again.");
      return;
    }

    setStage("wallet");
    atlos.Pay({
      merchantId,
      orderId: purchase.order_id,
      orderAmount: canonical.amountUsd,
      orderCurrency: "USD",
      onCompleted: () => {
        toast.success("Payment received. Confirming on-chain...");
        pollPaid(purchase!.order_id);
      },
      onCanceled: () => {
        setBusy(false);
        setStage("pick");
        toast.message("Payment canceled.");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-background/95 backdrop-blur-xl border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Top up streaming credits
          </DialogTitle>
          <DialogDescription>
            Pick how much streaming time you need. Time never expires.
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              {CREDIT_PLANS.map((plan) => {
                const isSelected = selected.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelected(plan)}
                    className={cn(
                      "relative text-left rounded-xl border p-4 transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]"
                        : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    {plan.badge && (
                      <span
                        className={cn(
                          "absolute -top-2 right-3 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded text-primary-foreground",
                          plan.badge === "popular" ? "bg-primary" : "bg-secondary",
                        )}
                      >
                        {BADGE_LABEL[plan.badge]}
                      </span>
                    )}
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {plan.name}
                    </div>
                    <div className="font-display font-black text-3xl mt-1">
                      ${plan.amountUsd}
                    </div>
                    <div className="text-sm text-secondary font-semibold mt-2">
                      {plan.timeLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      (includes {plan.credits.toLocaleString()} credits)
                    </div>
                    {isSelected && (
                      <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                        <Check className="w-3 h-3" /> Selected
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Secure crypto checkout via Atlos. Pay with BTC, ETH, USDC, USDT and more.
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={startCheckout}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
              Pay ${selected.amountUsd} — get {selected.timeLabel} of streaming
            </Button>
          </>
        )}

        {(stage === "wallet" || stage === "confirming") && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="font-display font-bold">
              {stage === "wallet" ? "Waiting for wallet…" : "Confirming on-chain…"}
            </p>
            <p className="text-sm text-muted-foreground">
              {stage === "wallet"
                ? "Approve the transaction in your crypto wallet."
                : "Verifying payment. This usually takes under a minute."}
            </p>
          </div>
        )}

        {stage === "done" && (
          <div className="py-8 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-primary/20 border border-primary/40">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <p className="font-display font-bold text-lg">
              +{selected.timeLabel} of streaming added
            </p>
            <p className="text-sm text-muted-foreground">You're ready to keep streaming.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
