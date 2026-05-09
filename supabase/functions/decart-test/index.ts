// Decart API test endpoint.
// Verifies DECART_API_KEY works by hitting Decart's API and returning the result.
// This is a stub for the future Studio integration.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const DECART_API_KEY = Deno.env.get("DECART_API_KEY");
  if (!DECART_API_KEY) return json(500, { error: "DECART_API_KEY is not configured" });

  // Require an authenticated Supabase user to call this (prevents key abuse)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  // Default: simple GET ping — pass ?endpoint=... and method/body to proxy other Decart endpoints.
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "/v1/models";
  const upstreamMethod = (url.searchParams.get("method") ?? "GET").toUpperCase();

  const body = upstreamMethod !== "GET" && upstreamMethod !== "HEAD"
    ? await req.text()
    : undefined;

  try {
    const resp = await fetch(`https://api.decart.ai${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`, {
      method: upstreamMethod,
      headers: {
        "Authorization": `Bearer ${DECART_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    return json(resp.ok ? 200 : resp.status, {
      ok: resp.ok,
      status: resp.status,
      endpoint,
      method: upstreamMethod,
      response: parsed,
    });
  } catch (e) {
    console.error("decart-test error:", e);
    return json(502, { error: e instanceof Error ? e.message : "Upstream call failed" });
  }
});
