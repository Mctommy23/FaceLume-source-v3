import { memo, useEffect, useState } from "react";
import { Activity, Wifi, Gauge, AlertTriangle, Zap, Radio, Signal } from "lucide-react";
import type { RealTimeClient } from "@decartai/sdk";
import { cn } from "@/lib/utils";

type Status = "idle" | "connecting" | "active" | "streaming";

type StreamStats = {
  rttMs: number | null;
  fps: number | null;
  bitrateKbps: number | null;
  packetsLostDelta: number;
  freezeCountDelta: number;
  qualityLimitation: string | null;
  resolution: { w: number; h: number } | null;
  jitterMs: number | null;
};

const EMPTY: StreamStats = {
  rttMs: null,
  fps: null,
  bitrateKbps: null,
  packetsLostDelta: 0,
  freezeCountDelta: 0,
  qualityLimitation: null,
  resolution: null,
  jitterMs: null,
};

type ConnectionTier = "excellent" | "good" | "fair" | "poor" | "offline";

const tierFromStats = (status: Status, s: StreamStats): ConnectionTier => {
  if (status === "idle") return "offline";
  if (status === "connecting" || status === "active") return "fair";
  if (s.rttMs == null || s.fps == null) return "fair";
  const rtt = s.rttMs ?? 999;
  const lost = s.packetsLostDelta;
  const fps = s.fps ?? 0;
  if (rtt < 80 && lost === 0 && fps >= 20) return "excellent";
  if (rtt < 150 && lost <= 2 && fps >= 15) return "good";
  if (rtt < 300 && lost <= 8 && fps >= 10) return "fair";
  return "poor";
};

const tierMeta: Record<ConnectionTier, { label: string; dot: string; text: string; bg: string; border: string }> = {
  excellent: {
    label: "EXCELLENT",
    dot: "bg-secondary",
    text: "text-secondary",
    bg: "bg-secondary/10",
    border: "border-secondary/50",
  },
  good: {
    label: "GOOD",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/50",
  },
  fair: {
    label: "FAIR",
    dot: "bg-yellow-400",
    text: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/50",
  },
  poor: {
    label: "POOR",
    dot: "bg-destructive",
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/50",
  },
  offline: {
    label: "OFFLINE",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-border",
  },
};

interface Props {
  realtime: RealTimeClient | null;
  status: Status;
  className?: string;
  compact?: boolean;
}

const StreamQualityPanelImpl = ({ realtime, status, className, compact = false }: Props) => {
  const [stats, setStats] = useState<StreamStats>(EMPTY);

  // Reset when stream goes idle
  useEffect(() => {
    if (status === "idle") setStats(EMPTY);
  }, [status]);

  // Subscribe to SDK stats events
  useEffect(() => {
    if (!realtime) return;
    const handler = (s: Parameters<Parameters<RealTimeClient["on"]>[1]>[0] & { video: unknown; connection: unknown }) => {
      // Type-narrow against the SDK's WebRTCStats shape
      const v = (s as { video: { framesPerSecond: number; frameWidth: number; frameHeight: number; bitrate: number; packetsLostDelta: number; freezeCountDelta: number; jitter: number } | null }).video;
      const c = (s as { connection: { currentRoundTripTime: number | null } }).connection;
      const o = (s as { outboundVideo: { qualityLimitationReason: string } | null }).outboundVideo;
      setStats({
        rttMs: c.currentRoundTripTime != null ? Math.round(c.currentRoundTripTime * 1000) : null,
        fps: v ? Math.round(v.framesPerSecond) : null,
        bitrateKbps: v ? Math.round(v.bitrate / 1000) : null,
        packetsLostDelta: v?.packetsLostDelta ?? 0,
        freezeCountDelta: v?.freezeCountDelta ?? 0,
        qualityLimitation: o?.qualityLimitationReason && o.qualityLimitationReason !== "none" ? o.qualityLimitationReason : null,
        resolution: v ? { w: v.frameWidth, h: v.frameHeight } : null,
        jitterMs: v ? Math.round((v.jitter ?? 0) * 1000) : null,
      });
    };
    realtime.on("stats", handler as Parameters<RealTimeClient["on"]>[1]);
    return () => {
      realtime.off("stats", handler as Parameters<RealTimeClient["on"]>[1]);
    };
  }, [realtime]);

  const tier = tierFromStats(status, stats);
  const t = tierMeta[tier];
  const showLive = status === "streaming" || status === "active";

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-md border border-border/50 bg-card/40 backdrop-blur-md text-[11px] font-mono",
          className,
        )}
      >
        <div className="flex items-center gap-1.5">
          <Signal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="tracking-widest text-muted-foreground">QUALITY</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 rounded border tracking-widest",
            t.border, t.bg, t.text,
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} />
          {t.label}
        </div>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Wifi className="w-3 h-3" />
          <span className={cn("tabular-nums", stats.rttMs != null && (stats.rttMs < 100 ? "text-secondary" : stats.rttMs < 250 ? "text-yellow-400" : "text-destructive"))}>
            {showLive && stats.rttMs != null ? `${stats.rttMs}ms` : "—"}
          </span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Activity className="w-3 h-3" />
          <span className={cn("tabular-nums", stats.fps != null && (stats.fps >= 20 ? "text-secondary" : stats.fps >= 12 ? "text-yellow-400" : "text-destructive"))}>
            {showLive && stats.fps != null ? `${stats.fps} fps` : "—"}
          </span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Gauge className="w-3 h-3" />
          <span className="tabular-nums text-foreground">
            {showLive && stats.bitrateKbps != null
              ? `${formatBitrate(stats.bitrateKbps)}${stats.bitrateKbps >= 1000 ? "Mbps" : "kbps"}`
              : "—"}
          </span>
        </span>
        <span className="text-muted-foreground tabular-nums hidden md:inline">
          {stats.resolution ? `${stats.resolution.w}×${stats.resolution.h}` : "—"}
        </span>
        <span className="text-muted-foreground tabular-nums hidden md:inline">
          JIT {stats.jitterMs != null ? `${stats.jitterMs}ms` : "—"}
        </span>
        <span className={cn("text-muted-foreground tabular-nums hidden md:inline", stats.packetsLostDelta > 0 && "text-yellow-400")}>
          LOSS {showLive ? stats.packetsLostDelta : 0}
        </span>
        {showLive && stats.qualityLimitation && (
          <span className="flex items-center gap-1 text-yellow-400 ml-auto">
            <Zap className="w-3 h-3" /> {stats.qualityLimitation}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Signal className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground">STREAM QUALITY</h3>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1 rounded-md border text-[11px] font-mono tracking-widest",
            t.border,
            t.bg,
            t.text,
          )}
          aria-live="polite"
          role="status"
        >
          <span className="relative flex w-2 h-2">
            <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", t.dot, status === "idle" && "hidden")} />
            <span className={cn("relative w-2 h-2 rounded-full", t.dot)} />
          </span>
          {t.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric
          icon={<Wifi className="w-3.5 h-3.5" />}
          label="LATENCY"
          value={showLive && stats.rttMs != null ? `${stats.rttMs}` : "—"}
          unit="ms"
          tone={stats.rttMs == null ? "neutral" : stats.rttMs < 100 ? "good" : stats.rttMs < 250 ? "warn" : "bad"}
        />
        <Metric
          icon={<Activity className="w-3.5 h-3.5" />}
          label="FPS"
          value={showLive && stats.fps != null ? `${stats.fps}` : "—"}
          unit=""
          tone={stats.fps == null ? "neutral" : stats.fps >= 20 ? "good" : stats.fps >= 12 ? "warn" : "bad"}
        />
        <Metric
          icon={<Gauge className="w-3.5 h-3.5" />}
          label="BITRATE"
          value={showLive && stats.bitrateKbps != null ? formatBitrate(stats.bitrateKbps) : "—"}
          unit={showLive && stats.bitrateKbps != null ? (stats.bitrateKbps >= 1000 ? "Mbps" : "kbps") : ""}
          tone="neutral"
        />
      </div>

      {/* Secondary line */}
      <div className="mt-3 flex items-center justify-between gap-4 text-[11px] font-mono text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <Radio className="w-3 h-3" />
          {stats.resolution ? `${stats.resolution.w}×${stats.resolution.h}` : "—"}
        </span>
        <span className="flex items-center gap-1.5">
          JITTER · {stats.jitterMs != null ? `${stats.jitterMs}ms` : "—"}
        </span>
        <span className={cn("flex items-center gap-1.5", stats.packetsLostDelta > 0 && "text-yellow-400")}>
          LOSS · {showLive ? stats.packetsLostDelta : 0}
        </span>
      </div>

      {/* Warnings */}
      {showLive && stats.qualityLimitation && (
        <div className="mt-3 flex items-start gap-2 text-[11px] font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/40 rounded-md px-2 py-1.5">
          <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Encoder limited by <strong className="uppercase">{stats.qualityLimitation}</strong>
            {stats.qualityLimitation === "bandwidth" && " — try lowering quality or check your network."}
            {stats.qualityLimitation === "cpu" && " — close other heavy apps to free CPU."}
          </span>
        </div>
      )}
      {showLive && stats.freezeCountDelta > 0 && (
        <div className="mt-2 flex items-start gap-2 text-[11px] font-mono text-destructive bg-destructive/10 border border-destructive/40 rounded-md px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Video froze {stats.freezeCountDelta}× in the last sample window.</span>
        </div>
      )}
    </div>
  );
};

export const StreamQualityPanel = memo(StreamQualityPanelImpl);

const formatBitrate = (kbps: number) => (kbps >= 1000 ? (kbps / 1000).toFixed(1) : `${kbps}`);

const toneClasses: Record<"good" | "warn" | "bad" | "neutral", string> = {
  good: "text-secondary",
  warn: "text-yellow-400",
  bad: "text-destructive",
  neutral: "text-foreground",
};

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

const Metric = ({ icon, label, value, unit, tone }: MetricProps) => (
  <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <div className={cn("font-mono text-lg leading-none tabular-nums", toneClasses[tone])}>
      {value}
      {unit && <span className="text-xs ml-1 text-muted-foreground">{unit}</span>}
    </div>
  </div>
);
