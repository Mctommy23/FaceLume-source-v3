import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Users as UsersIcon,
  CheckCircle2,
  Activity,
  DollarSign,
  TrendingUp,
  Wallet,
  RefreshCw,
  Search,
  ArrowLeft,
  Coins,
  ShieldOff,
  Webhook,
  AlertTriangle,
  Info,
  Bell,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatCard } from "@/components/admin/StatCard";

const ACTIVATION_FEE = 50;

const fmt = new Intl.NumberFormat();
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

// View row types (mirrors the SQL views; some numeric columns come back as strings from PostgREST).
type UserStat = {
  user_id: string;
  display_name: string | null;
  is_activated: boolean;
  is_admin: boolean;
  credits: number;
  joined_at: string;
  activated_at: string | null;
  total_seconds: number;
  sessions: number;
  activation_orders: number;
  activation_revenue: number;
  credits_revenue: number;
  total_revenue: number;
  estimated_cost: number;
  estimated_profit: number;
};
type DailyMetric = {
  day: string;
  signups: number;
  activations: number;
  usage_seconds: number;
  estimated_cost: number;
  revenue: number;
  profit: number;
};
type RevenueSummary = {
  activations_count: number;
  activation_revenue: number;
  credits_revenue: number;
  total_revenue: number;
  total_seconds: number;
  estimated_cost: number;
};
type AlertRow = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  created_at: string;
  user_id: string | null;
  source: string;
};
type ActivationOrder = {
  id: string;
  order_id: string;
  user_id: string;
  credits_granted: number;
  created_at: string;
};
type CreditPurchase = {
  id: string;
  user_id: string;
  plan: string;
  credits: number;
  amount_usd: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStat[]>([]);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [orders, setOrders] = useState<ActivationOrder[]>([]);
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [emails, setEmails] = useState<Record<string, string | null>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("admin-dismissed-alerts") ?? "[]"));
    } catch {
      return new Set();
    }
  });

  const [userFilter, setUserFilter] = useState("");
  const [creditsTarget, setCreditsTarget] = useState<UserStat | null>(null);
  const [creditsValue, setCreditsValue] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<UserStat | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, r, a, o, c] = await Promise.all([
        supabase.from("admin_user_stats").select("*").order("estimated_profit", { ascending: false }),
        supabase.from("admin_daily_metrics").select("*").order("day"),
        supabase.from("admin_revenue_summary").select("*").maybeSingle(),
        supabase.from("admin_alerts").select("*").order("created_at", { ascending: false }),
        supabase
          .from("activation_orders")
          .select("id, order_id, user_id, credits_granted, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("credit_purchases")
          .select("id, user_id, plan, credits, amount_usd, status, paid_at, created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (s.error) throw s.error;
      if (d.error) throw d.error;
      if (r.error) throw r.error;
      if (a.error) throw a.error;
      if (o.error) throw o.error;
      if (c.error) throw c.error;

      // Cast numeric strings -> numbers
      const cleanStats = (s.data ?? []).map((row) => ({
        ...row,
        total_seconds: num(row.total_seconds),
        sessions: num(row.sessions),
        activation_orders: num(row.activation_orders),
        activation_revenue: num(row.activation_revenue),
        credits_revenue: num(row.credits_revenue),
        total_revenue: num(row.total_revenue),
        estimated_cost: num(row.estimated_cost),
        estimated_profit: num(row.estimated_profit),
      })) as UserStat[];
      const cleanDaily = (d.data ?? []).map((row) => ({
        ...row,
        signups: num(row.signups),
        activations: num(row.activations),
        usage_seconds: num(row.usage_seconds),
        estimated_cost: num(row.estimated_cost),
        revenue: num(row.revenue),
        profit: num(row.profit),
      })) as DailyMetric[];

      setStats(cleanStats);
      setDaily(cleanDaily);
      setSummary(
        r.data
          ? ({
              ...r.data,
              activations_count: num(r.data.activations_count),
              activation_revenue: num(r.data.activation_revenue),
              credits_revenue: num(r.data.credits_revenue),
              total_revenue: num(r.data.total_revenue),
              total_seconds: num(r.data.total_seconds),
              estimated_cost: num(r.data.estimated_cost),
            } as RevenueSummary)
          : null,
      );
      setAlerts((a.data ?? []) as AlertRow[]);
      setOrders(o.data ?? []);
      setPurchases(c.data ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pull emails via the admin-api edge function
  useEffect(() => {
    if (!stats.length) return;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const res = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-api/users?perPage=200`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { users: { id: string; email: string | null }[] };
        const map: Record<string, string | null> = {};
        body.users.forEach((u) => {
          map[u.id] = u.email;
        });
        setEmails(map);
      } catch {
        /* best effort */
      }
    })();
  }, [stats.length]);

  const totals = useMemo(() => {
    const totalUsers = stats.length;
    const activatedUsers = stats.filter((s) => s.is_activated).length;
    const totalSeconds = summary?.total_seconds ?? 0;
    const estimatedCost = summary?.estimated_cost ?? 0;
    const estimatedRevenue = summary?.total_revenue ?? 0;
    const estimatedProfit = estimatedRevenue - estimatedCost;
    return { totalUsers, activatedUsers, totalSeconds, estimatedCost, estimatedRevenue, estimatedProfit };
  }, [stats, summary]);

  const filteredUsers = useMemo(() => {
    if (!userFilter.trim()) return stats;
    const q = userFilter.toLowerCase();
    return stats.filter(
      (p) =>
        (emails[p.user_id] ?? "").toLowerCase().includes(q) ||
        (p.display_name ?? "").toLowerCase().includes(q),
    );
  }, [stats, userFilter, emails]);

  const visibleAlerts = useMemo(() => alerts.filter((a) => !dismissed.has(a.id)), [alerts, dismissed]);
  const criticalCount = visibleAlerts.filter((a) => a.severity === "critical").length;

  const grantCredits = async () => {
    if (!creditsTarget) return;
    const n = Number(creditsValue);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero number");
      return;
    }
    setBusyId(creditsTarget.user_id);
    try {
      const next = Math.max(0, (creditsTarget.credits ?? 0) + n);
      const { error } = await supabase
        .from("profiles")
        .update({ credits: next })
        .eq("id", creditsTarget.user_id);
      if (error) throw error;
      toast.success(`Credits ${n > 0 ? "granted" : "deducted"}`);
      setCreditsTarget(null);
      setCreditsValue("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const deactivateUser = async () => {
    if (!deactivateTarget) return;
    setBusyId(deactivateTarget.user_id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_activated: false })
        .eq("id", deactivateTarget.user_id);
      if (error) throw error;
      toast.success("User deactivated");
      setDeactivateTarget(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const dismissAlert = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("admin-dismissed-alerts", JSON.stringify([...next]));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <title>Admin Dashboard — FaceLume</title>
      <meta name="description" content="Internal admin dashboard with charts, alerts and per-user profit." />

      <div className="min-h-screen relative bg-background">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

        <main className="relative container max-w-7xl py-10 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground mb-3"
              >
                <ArrowLeft className="w-3 h-3" /> Back to app
              </Link>
              <h1 className="font-display font-black text-3xl md:text-4xl">
                Admin <span className="neon-text">Dashboard</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {totals.totalUsers} users · {totals.activatedUsers} activated ·{" "}
                {usd.format(totals.estimatedRevenue)} revenue · {usd.format(totals.estimatedProfit)} profit
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/admin/webhook-logs">
                <Button variant="glass">
                  <Webhook className="w-4 h-4" /> Webhook logs
                </Button>
              </Link>
              <Button variant="glass" onClick={load}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-background/40 border border-border/60">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="alerts" className="relative">
                Alerts
                {visibleAlerts.length > 0 && (
                  <Badge
                    className={`ml-2 h-5 px-1.5 text-[10px] ${
                      criticalCount > 0
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary/30 text-primary"
                    }`}
                  >
                    {visibleAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="activations">Activations</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            {/* ---------------- OVERVIEW ---------------- */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total users" value={fmt.format(totals.totalUsers)} icon={UsersIcon} />
                <StatCard
                  label="Activated users"
                  value={fmt.format(totals.activatedUsers)}
                  hint={
                    totals.totalUsers
                      ? `${((totals.activatedUsers / totals.totalUsers) * 100).toFixed(1)}% activation rate`
                      : undefined
                  }
                  icon={CheckCircle2}
                />
                <StatCard
                  label="Total usage (seconds)"
                  value={fmt.format(totals.totalSeconds)}
                  hint={`${fmt.format(Math.round(totals.totalSeconds / 60))} minutes`}
                  icon={Activity}
                />
                <StatCard
                  label="Estimated cost"
                  value={usd.format(totals.estimatedCost)}
                  hint="@ $0.02 / second"
                  icon={Wallet}
                />
                <StatCard
                  label="Estimated revenue"
                  value={usd.format(totals.estimatedRevenue)}
                  hint={`${summary?.activations_count ?? 0} activations`}
                  icon={DollarSign}
                  accent
                />
                <StatCard
                  label="Estimated profit"
                  value={usd.format(totals.estimatedProfit)}
                  hint={
                    totals.estimatedRevenue
                      ? `${((totals.estimatedProfit / totals.estimatedRevenue) * 100).toFixed(1)}% margin`
                      : undefined
                  }
                  icon={TrendingUp}
                  accent
                />
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6">
                <ChartCard title="Signups vs activations · 60d">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="signups" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="activations" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Daily revenue · 60d">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => usd.format(v)} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Daily profit · 60d (revenue − cost)">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={daily}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => usd.format(v)} />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#profitGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Daily usage seconds · 60d">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="usage_seconds" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* ---------------- ALERTS ---------------- */}
            <TabsContent value="alerts" className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-display font-bold text-xl flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" /> Alerts
                  <span className="text-muted-foreground text-sm font-mono">
                    ({visibleAlerts.length} active{dismissed.size > 0 && ` · ${dismissed.size} dismissed`})
                  </span>
                </h2>
                {dismissed.size > 0 && (
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => {
                      setDismissed(new Set());
                      localStorage.removeItem("admin-dismissed-alerts");
                    }}
                  >
                    Restore dismissed
                  </Button>
                )}
              </div>
              {visibleAlerts.length === 0 ? (
                <div className="glass-strong rounded-2xl p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-primary" />
                  All clear — no active alerts.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleAlerts.map((a) => (
                    <AlertCard
                      key={a.id}
                      alert={a}
                      email={a.user_id ? emails[a.user_id] ?? null : null}
                      onDismiss={() => dismissAlert(a.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ---------------- USERS (now with profit) ---------------- */}
            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <h2 className="font-display font-bold text-xl">
                  Users <span className="text-muted-foreground text-sm font-mono">({filteredUsers.length})</span>
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="Filter by email or name..."
                    className="pl-9 w-72 bg-background/40 border-border/60 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="glass-strong rounded-2xl overflow-hidden">
                {filteredUsers.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No users</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-background/30 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3">Email</th>
                          <th className="text-right px-4 py-3">Credits</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-right px-4 py-3">Revenue</th>
                          <th className="text-right px-4 py-3">Cost</th>
                          <th className="text-right px-4 py-3">Profit</th>
                          <th className="text-right px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredUsers.map((p) => (
                          <tr key={p.user_id} className="hover:bg-background/30">
                            <td className="px-4 py-3">
                              <div className="font-medium">{emails[p.user_id] ?? "—"}</div>
                              {p.display_name && (
                                <div className="text-xs text-muted-foreground">{p.display_name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{p.credits}</td>
                            <td className="px-4 py-3">
                              {p.is_activated ? (
                                <Badge className="bg-primary/20 text-primary border-primary/40">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-primary-glow">
                              {usd.format(p.total_revenue)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                              {usd.format(p.estimated_cost)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono font-bold ${
                                p.estimated_profit >= 0 ? "text-primary" : "text-destructive"
                              }`}
                            >
                              {usd.format(p.estimated_profit)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-2">
                                <Button
                                  variant="glass"
                                  size="sm"
                                  onClick={() => {
                                    setCreditsTarget(p);
                                    setCreditsValue("");
                                  }}
                                  disabled={busyId === p.user_id}
                                >
                                  <Coins className="w-3.5 h-3.5" /> Grant
                                </Button>
                                <Button
                                  variant="glass"
                                  size="sm"
                                  onClick={() => setDeactivateTarget(p)}
                                  disabled={busyId === p.user_id || !p.is_activated}
                                >
                                  <ShieldOff className="w-3.5 h-3.5" /> Deactivate
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---------------- ACTIVATIONS ---------------- */}
            <TabsContent value="activations" className="space-y-4">
              <h2 className="font-display font-bold text-xl">
                Activation orders{" "}
                <span className="text-muted-foreground text-sm font-mono">({orders.length})</span>
              </h2>
              <div className="glass-strong rounded-2xl overflow-hidden">
                {orders.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No activations yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-background/30 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Order ID</th>
                          <th className="text-left px-4 py-3">Email</th>
                          <th className="text-right px-4 py-3">Credits granted</th>
                          <th className="text-right px-4 py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-background/30">
                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                              {new Date(o.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs break-all">{o.order_id}</td>
                            <td className="px-4 py-3">{emails[o.user_id] ?? o.user_id.slice(0, 8)}</td>
                            <td className="px-4 py-3 text-right font-mono">{o.credits_granted}</td>
                            <td className="px-4 py-3 text-right font-mono text-primary-glow">
                              {usd.format(ACTIVATION_FEE)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---------------- CREDITS ---------------- */}
            <TabsContent value="credits" className="space-y-4">
              <h2 className="font-display font-bold text-xl">
                Credit purchases{" "}
                <span className="text-muted-foreground text-sm font-mono">({purchases.length})</span>
              </h2>
              <div className="glass-strong rounded-2xl overflow-hidden">
                {purchases.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No purchases yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-background/30 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Email</th>
                          <th className="text-left px-4 py-3">Plan</th>
                          <th className="text-right px-4 py-3">Credits</th>
                          <th className="text-right px-4 py-3">Amount</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Paid at</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-background/30">
                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                              {new Date(p.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">{emails[p.user_id] ?? p.user_id.slice(0, 8)}</td>
                            <td className="px-4 py-3 font-mono text-xs">{p.plan}</td>
                            <td className="px-4 py-3 text-right font-mono">{p.credits}</td>
                            <td className="px-4 py-3 text-right font-mono text-primary-glow">
                              {usd.format(p.amount_usd)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                className={
                                  p.status === "paid"
                                    ? "bg-primary/20 text-primary border-primary/40"
                                    : p.status === "failed"
                                    ? "bg-destructive/20 text-destructive border-destructive/40"
                                    : ""
                                }
                                variant={p.status === "paid" ? "default" : "secondary"}
                              >
                                {p.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                              {p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---------------- USAGE ---------------- */}
            <TabsContent value="usage" className="space-y-4">
              <h2 className="font-display font-bold text-xl">
                Usage by user{" "}
                <span className="text-muted-foreground text-sm font-mono">({stats.length})</span>
              </h2>
              <div className="glass-strong rounded-2xl overflow-hidden">
                {stats.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No usage yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-background/30 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3">User</th>
                          <th className="text-left px-4 py-3">User ID</th>
                          <th className="text-right px-4 py-3">Total seconds</th>
                          <th className="text-right px-4 py-3">Sessions</th>
                          <th className="text-right px-4 py-3">Est. cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {[...stats]
                          .sort((a, b) => b.total_seconds - a.total_seconds)
                          .map((u) => (
                            <tr key={u.user_id} className="hover:bg-background/30">
                              <td className="px-4 py-3">{emails[u.user_id] ?? "—"}</td>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {u.user_id.slice(0, 8)}…
                              </td>
                              <td className="px-4 py-3 text-right font-mono">{fmt.format(u.total_seconds)}</td>
                              <td className="px-4 py-3 text-right font-mono">{u.sessions}</td>
                              <td className="px-4 py-3 text-right font-mono text-primary-glow">
                                {usd.format(u.estimated_cost)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Grant credits dialog */}
      <Dialog open={!!creditsTarget} onOpenChange={(o) => !o && setCreditsTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {emails[creditsTarget?.user_id ?? ""] ?? creditsTarget?.user_id} · current balance:{" "}
              <span className="font-mono">{creditsTarget?.credits ?? 0}</span>
            </p>
            <div>
              <Label className="mb-2 block text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Amount (use negative to deduct)
              </Label>
              <Input
                type="number"
                value={creditsValue}
                onChange={(e) => setCreditsValue(e.target.value)}
                placeholder="e.g. 100"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="glass" onClick={() => setCreditsTarget(null)}>Cancel</Button>
            <Button variant="hero" onClick={grantCredits} disabled={busyId === creditsTarget?.user_id}>
              {busyId === creditsTarget?.user_id && <Loader2 className="w-4 h-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {emails[deactivateTarget?.user_id ?? ""] ?? deactivateTarget?.user_id} will lose access
              to the studio until they reactivate. Their credits and history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deactivateUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const tooltipStyle = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="glass-strong rounded-2xl p-5">
    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
      {title}
    </div>
    {children}
  </div>
);

const AlertCard = ({
  alert,
  email,
  onDismiss,
}: {
  alert: AlertRow;
  email: string | null;
  onDismiss: () => void;
}) => {
  const styles =
    alert.severity === "critical"
      ? {
          border: "border-destructive/50",
          bg: "bg-destructive/5",
          icon: <AlertTriangle className="w-5 h-5 text-destructive" />,
          badge: "bg-destructive text-destructive-foreground",
        }
      : alert.severity === "warning"
      ? {
          border: "border-secondary/50",
          bg: "bg-secondary/5",
          icon: <AlertTriangle className="w-5 h-5 text-secondary" />,
          badge: "bg-secondary/30 text-secondary",
        }
      : {
          border: "border-border",
          bg: "bg-background/30",
          icon: <Info className="w-5 h-5 text-muted-foreground" />,
          badge: "bg-muted text-muted-foreground",
        };

  return (
    <div className={`glass-strong rounded-xl border ${styles.border} ${styles.bg} p-4 flex gap-4`}>
      <div className="shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-bold">{alert.title}</span>
          <Badge className={`text-[10px] font-mono uppercase ${styles.badge}`}>{alert.severity}</Badge>
          <Badge variant="outline" className="text-[10px] font-mono">{alert.source}</Badge>
        </div>
        <p className="text-sm text-muted-foreground break-words">{alert.message}</p>
        <div className="text-xs font-mono text-muted-foreground">
          {new Date(alert.created_at).toLocaleString()}
          {email && <> · {email}</>}
        </div>
      </div>
      <Button variant="glass" size="sm" onClick={onDismiss} className="shrink-0">
        Dismiss
      </Button>
    </div>
  );
};

export default Admin;
