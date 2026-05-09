// Admin API — backend control surface for FaceLume.
// Auth: either
//   - `x-admin-key: <ADMIN_API_KEY>` header (external/CLI use), or
//   - `Authorization: Bearer <user_jwt>` where user has the 'admin' role (dashboard).
//
// Endpoints (path is the trailing segment after /admin-api):
//   GET    /stats                            -> dashboard KPIs + 30d series
//   GET    /users?page=&perPage=&q=          -> list users (with profile + role)
//   GET    /users/:id                        -> get one user (full detail)
//   DELETE /users/:id                        -> delete user (auth + cascading rows)
//   POST   /users/:id/credits                -> body: { delta?: number, set?: number }
//   POST   /users/:id/role                   -> body: { role: 'admin'|'user', action: 'add'|'remove' }
//   GET    /activation-orders?limit=         -> list activation orders (with email)
//   GET    /credit-purchases?limit=&status=  -> list credit purchases (with email)
//   GET    /usage/top-users?limit=           -> top users by total seconds
//   GET    /usage/recent?limit=              -> recent usage logs (with email)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ACTIVATION_FEE_USD = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ADMIN_API_KEY = Deno.env.get("ADMIN_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!ADMIN_API_KEY || !SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json(500, { error: "Server misconfigured" });
  }

  // --- AUTH: accept either x-admin-key or admin-role JWT ---
  const provided = req.headers.get("x-admin-key");
  const authHeader = req.headers.get("Authorization") ?? "";
  let authorized = false;

  if (provided && provided === ADMIN_API_KEY) {
    authorized = true;
  } else if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      const adminCheck = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false },
      });
      const { data: profileRow } = await adminCheck
        .from("profiles")
        .select("is_admin")
        .eq("id", data.claims.sub)
        .maybeSingle();
      if (profileRow?.is_admin) authorized = true;
    }
  }

  if (!authorized) return json(401, { error: "Unauthorized" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("admin-api");
  const parts = idx >= 0 ? segments.slice(idx + 1) : segments;

  // small helper to attach emails to rows that have user_id
  const attachEmails = async <T extends { user_id: string }>(
    rows: T[],
  ): Promise<(T & { email: string | null })[]> => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const emailMap = new Map<string, string | null>();
    // listUsers paginates — for moderate scale fetch one page of 1000
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    list?.users.forEach((u) => emailMap.set(u.id, u.email ?? null));
    return rows
      .filter((r) => ids.includes(r.user_id))
      .map((r) => ({ ...r, email: emailMap.get(r.user_id) ?? null }));
  };

  try {
    // ---------- GET /stats ----------
    if (req.method === "GET" && parts[0] === "stats" && parts.length === 1) {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();

      const [profilesRes, ordersRes, purchasesRes, usageRes, recentSignupsRes] =
        await Promise.all([
          admin.from("profiles").select("id, is_activated, created_at, activated_at"),
          admin.from("activation_orders").select("id, created_at, credits_granted"),
          admin.from("credit_purchases").select("id, amount_usd, status, paid_at, created_at"),
          admin.from("usage_logs").select("id, seconds, created_at").gte("created_at", sinceIso),
          admin
            .from("profiles")
            .select("id, created_at, activated_at, is_activated")
            .gte("created_at", sinceIso),
        ]);

      const profiles = profilesRes.data ?? [];
      const orders = ordersRes.data ?? [];
      const purchases = purchasesRes.data ?? [];
      const usage = usageRes.data ?? [];

      const totalUsers = profiles.length;
      const activatedUsers = profiles.filter((p) => p.is_activated).length;
      const activationRevenue = orders.length * ACTIVATION_FEE_USD;
      const creditRevenue = purchases
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + (p.amount_usd ?? 0), 0);
      const totalRevenue = activationRevenue + creditRevenue;

      const usageSeconds30d = usage.reduce((s, u) => s + (u.seconds ?? 0), 0);
      const creditsSold30d = purchases
        .filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= sinceIso)
        .reduce((s, p) => s + (p.amount_usd ?? 0), 0);

      // Build daily series for last 30 days
      const days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }
      const series = days.map((day) => {
        const signups = (recentSignupsRes.data ?? []).filter(
          (p) => p.created_at?.slice(0, 10) === day,
        ).length;
        const activations = (recentSignupsRes.data ?? []).filter(
          (p) => p.activated_at?.slice(0, 10) === day,
        ).length;
        const dayOrders = orders.filter((o) => o.created_at?.slice(0, 10) === day);
        const dayPurchases = purchases.filter(
          (p) => p.status === "paid" && p.paid_at?.slice(0, 10) === day,
        );
        const revenue =
          dayOrders.length * ACTIVATION_FEE_USD +
          dayPurchases.reduce((s, p) => s + (p.amount_usd ?? 0), 0);
        const seconds = usage
          .filter((u) => u.created_at?.slice(0, 10) === day)
          .reduce((s, u) => s + (u.seconds ?? 0), 0);
        return { day, signups, activations, revenue, seconds };
      });

      return json(200, {
        totals: {
          totalUsers,
          activatedUsers,
          activationRate: totalUsers ? activatedUsers / totalUsers : 0,
          totalRevenue,
          activationRevenue,
          creditRevenue,
          usageSeconds30d,
          creditsSold30d,
        },
        series,
      });
    }

    // ---------- GET /users ----------
    if (req.method === "GET" && parts[0] === "users" && parts.length === 1) {
      const page = Number(url.searchParams.get("page") ?? "1");
      const perPage = Math.min(200, Number(url.searchParams.get("perPage") ?? "50"));
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("*").in("id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const rmap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = rmap.get(r.user_id) ?? [];
        arr.push(r.role);
        rmap.set(r.user_id, arr);
      });

      let users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        profile: pmap.get(u.id) ?? null,
        roles: rmap.get(u.id) ?? [],
      }));

      if (q) {
        users = users.filter((u) => {
          const p = u.profile as { display_name?: string | null; license_key?: string | null } | null;
          return (
            (u.email ?? "").toLowerCase().includes(q) ||
            (p?.display_name ?? "").toLowerCase().includes(q) ||
            (p?.license_key ?? "").toLowerCase().includes(q)
          );
        });
      }
      return json(200, { page, perPage, total: list.total, users });
    }

    // ---------- GET /users/:id ----------
    if (req.method === "GET" && parts[0] === "users" && parts.length === 2) {
      const id = parts[1];
      const { data: u, error } = await admin.auth.admin.getUserById(id);
      if (error) throw error;
      const [{ data: profile }, { data: orders }, { data: purchases }, { data: usage }, { data: roles }] =
        await Promise.all([
          admin.from("profiles").select("*").eq("id", id).maybeSingle(),
          admin
            .from("activation_orders")
            .select("*")
            .eq("user_id", id)
            .order("created_at", { ascending: false }),
          admin
            .from("credit_purchases")
            .select("*")
            .eq("user_id", id)
            .order("created_at", { ascending: false }),
          admin
            .from("usage_logs")
            .select("*")
            .eq("user_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
          admin.from("user_roles").select("role").eq("user_id", id),
        ]);
      return json(200, {
        id: u.user.id,
        email: u.user.email,
        created_at: u.user.created_at,
        last_sign_in_at: u.user.last_sign_in_at,
        profile,
        activation_orders: orders ?? [],
        credit_purchases: purchases ?? [],
        usage: usage ?? [],
        roles: (roles ?? []).map((r) => r.role),
      });
    }

    // ---------- DELETE /users/:id ----------
    if (req.method === "DELETE" && parts[0] === "users" && parts.length === 2) {
      const id = parts[1];
      await admin.from("activations").delete().eq("user_id", id);
      await admin.from("activation_orders").delete().eq("user_id", id);
      await admin.from("credit_purchases").delete().eq("user_id", id);
      await admin.from("usage_logs").delete().eq("user_id", id);
      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("profiles").delete().eq("id", id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json(200, { ok: true, deleted: id });
    }

    // ---------- POST /users/:id/credits ----------
    if (req.method === "POST" && parts[0] === "users" && parts[2] === "credits") {
      const id = parts[1];
      const body = await req.json().catch(() => ({}));
      const delta = typeof body.delta === "number" ? body.delta : null;
      const set = typeof body.set === "number" ? body.set : null;
      if (delta === null && set === null)
        return json(400, { error: "Provide `delta` or `set` (number)" });
      const { data: prof, error: pErr } = await admin
        .from("profiles")
        .select("credits")
        .eq("id", id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) return json(404, { error: "Profile not found" });
      const next = set !== null ? set : Math.max(0, (prof.credits ?? 0) + (delta ?? 0));
      const { data: updated, error: uErr } = await admin
        .from("profiles")
        .update({ credits: next })
        .eq("id", id)
        .select()
        .single();
      if (uErr) throw uErr;
      return json(200, { ok: true, credits: updated.credits });
    }

    // ---------- POST /users/:id/role ----------
    if (req.method === "POST" && parts[0] === "users" && parts[2] === "role") {
      const id = parts[1];
      const body = await req.json().catch(() => ({}));
      const role = body.role === "admin" || body.role === "user" ? body.role : null;
      const action = body.action === "add" || body.action === "remove" ? body.action : null;
      if (!role || !action) return json(400, { error: "Provide role and action" });
      if (action === "add") {
        const { error } = await admin
          .from("user_roles")
          .upsert({ user_id: id, role }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", id)
          .eq("role", role);
        if (error) throw error;
      }
      return json(200, { ok: true });
    }

    // ---------- GET /activation-orders ----------
    if (req.method === "GET" && parts[0] === "activation-orders" && parts.length === 1) {
      const limit = Math.min(500, Number(url.searchParams.get("limit") ?? "200"));
      const { data, error } = await admin
        .from("activation_orders")
        .select("id, order_id, user_id, credits_granted, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const withEmail = await attachEmails(data ?? []);
      return json(200, { orders: withEmail });
    }

    // ---------- GET /credit-purchases ----------
    if (req.method === "GET" && parts[0] === "credit-purchases" && parts.length === 1) {
      const limit = Math.min(500, Number(url.searchParams.get("limit") ?? "200"));
      const status = url.searchParams.get("status");
      let q = admin
        .from("credit_purchases")
        .select("id, user_id, plan, credits, amount_usd, status, paid_at, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      const withEmail = await attachEmails(data ?? []);
      return json(200, { purchases: withEmail });
    }

    // ---------- GET /usage/top-users ----------
    if (req.method === "GET" && parts[0] === "usage" && parts[1] === "top-users") {
      const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "20"));
      const { data, error } = await admin
        .from("usage_logs")
        .select("user_id, seconds");
      if (error) throw error;
      const totals = new Map<string, number>();
      (data ?? []).forEach((r) => {
        totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.seconds ?? 0));
      });
      const ranked = Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([user_id, seconds]) => ({ user_id, seconds }));
      const withEmail = await attachEmails(ranked);
      const ids = withEmail.map((r) => r.user_id);
      const { data: profs } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      return json(200, {
        users: withEmail.map((r) => ({ ...r, display_name: nameMap.get(r.user_id) ?? null })),
      });
    }

    // ---------- GET /usage/recent ----------
    if (req.method === "GET" && parts[0] === "usage" && parts[1] === "recent") {
      const limit = Math.min(500, Number(url.searchParams.get("limit") ?? "100"));
      const { data, error } = await admin
        .from("usage_logs")
        .select("id, user_id, seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const withEmail = await attachEmails(data ?? []);
      return json(200, { logs: withEmail });
    }

    return json(404, { error: "Not found", path: parts });
  } catch (e) {
    console.error("admin-api error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: msg });
  }
});
