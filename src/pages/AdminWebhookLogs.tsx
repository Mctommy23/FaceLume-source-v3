import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type WebhookLog = {
  id: string;
  received_at: string;
  order_id: string | null;
  status: string | null;
  signature_valid: boolean;
  signature_header: string | null;
  response_code: number | null;
  error_message: string | null;
  payload: unknown;
  source_ip: string | null;
};

const PAGE_SIZE = 50;

const AdminWebhookLogs = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [fetching, setFetching] = useState(false);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/get-started", { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) toast.error(error.message);
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user, loading, navigate]);

  const loadLogs = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("atlos_webhook_logs")
      .select(
        "id, received_at, order_id, status, signature_valid, signature_header, response_code, error_message, payload, source_ip",
      )
      .order("received_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) toast.error(error.message);
    else setLogs(data as WebhookLog[]);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) loadLogs();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(
      (l) =>
        l.order_id?.toLowerCase().includes(q) ||
        l.status?.toLowerCase().includes(q) ||
        l.error_message?.toLowerCase().includes(q) ||
        l.source_ip?.toLowerCase().includes(q),
    );
  }, [logs, filter]);

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <title>Access denied — FaceLume Admin</title>
        <div className="min-h-screen relative">
          
          <main className="relative pt-28 pb-16 container max-w-md">
            <div className="glass-strong rounded-2xl p-8 text-center space-y-4">
              <div className="inline-flex p-3 rounded-full bg-destructive/15 border border-destructive/30">
                <ShieldAlert className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="font-display font-bold text-2xl">Admins only</h1>
              <p className="text-sm text-muted-foreground">
                You need the <span className="font-mono">admin</span> role to view webhook logs.
              </p>
              <Button onClick={() => navigate("/")} variant="glass">
                Back to home
              </Button>
            </div>
          </main>
        </div>
      </>
    );
  }

  const okCount = filtered.filter((l) => l.signature_valid && (l.response_code ?? 0) < 400).length;
  const failCount = filtered.length - okCount;

  return (
    <>
      <title>Atlos Webhook Logs — FaceLume Admin</title>
      <meta
        name="description"
        content="Admin-only viewer for Atlos webhook deliveries: order ID, payment status, and signature verification result."
      />

      <div className="min-h-screen relative">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <main className="relative pt-28 pb-16 container max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <p className="text-sm font-mono text-muted-foreground tracking-widest uppercase mb-2">
                Admin · Payments
              </p>
              <h1 className="font-display font-black text-3xl md:text-4xl">
                Atlos Webhook <span className="neon-text">Logs</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Last {PAGE_SIZE} deliveries · {okCount} ok · {failCount} failed
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter order, status, error..."
                  className="pl-9 bg-background/40 border-border/60 w-64 font-mono text-sm"
                />
              </div>
              <Button onClick={loadLogs} variant="glass" disabled={fetching}>
                {fetching ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
            <div className="relative glass-strong rounded-2xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  {fetching ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    <>No webhook deliveries{filter ? " match this filter" : " yet"}.</>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="hidden md:grid grid-cols-[24px_180px_1fr_120px_90px_120px_1fr] gap-3 px-5 py-3 text-xs font-mono uppercase tracking-widest text-muted-foreground bg-background/30">
                    <span />
                    <span>Received</span>
                    <span>Order ID</span>
                    <span>Status</span>
                    <span>HTTP</span>
                    <span>Signature</span>
                    <span>Error</span>
                  </div>
                  {filtered.map((log) => {
                    const isOpen = expanded.has(log.id);
                    const httpOk = (log.response_code ?? 0) < 400;
                    return (
                      <div key={log.id} className="text-sm">
                        <button
                          onClick={() => toggleRow(log.id)}
                          className="w-full grid grid-cols-[24px_180px_1fr_120px_90px_120px_1fr] gap-3 px-5 py-3 items-center hover:bg-background/30 transition-colors text-left"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(log.received_at).toLocaleString()}
                          </span>
                          <span className="font-mono text-xs text-foreground truncate">
                            {log.order_id ?? "—"}
                          </span>
                          <span>
                            {log.status ? (
                              <Badge variant="secondary" className="font-mono">
                                {log.status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                          <Badge
                            variant={httpOk ? "default" : "destructive"}
                            className="font-mono w-fit"
                          >
                            {log.response_code ?? "—"}
                          </Badge>
                          <span>
                            {log.signature_valid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-primary font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5" /> valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-destructive font-mono">
                                <XCircle className="w-3.5 h-3.5" /> invalid
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-destructive/90 truncate">
                            {log.error_message ?? ""}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-5 pt-1 bg-background/20 space-y-3">
                            <DetailRow
                              label="Order ID"
                              value={log.order_id ?? "—"}
                              onCopy={
                                log.order_id ? () => copy(log.order_id!, "Order ID") : undefined
                              }
                            />
                            <DetailRow
                              label="Source IP"
                              value={log.source_ip ?? "—"}
                            />
                            <DetailRow
                              label="Signature header"
                              value={log.signature_header ?? "—"}
                              onCopy={
                                log.signature_header
                                  ? () => copy(log.signature_header!, "Signature")
                                  : undefined
                              }
                            />
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                                  Payload
                                </span>
                                <Button
                                  size="sm"
                                  variant="glass"
                                  onClick={() =>
                                    copy(JSON.stringify(log.payload, null, 2), "Payload")
                                  }
                                >
                                  <Copy className="w-3.5 h-3.5" /> Copy JSON
                                </Button>
                              </div>
                              <pre className="font-mono text-xs bg-background/60 border border-border/60 rounded-lg p-3 overflow-x-auto max-h-80">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

const DetailRow = ({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-mono text-xs text-foreground break-all text-right">{value}</span>
      {onCopy && (
        <Button size="icon" variant="glass" className="h-7 w-7 shrink-0" onClick={onCopy}>
          <Copy className="w-3 h-3" />
        </Button>
      )}
    </div>
  </div>
);

export default AdminWebhookLogs;
