// Atlos webhook handler — verifies signature, logs every delivery,
// then either marks an activation paid (legacy device licensing) or
// credits a user account (credit top-up purchases).
// Public endpoint (server-to-server).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, signature",
};

async function hmacSha256(secret: string, message: string): Promise<{ hex: string; base64: string }> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sigBuf);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const base64 = btoa(bin);
  return { hex, base64 };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVATION_PREFIX = "activation_";
const STARTER_CREDITS = 1200;
const ACTIVATION_PRICE_USD = 50; // C2: minimum amount required to activate

function generateLicenseKey(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `FL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}`;
}

// Best-effort transactional email send. Never throws — webhook flow must
// never fail because of an email send error.
async function sendEmail(
  supabaseUrl: string,
  serviceKey: string,
  templateName: string,
  recipientEmail: string,
  idempotencyKey: string,
  templateData?: Record<string, unknown>,
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ templateName, recipientEmail, idempotencyKey, templateData }),
    });
  } catch (e) {
    console.error("sendEmail failed", { templateName, error: (e as Error).message });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ATLOS_API_SECRET = Deno.env.get("ATLOS_API_SECRET");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Collected fields for the audit log
  let orderId: string | null = null;
  let status: string | null = null;
  let signatureValid = false;
  let signatureHeader = "";
  let payloadJson: unknown = null;
  let responseCode = 200;
  let errorMessage: string | null = null;

  const sourceIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;

  const writeLog = async () => {
    try {
      await supabase.from("atlos_webhook_logs").insert({
        order_id: orderId,
        status,
        signature_valid: signatureValid,
        signature_header: signatureHeader || null,
        response_code: responseCode,
        error_message: errorMessage,
        payload: payloadJson,
        source_ip: sourceIp,
      });
    } catch (e) {
      console.error("Failed to write webhook log", e);
    }
  };

  /**
   * Record a duplicate-delivery attempt with a structured, machine-parseable
   * `error_message`. Always sets `order_id` (falling back to the explicit
   * argument when the outer `orderId` capture is null) and a stable JSON
   * shape so admins can filter on `kind: "duplicate"` and group by `reason`.
   *
   * Reasons:
   *  - "already_paid"        → credit_purchases.status was already 'paid'
   *  - "race_lost"           → concurrent delivery won the pending→paid flip
   *  - "activation_recorded" → activation_orders row already existed
   *  - "activation_user"     → user already activated by a different orderId
   *  - "activation_claim"    → unique-violation on activation_orders insert
   */
  const logDuplicate = async (
    reason:
      | "already_paid"
      | "race_lost"
      | "activation_recorded"
      | "activation_user"
      | "activation_claim",
    kindHint: "credit_purchase" | "activation",
    explicitOrderId?: string,
    extra?: Record<string, unknown>,
  ) => {
    if (!orderId && explicitOrderId) orderId = explicitOrderId;
    const message = {
      kind: "duplicate",
      delivery: kindHint,
      reason,
      order_id: orderId,
      ...(extra ?? {}),
    };
    errorMessage = JSON.stringify(message);
    console.log(`[duplicate] ${errorMessage}`);
    await writeLog();
  };


  try {
    if (!ATLOS_API_SECRET) {
      responseCode = 500;
      errorMessage = "Missing ATLOS_API_SECRET";
      await writeLog();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    signatureHeader =
      req.headers.get("signature") ||
      req.headers.get("Signature") ||
      req.headers.get("x-atlos-signature") ||
      "";

    const { hex: expectedHex, base64: expectedB64 } = await hmacSha256(ATLOS_API_SECRET, rawBody);
    const provided = signatureHeader.trim();
    signatureValid =
      timingSafeEqual(provided.toLowerCase(), expectedHex.toLowerCase()) ||
      timingSafeEqual(provided, expectedB64);

    try {
      payloadJson = JSON.parse(rawBody);
    } catch {
      payloadJson = { raw: rawBody };
    }

    const p = (payloadJson ?? {}) as Record<string, unknown>;
    orderId =
      (p.OrderId as string) ||
      (p.OrderID as string) ||
      (p.orderId as string) ||
      (p.order_id as string) ||
      null;
    const rawStatus = p.Status ?? p.status;
    status = rawStatus == null ? null : String(rawStatus);

    if (!signatureValid) {
      responseCode = 401;
      errorMessage = "Invalid signature";
      console.error("Invalid Atlos signature", { signatureHeader, expectedHex, expectedB64 });
      await writeLog();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!orderId) {
      responseCode = 400;
      errorMessage = "Missing OrderID";
      await writeLog();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atlos uses Status==100 for confirmed/paid; also accept word forms for safety.
    const lower = (status || "").toLowerCase();
    const isPaid =
      status === "100" ||
      ["completed", "confirmed", "paid", "success"].includes(lower);

    if (!isPaid) {
      console.log(`Ignoring non-paid status: ${status} for order ${orderId}`);
      await writeLog();
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Account-based activation. Two OrderId shapes are accepted:
    //   - `activation_<user_id>`              (stable, preferred — prevents dup orders)
    //   - `activation_<user_id>_<timestamp>`  (legacy)
    if (orderId.startsWith(ACTIVATION_PREFIX)) {
      const rest = orderId.slice(ACTIVATION_PREFIX.length);
      // If the remainder is a valid UUID as-is, use it directly. Otherwise fall
      // back to stripping a trailing `_<timestamp>` suffix (legacy format).
      const userId = UUID_RE.test(rest)
        ? rest
        : (() => {
            const sep = rest.lastIndexOf("_");
            return sep > 0 ? rest.slice(0, sep) : rest;
          })();

      if (!UUID_RE.test(userId)) {
        responseCode = 400;
        errorMessage = `Invalid activation orderId: ${orderId}`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // C2 fix: validate the paid amount BEFORE granting activation. The
      // OrderID alone is user-controllable (caller supplies their own user id
      // in the prefix); without an amount check, a $1 payment could grant a
      // $50 activation. Atlos sends OrderAmount as a numeric USD value.
      const rawAmount = (p.OrderAmount ?? p.orderAmount ?? p.order_amount ?? p.Amount ?? p.amount) as unknown;
      const paidAmount = typeof rawAmount === "number"
        ? rawAmount
        : typeof rawAmount === "string" ? parseFloat(rawAmount) : NaN;

      if (!Number.isFinite(paidAmount) || paidAmount < ACTIVATION_PRICE_USD) {
        responseCode = 400;
        errorMessage = `Activation amount too low: got ${rawAmount}, require >= ${ACTIVATION_PRICE_USD}`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1) Idempotency guard #1 — exact OrderId. If this OrderId was already
      // processed (any retry/duplicate delivery of the same Atlos order), ack
      // and stop. The UNIQUE constraint on order_id is the source of truth.
      const { data: existingOrder } = await supabase
        .from("activation_orders")
        .select("id, user_id, credits_granted")
        .eq("order_id", orderId)
        .maybeSingle();

      if (existingOrder) {
        await logDuplicate("activation_recorded", "activation", orderId, {
          user_id: existingOrder.user_id,
          credits_granted: existingOrder.credits_granted,
        });
        return new Response(
          JSON.stringify({ ok: true, alreadyProcessed: true, kind: "activation", reason: "activation_recorded" }),
          {
            status: responseCode,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 2) Idempotency guard #2 — user already activated by a *different*
      // OrderId. Record this OrderId so future retries of the same delivery
      // also short-circuit, but do NOT grant starter credits again.
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, is_activated, credits, license_key")
        .eq("id", userId)
        .maybeSingle();

      if (profErr || !prof) {
        responseCode = 500;
        errorMessage = `Profile lookup failed: ${profErr?.message || "not found"}`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (prof.is_activated) {
        await supabase
          .from("activation_orders")
          .insert({ order_id: orderId, user_id: userId, credits_granted: 0 });
        await logDuplicate("activation_user", "activation", orderId, {
          user_id: userId,
          note: "user already activated via a different order_id; recorded with 0 credits",
        });
        return new Response(
          JSON.stringify({ ok: true, alreadyProcessed: true, kind: "activation", reason: "activation_user" }),
          {
            status: responseCode,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 3) Claim the OrderId atomically BEFORE granting credits. The UNIQUE
      // index on order_id ensures only one concurrent delivery wins. Lost
      // races get a duplicate-key error and bail out.
      const { error: claimErr } = await supabase
        .from("activation_orders")
        .insert({ order_id: orderId, user_id: userId, credits_granted: STARTER_CREDITS });

      if (claimErr) {
        // 23505 = unique_violation → another concurrent delivery already
        // claimed this orderId. Treat as already processed.
        if ((claimErr as { code?: string }).code === "23505") {
          await logDuplicate("activation_claim", "activation", orderId, {
            user_id: userId,
            note: "unique_violation on activation_orders insert (concurrent delivery)",
          });
          return new Response(
            JSON.stringify({ ok: true, alreadyProcessed: true, kind: "activation", reason: "activation_claim" }),
            {
              status: responseCode,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        responseCode = 500;
        errorMessage = `Activation claim failed: ${claimErr.message}`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4) Apply activation + starter credits. The WHERE is_activated=false
      // is a final guard against any race that slipped past the claim.
      const licenseKey = prof.license_key ?? generateLicenseKey();
      // Activation grants exactly STARTER_CREDITS (does not stack on existing balance).
      const newCredits = STARTER_CREDITS;

      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update({
          is_activated: true,
          activated_at: new Date().toISOString(),
          license_key: licenseKey,
          credits: newCredits,
        })
        .eq("id", userId)
        .eq("is_activated", false)
        .select("id")
        .maybeSingle();

      if (updErr || !updated) {
        // Rollback the claim so the OrderId isn't permanently marked done
        // without the credits being granted. A retry can then complete it.
        await supabase.from("activation_orders").delete().eq("order_id", orderId);
        responseCode = 500;
        errorMessage = `Activation update failed: ${updErr?.message || "no row updated"}`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Activated user ${userId} via ${orderId}, +${STARTER_CREDITS} credits`);

      // Best-effort activation confirmation email
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (email) {
          await sendEmail(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
            "activation-confirmation", email, `activation-${orderId}`,
            { licenseKey, credits: STARTER_CREDITS });
        }
      } catch (e) { console.error("activation email lookup failed", e); }

      await writeLog();
      return new Response(
        JSON.stringify({ ok: true, kind: "activation", licenseKey }),
        {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Otherwise, OrderID is the short numeric `order_id` of a credit_purchases
    // row (top-ups), or — for legacy device-licensing flows — the UUID `id`
    // of an activations row. Try credit_purchases first by order_id.
    const { data: purchase, error: purchaseErr } = await supabase
      .from("credit_purchases")
      .select("id, user_id, credits, status, amount_usd, plan")
      .eq("order_id", orderId)
      .maybeSingle();


    if (purchaseErr) {
      responseCode = 500;
      errorMessage = `Lookup failed: ${purchaseErr.message}`;
      await writeLog();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the actual paid amount against the plan we recorded BEFORE
    // granting any credits. The DB trigger guarantees `purchase.amount_usd`
    // matches an allowed plan, so we compare Atlos' reported amount to it.
    if (purchase) {
      const rawAmount = (p.OrderAmount ?? p.orderAmount ?? p.order_amount ?? p.Amount ?? p.amount) as unknown;
      const paidAmount = typeof rawAmount === "number"
        ? rawAmount
        : typeof rawAmount === "string" ? parseFloat(rawAmount) : NaN;
      if (!Number.isFinite(paidAmount) || paidAmount + 0.0001 < purchase.amount_usd) {
        responseCode = 400;
        errorMessage = `Credit purchase amount too low: got ${rawAmount}, require >= ${purchase.amount_usd} (plan=${purchase.plan})`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (purchase) {
      // Idempotency guard #1 — purchase already marked paid by an earlier
      // delivery. Ack with 200 so Atlos stops retrying, but do NOT grant
      // credits again.
      if (purchase.status === "paid") {
        await logDuplicate("already_paid", "credit_purchase", orderId, {
          purchase_id: purchase.id,
          user_id: purchase.user_id,
          credits: purchase.credits,
        });
        return new Response(
          JSON.stringify({ ok: true, alreadyProcessed: true, reason: "already_paid" }),
          {
            status: responseCode,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Idempotency guard #2 — atomic pending→paid flip. The
      // .eq("status", "pending") clause ensures only ONE concurrent delivery
      // can transition the row; all others get zero rows updated.
      const { data: marked, error: markErr } = await supabase
        .from("credit_purchases")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", purchase.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (markErr) {
        responseCode = 500;
        errorMessage = `Mark paid failed: ${markErr.message}`;
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!marked) {
        // Lost the race — a concurrent delivery already flipped pending→paid
        // and is granting credits. Ack and bail; do NOT double-credit.
        await logDuplicate("race_lost", "credit_purchase", orderId, {
          purchase_id: purchase.id,
          user_id: purchase.user_id,
          credits: purchase.credits,
        });
        return new Response(
          JSON.stringify({ ok: true, alreadyProcessed: true, reason: "race_lost" }),
          {
            status: responseCode,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // C3 fix: atomic credit increment via SECURITY DEFINER RPC.
      // Replaces the previous read-modify-write pattern that could lose
      // updates under concurrent webhook delivery.
      const { data: newCredits, error: updErr } = await supabase.rpc(
        "increment_user_credits",
        { _user_id: purchase.user_id, _amount: purchase.credits },
      );

      if (updErr || newCredits == null) {
        responseCode = 500;
        errorMessage = `Credit update failed: ${updErr?.message || "no balance returned"}`;
        await supabase
          .from("credit_purchases")
          .update({ status: "pending", paid_at: null })
          .eq("id", purchase.id);
        await writeLog();
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(
        `Credited user ${purchase.user_id}: +${purchase.credits} (new balance: ${newCredits})`,
      );

      // Best-effort credit purchase receipt email
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(purchase.user_id);
        const email = userData?.user?.email;
        if (email) {
          await sendEmail(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
            "credit-purchase-receipt", email, `receipt-${orderId}`,
            { credits: purchase.credits, amountUsd: purchase.amount_usd, orderId });
        }
      } catch (e) { console.error("receipt email lookup failed", e); }

      await writeLog();
      return new Response(
        JSON.stringify({ ok: true, credited: purchase.credits, newBalance: newCredits }),
        {
          status: responseCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fallback: legacy activation payment (device licensing flow). Only valid
    // when OrderID is a UUID matching an activations row id.
    if (!UUID_RE.test(orderId)) {
      responseCode = 404;
      errorMessage = `OrderID not found in credit_purchases: ${orderId}`;
      await writeLog();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error } = await supabase
      .from("activations")
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      responseCode = 500;
      errorMessage = `DB update failed: ${error.message}`;
      console.error("Update error", error);
      await writeLog();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: responseCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await writeLog();
    return new Response(JSON.stringify({ ok: true, kind: "activation" }), {
      status: responseCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    responseCode = 500;
    errorMessage = err instanceof Error ? err.message : "unknown error";
    console.error("atlos-webhook error", errorMessage);
    await writeLog();
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: responseCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
