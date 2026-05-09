import { useEffect, useRef, useState } from "react";
import { Activity, Wifi, Gauge, Zap, CheckCircle2, AlertTriangle, Loader2, FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * OBS Connection Test
 *
 * Runs a short (~10s) local loopback WebRTC test using the user's
 * webcam: a single RTCPeerConnection sends a 1280x720 stream to a
 * paired local RTCPeerConnection and we sample getStats() to estimate
 * latency (RTT), FPS stability, and outbound bandwidth.
 *
 * This is intentionally provider-agnostic — it does not contact Decart
 * or any backend, so it can be run any time to validate OBS-readiness.
 */

const TEST_DURATION_MS = 10_000;
const SAMPLE_INTERVAL_MS = 500;

type Phase = "idle" | "preparing" | "running" | "done" | "error";

type Sample = {
  t: number;
  fps: number | null;
  bitrateKbps: number | null;
  rttMs: number | null;
};

type Result = {
  avgFps: number;
  fpsStdDev: number;
  fpsStability: number; // 0..1, higher is better
  avgRttMs: number | null;
  peakBitrateKbps: number;
  avgBitrateKbps: number;
  recommendedUploadKbps: number;
  packetsLost: number;
  verdict: "excellent" | "good" | "marginal" | "poor";
};

const verdictMeta: Record<Result["verdict"], { label: string; tone: string; tip: string }> = {
  excellent: {
    label: "EXCELLENT",
    tone: "text-secondary border-secondary/50 bg-secondary/10",
    tip: "Your machine and network look ready for live OBS streaming.",
  },
  good: {
    label: "GOOD",
    tone: "text-primary border-primary/50 bg-primary/10",
    tip: "You should be able to stream reliably. Close heavy apps for best results.",
  },
  marginal: {
    label: "MARGINAL",
    tone: "text-yellow-400 border-yellow-400/50 bg-yellow-400/10",
    tip: "Streaming will work but may stutter — try a wired connection or lower resolution.",
  },
  poor: {
    label: "POOR",
    tone: "text-destructive border-destructive/50 bg-destructive/10",
    tip: "Network or hardware likely insufficient — check your upload speed and CPU load.",
  },
};

export const OBSConnectionTest = () => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pc1Ref = useRef<RTCPeerConnection | null>(null);
  const pc2Ref = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const startedAtRef = useRef<number>(0);

  const cleanup = () => {
    if (samplerRef.current) {
      window.clearInterval(samplerRef.current);
      samplerRef.current = null;
    }
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    pc1Ref.current?.getSenders().forEach((s) => s.track?.stop());
    pc1Ref.current?.close();
    pc2Ref.current?.close();
    pc1Ref.current = null;
    pc2Ref.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Stop test if dialog closes mid-run
  useEffect(() => {
    if (!open && phase === "running") {
      cleanup();
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => cleanup(), []);

  const resetState = () => {
    setSamples([]);
    samplesRef.current = [];
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const computeResult = (collected: Sample[]): Result => {
    const fpsValues = collected.map((s) => s.fps).filter((v): v is number => v != null && v > 0);
    const rttValues = collected.map((s) => s.rttMs).filter((v): v is number => v != null);
    const bitrateValues = collected.map((s) => s.bitrateKbps).filter((v): v is number => v != null && v > 0);

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const stdDev = (xs: number[]) => {
      if (xs.length < 2) return 0;
      const m = avg(xs);
      return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
    };

    const avgFps = avg(fpsValues);
    const fpsStdDev = stdDev(fpsValues);
    const fpsStability = avgFps > 0 ? Math.max(0, Math.min(1, 1 - fpsStdDev / avgFps)) : 0;
    const avgRttMs = rttValues.length ? avg(rttValues) : null;
    const peakBitrateKbps = bitrateValues.length ? Math.max(...bitrateValues) : 0;
    const avgBitrateKbps = avg(bitrateValues);
    // OBS-style recommendation: peak + 30% headroom
    const recommendedUploadKbps = Math.round(peakBitrateKbps * 1.3);

    let verdict: Result["verdict"] = "poor";
    if (avgFps >= 24 && fpsStability >= 0.9 && (avgRttMs == null || avgRttMs < 80)) verdict = "excellent";
    else if (avgFps >= 20 && fpsStability >= 0.8 && (avgRttMs == null || avgRttMs < 150)) verdict = "good";
    else if (avgFps >= 15 && fpsStability >= 0.65) verdict = "marginal";

    return {
      avgFps,
      fpsStdDev,
      fpsStability,
      avgRttMs,
      peakBitrateKbps,
      avgBitrateKbps,
      recommendedUploadKbps,
      packetsLost: 0, // local loopback has no real loss; reported for completeness
      verdict,
    };
  };

  const runTest = async () => {
    resetState();
    setPhase("preparing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = stream;

      const pc1 = new RTCPeerConnection();
      const pc2 = new RTCPeerConnection();
      pc1Ref.current = pc1;
      pc2Ref.current = pc2;

      pc1.onicecandidate = (e) => e.candidate && pc2.addIceCandidate(e.candidate);
      pc2.onicecandidate = (e) => e.candidate && pc1.addIceCandidate(e.candidate);

      stream.getTracks().forEach((t) => pc1.addTrack(t, stream));

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const to = window.setTimeout(() => reject(new Error("Loopback connection timed out")), 5000);
        pc1.addEventListener("connectionstatechange", () => {
          if (pc1.connectionState === "connected") {
            window.clearTimeout(to);
            resolve();
          } else if (pc1.connectionState === "failed") {
            window.clearTimeout(to);
            reject(new Error("Loopback connection failed"));
          }
        });
      });

      setPhase("running");
      startedAtRef.current = performance.now();

      let lastBytes = 0;
      let lastFrames = 0;
      let lastTs = 0;

      samplerRef.current = window.setInterval(async () => {
        const elapsed = performance.now() - startedAtRef.current;
        setProgress(Math.min(100, (elapsed / TEST_DURATION_MS) * 100));

        try {
          const stats = await pc1.getStats();
          let outbound: RTCStats | null = null;
          let candidatePair: RTCStats | null = null;
          stats.forEach((r) => {
            if (r.type === "outbound-rtp" && (r as { kind?: string }).kind === "video") outbound = r;
            if (r.type === "candidate-pair" && (r as { state?: string; nominated?: boolean }).state === "succeeded" && (r as { nominated?: boolean }).nominated) candidatePair = r;
          });

          let fps: number | null = null;
          let bitrateKbps: number | null = null;
          if (outbound) {
            const o = outbound as unknown as { bytesSent: number; framesSent: number; timestamp: number; framesPerSecond?: number };
            if (lastTs > 0) {
              const dt = (o.timestamp - lastTs) / 1000;
              if (dt > 0) {
                bitrateKbps = Math.round(((o.bytesSent - lastBytes) * 8) / dt / 1000);
                fps = o.framesPerSecond != null
                  ? Math.round(o.framesPerSecond)
                  : Math.round((o.framesSent - lastFrames) / dt);
              }
            }
            lastBytes = o.bytesSent;
            lastFrames = o.framesSent;
            lastTs = o.timestamp;
          }

          let rttMs: number | null = null;
          if (candidatePair) {
            const cp = candidatePair as unknown as { currentRoundTripTime?: number };
            rttMs = cp.currentRoundTripTime != null ? Math.round(cp.currentRoundTripTime * 1000) : null;
          }

          const sample: Sample = { t: elapsed, fps, bitrateKbps, rttMs };
          samplesRef.current = [...samplesRef.current, sample];
          setSamples(samplesRef.current);
        } catch (err) {
          console.warn("getStats failed", err);
        }
      }, SAMPLE_INTERVAL_MS);

      stopTimerRef.current = window.setTimeout(() => {
        const collected = samplesRef.current;
        cleanup();
        setProgress(100);
        setResult(computeResult(collected));
        setPhase("done");
      }, TEST_DURATION_MS);
    } catch (err) {
      cleanup();
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  const cancelTest = () => {
    cleanup();
    setPhase("idle");
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="glass" size="sm" className="gap-2">
          <FlaskConical className="w-4 h-4" />
          OBS Connection Test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono tracking-wide">
            <FlaskConical className="w-4 h-4 text-primary" /> OBS CONNECTION TEST
          </DialogTitle>
          <DialogDescription>
            Runs a 10-second local diagnostic to estimate latency, FPS stability, and the upload bandwidth your stream will need.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1.5 font-mono">
              <li className="flex items-center gap-2"><Wifi className="w-3.5 h-3.5" /> Estimated round-trip latency</li>
              <li className="flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> FPS average + stability</li>
              <li className="flex items-center gap-2"><Gauge className="w-3.5 h-3.5" /> Recommended upload bandwidth</li>
            </ul>
            <Button onClick={runTest} variant="neon" className="w-full">
              <Zap className="w-4 h-4" /> Start 10s Test
            </Button>
          </div>
        )}

        {(phase === "preparing" || phase === "running") && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {phase === "preparing" ? "Preparing camera & loopback…" : `Sampling… ${Math.round(progress)}%`}
            </div>
            <Progress value={progress} />
            {samples.length > 0 && (
              <LiveStats latest={samples[samples.length - 1]} />
            )}
            <Button onClick={cancelTest} variant="ghost" className="w-full">
              <X className="w-4 h-4" /> Cancel
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-destructive font-mono bg-destructive/10 border border-destructive/40 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error ?? "Unknown error"}</span>
            </div>
            <Button onClick={runTest} variant="glass" className="w-full">Retry</Button>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4">
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md border font-mono text-xs tracking-widest", verdictMeta[result.verdict].tone)}>
              <CheckCircle2 className="w-4 h-4" />
              {verdictMeta[result.verdict].label}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ResultTile
                icon={<Wifi className="w-3.5 h-3.5" />}
                label="LATENCY"
                value={result.avgRttMs != null ? `${Math.round(result.avgRttMs)}` : "—"}
                unit="ms"
              />
              <ResultTile
                icon={<Activity className="w-3.5 h-3.5" />}
                label="AVG FPS"
                value={`${result.avgFps.toFixed(1)}`}
                unit={`±${result.fpsStdDev.toFixed(1)}`}
              />
              <ResultTile
                icon={<Activity className="w-3.5 h-3.5" />}
                label="STABILITY"
                value={`${Math.round(result.fpsStability * 100)}`}
                unit="%"
              />
              <ResultTile
                icon={<Gauge className="w-3.5 h-3.5" />}
                label="REC. UPLOAD"
                value={formatBitrate(result.recommendedUploadKbps)}
                unit={result.recommendedUploadKbps >= 1000 ? "Mbps" : "kbps"}
              />
            </div>

            <div className="text-[11px] font-mono text-muted-foreground border-t border-border pt-3 space-y-1">
              <div>Peak bitrate: {formatBitrate(result.peakBitrateKbps)} {result.peakBitrateKbps >= 1000 ? "Mbps" : "kbps"}</div>
              <div>Avg bitrate: {formatBitrate(Math.round(result.avgBitrateKbps))} {result.avgBitrateKbps >= 1000 ? "Mbps" : "kbps"}</div>
              <div>Samples collected: {samples.length}</div>
            </div>

            <p className="text-sm text-muted-foreground">{verdictMeta[result.verdict].tip}</p>

            <div className="flex gap-2">
              <Button onClick={runTest} variant="glass" className="flex-1">Run Again</Button>
              <Button onClick={() => setOpen(false)} variant="neon" className="flex-1">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const formatBitrate = (kbps: number) => (kbps >= 1000 ? (kbps / 1000).toFixed(1) : `${kbps}`);

const LiveStats = ({ latest }: { latest: Sample }) => (
  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
    <MiniStat label="FPS" value={latest.fps != null ? `${latest.fps}` : "—"} />
    <MiniStat label="RTT" value={latest.rttMs != null ? `${latest.rttMs}ms` : "—"} />
    <MiniStat label="BITRATE" value={latest.bitrateKbps != null ? `${formatBitrate(latest.bitrateKbps)}${latest.bitrateKbps >= 1000 ? "M" : "k"}` : "—"} />
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
    <div className="text-[10px] tracking-widest text-muted-foreground">{label}</div>
    <div className="text-foreground tabular-nums">{value}</div>
  </div>
);

const ResultTile = ({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) => (
  <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <div className="font-mono text-lg leading-none tabular-nums text-foreground">
      {value}
      <span className="text-xs ml-1 text-muted-foreground">{unit}</span>
    </div>
  </div>
);
