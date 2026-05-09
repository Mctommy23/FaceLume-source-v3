// Usage analytics-only logger.
//
// Credit deduction is NO LONGER handled here — that lives in `streaming-session`
// (atomic, row-locked, server-driven). This endpoint accepts only an
// analytics insert into usage_logs; it does NOT modify credits.
//
// Kept for backward compat with old clients. The `seconds` field is
// recorded as-is for analytics, but never debited from `profiles.credits`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
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

    const body = await req.json().catch(() => null);
    const seconds = body?.seconds;
    if (
      typeof seconds !== "number" ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds > 86_400
    ) {
      return json({ error: "Invalid `seconds` (number, 0-86400)" }, 400);
    }

    const wholeSeconds = Math.round(seconds);

    const { data, error } = await supabase
      .from("usage_logs")
      .insert({
        user_id: userData.user.id,
        seconds: wholeSeconds,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("usage insert error", error);
      return json({ error: error.message }, 500);
    }

    // NOTE: credits are NOT deducted here — see `streaming-session` for the
    // authoritative, atomic, row-locked credit charge path.
    return json({ ok: true, log: data, deducted: false }, 200);
  } catch (e) {
    console.error("usage error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
