// Decart realtime client-token issuer.
// Authenticates the caller via Supabase JWT, then mints a short-lived
// Decart client token (ek_...) restricted to the lucy-2 realtime model.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createDecartClient } from "https://esm.sh/@decartai/sdk@0.0.61";

const decartCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": [
    corsHeaders["Access-Control-Allow-Headers"],
    "x-streaming-session-id",
  ].filter(Boolean).join(", "),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: decartCorsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;

    // Server-side credit enforcement — uses service role to bypass RLS
    // and guarantee an authoritative read regardless of client policies.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("credits, is_activated, is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("decart-token profile fetch error", profileErr);
      return json({ error: "PROFILE_FETCH_FAILED", message: "Could not verify credits" }, 500);
    }

    if (!profile) {
      return json({ error: "PROFILE_NOT_FOUND", message: "Profile not found" }, 404);
    }

    // Server-side activation gate — do NOT rely on frontend route protection.
    // Admins bypass activation. Everyone else must be activated.
    if (!profile.is_activated && !profile.is_admin) {
      return json({ error: "NOT_ACTIVATED", message: "Account not activated" }, 403);
    }

    // CORE RULE: 1 second of streaming = 2 credits.
    // Reject if user can't afford even 1 second of streaming.
    const CREDITS_PER_SECOND = 2;
    const credits = profile.credits ?? 0;

    if (credits < CREDITS_PER_SECOND) {
      return json(
        {
          error: "INSUFFICIENT_CREDITS",
          message: "Insufficient credits or account not activated",
          credits,
        },
        403,
      );
    }

    // Require an active streaming session (server-owned, single per user).
    // Without this any tab could mint parallel tokens.
    const sessionId = req.headers.get("x-streaming-session-id");
    if (!sessionId) {
      return json({ error: "NO_ACTIVE_SESSION", message: "Start a streaming session first" }, 403);
    }
    const { data: sess, error: sessErr } = await adminClient
      .from("streaming_sessions")
      .select("id, user_id, ended_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessErr || !sess || sess.user_id !== userId || sess.ended_at !== null) {
      return json({ error: "INVALID_SESSION", message: "Session not active" }, 403);
    }

    const apiKey = Deno.env.get("DECART_API_KEY");
    if (!apiKey) return json({ error: "DECART_API_KEY not configured" }, 500);

    // Cap session at 60s so we re-check credits every minute via token refresh.
    const SESSION_SECONDS = 60;
    const decart = createDecartClient({ apiKey });
    const token = await decart.tokens.create({
      expiresIn: 120, // token valid 2 min — frontend refreshes ~10s before session end
      allowedModels: ["lucy-2.1", "lucy-restyle-2", "lucy-2.1-vton"],
      metadata: { user_id: userData.user.id },
      constraints: { realtime: { maxSessionDuration: SESSION_SECONDS } },
    });

    return json(token, 200);
  } catch (e) {
    console.error("decart-token error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...decartCorsHeaders, "Content-Type": "application/json" },
  });
}
