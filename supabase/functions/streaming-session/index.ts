// Server-owned streaming session controller.
// Enforces single-active-session per user, atomic credit deduction.
// Actions: start | heartbeat | end
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "start") {
      const { data, error } = await admin.rpc("start_streaming_session", { _user_id: userId });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("NOT_ACTIVATED")) return json({ error: "NOT_ACTIVATED" }, 403);
        if (msg.includes("INSUFFICIENT_CREDITS")) return json({ error: "INSUFFICIENT_CREDITS" }, 403);
        if (msg.includes("PROFILE_NOT_FOUND")) return json({ error: "PROFILE_NOT_FOUND" }, 404);
        console.error("start_streaming_session error", error);
        return json({ error: msg }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;
      return json({ session_id: row.session_id, credits: row.credits }, 200);
    }

    if (action === "heartbeat" || action === "end") {
      const sessionId = body?.session_id as string | undefined;
      const totalSeconds = Number(body?.total_seconds ?? 0);
      if (!sessionId || typeof sessionId !== "string") {
        return json({ error: "session_id required" }, 400);
      }
      if (!Number.isFinite(totalSeconds) || totalSeconds < 0 || totalSeconds > 86_400) {
        return json({ error: "Invalid total_seconds" }, 400);
      }
      const wholeSeconds = Math.round(totalSeconds);

      if (action === "heartbeat") {
        const { data, error } = await admin.rpc("charge_streaming_session", {
          _session_id: sessionId,
          _user_id: userId,
          _total_seconds: wholeSeconds,
        });
        if (error) {
          if ((error.message || "").includes("STREAMING_SESSION_NOT_FOUND")) {
            return json({ error: "SESSION_NOT_FOUND" }, 404);
          }
          console.error("charge_streaming_session error", error);
          return json({ error: error.message }, 500);
        }
        const row = Array.isArray(data) ? data[0] : data;
        return json({
          credits: row.credits,
          charged_seconds: row.charged_seconds,
          ended: row.ended,
        }, 200);
      }

      // end
      const { data, error } = await admin.rpc("end_streaming_session", {
        _session_id: sessionId,
        _user_id: userId,
        _total_seconds: wholeSeconds,
        _reason: (body?.reason as string) || "client_end",
      });
      if (error) {
        console.error("end_streaming_session error", error);
        return json({ error: error.message }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;

      // Mirror to usage_logs for analytics (best-effort).
      if (wholeSeconds > 0) {
        await admin.from("usage_logs").insert({
          user_id: userId,
          seconds: wholeSeconds,
          timestamp: new Date().toISOString(),
        });
      }

      // Best-effort low-credits warning email (sent at most once per dip below threshold)
      const LOW_THRESHOLD = 300;
      try {
        if (typeof row.credits === "number" && row.credits < LOW_THRESHOLD) {
          const { data: prof } = await admin
            .from("profiles")
            .select("low_credits_notified_at")
            .eq("id", userId)
            .maybeSingle();
          if (!prof?.low_credits_notified_at) {
            const email = userData.user.email;
            if (email) {
              await admin.from("profiles")
                .update({ low_credits_notified_at: new Date().toISOString() })
                .eq("id", userId);
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  templateName: "low-credits-warning",
                  recipientEmail: email,
                  idempotencyKey: `low-credits-${userId}-${Date.now()}`,
                  templateData: { credits: row.credits },
                }),
              }).catch(() => { /* ignore */ });
            }
          } else if (row.credits >= LOW_THRESHOLD * 2) {
            // Reset notification flag once user has topped up well above threshold
            await admin.from("profiles")
              .update({ low_credits_notified_at: null })
              .eq("id", userId);
          }
        }
      } catch (e) { console.error("low-credits email failed", e); }

      return json({ credits: row.credits, charged_seconds: row.charged_seconds }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("streaming-session error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
