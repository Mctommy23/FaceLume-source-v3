// Returns the public Atlos Merchant ID for the frontend checkout widget.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const merchantId = Deno.env.get("ATLOS_MERCHANT_ID") ?? "";
  return new Response(JSON.stringify({ merchantId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
