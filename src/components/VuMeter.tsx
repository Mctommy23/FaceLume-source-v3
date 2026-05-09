import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface VuMeterProps {
  /** Audio stream/track source to meter. Null = inactive. */
  stream: MediaStream | null;
  label: string;
  /** Tailwind class for the active fill, e.g. "bg-secondary" or "bg-primary". */
  colorClass?: string;
  className?: string;
  /** Optional callback fired when a clip event is detected. */
  onClip?: () => void;
}

// Thresholds on the normalized 0..1 sample magnitude scale.
// 0.89 ≈ -1 dBFS (hot), 0.98 ≈ -0.17 dBFS (clip).
const HOT_THRESHOLD = 0.89;
const CLIP_THRESHOLD = 0.98;
// How long the CLIP indicator stays lit after the last over-threshold sample.
const CLIP_HOLD_MS = 1500;

/**
 * Lightweight real-time VU meter driven by a Web Audio AnalyserNode.
 * Renders a horizontal bar (0–100%) plus a peak indicator and a clipping
 * warning that latches when the signal exceeds a safe level (~-1 dBFS).
 */
export const VuMeter = ({ stream, label, colorClass = "bg-secondary", className = "", onClip }: VuMeterProps) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const peakHoldRef = useRef<{ value: number; time: number }>({ value: 0, time: 0 });
  const lastClipAtRef = useRef<number>(0);
  const onClipRef = useRef<typeof onClip>(onClip);
  onClipRef.current = onClip;

  // Render-state for warning badges. Updated only on transitions to avoid re-renders per frame.
  const [hot, setHot] = useState(false);
  const [clipping, setClipping] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try { sourceRef.current?.disconnect(); } catch { /* noop */ }
      try { analyserRef.current?.disconnect(); } catch { /* noop */ }
      sourceRef.current = null;
      analyserRef.current = null;
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close().catch(() => {});
      }
      ctxRef.current = null;
      if (fillRef.current) fillRef.current.style.width = "0%";
      if (peakRef.current) peakRef.current.style.left = "0%";
      if (valueRef.current) valueRef.current.textContent = "—";
      setHot(false);
      setClipping(false);
    };

    if (!stream || stream.getAudioTracks().length === 0) {
      stop();
      return () => stop();
    }

    const Ctx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    let source: MediaStreamAudioSourceNode;
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch (err) {
      console.error("VuMeter: createMediaStreamSource failed", err);
      stop();
      return () => stop();
    }
    sourceRef.current = source;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.fftSize);
    let prevHot = false;
    let prevClipping = false;

    const tick = () => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      let samplePeak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
        const abs = v < 0 ? -v : v;
        if (abs > samplePeak) samplePeak = abs;
      }
      const rms = Math.sqrt(sum / data.length);
      // Boost so normal speech reaches ~60-80%
      const level = Math.min(1, rms * 2.4);
      const pct = level * 100;

      // Peak hold: keep peak for ~700ms then decay
      const now = performance.now();
      if (level > peakHoldRef.current.value || now - peakHoldRef.current.time > 700) {
        peakHoldRef.current = { value: level, time: now };
      }

      // Clip / hot detection on raw sample peak (independent of display gain).
      const isClippingNow = samplePeak >= CLIP_THRESHOLD;
      if (isClippingNow) {
        lastClipAtRef.current = now;
        if (!prevClipping) onClipRef.current?.();
      }
      const clipLatched = now - lastClipAtRef.current < CLIP_HOLD_MS;
      const isHotNow = samplePeak >= HOT_THRESHOLD;

      if (isHotNow !== prevHot) {
        prevHot = isHotNow;
        setHot(isHotNow);
      }
      if (clipLatched !== prevClipping) {
        prevClipping = clipLatched;
        setClipping(clipLatched);
      }

      if (fillRef.current) fillRef.current.style.width = `${pct.toFixed(1)}%`;
      if (peakRef.current) peakRef.current.style.left = `${(peakHoldRef.current.value * 100).toFixed(1)}%`;
      if (valueRef.current) {
        // dBFS approx for display
        const db = level > 0.0001 ? 20 * Math.log10(level) : -Infinity;
        valueRef.current.textContent = isFinite(db) ? `${db.toFixed(0)} dB` : "−∞";
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      stop();
    };
  }, [stream]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <div
        className={`relative flex-1 h-2 rounded-full bg-muted/60 overflow-hidden border transition-colors ${
          clipping ? "border-destructive/80 ring-1 ring-destructive/40" : "border-border/40"
        }`}
      >
        <div
          ref={fillRef}
          className={`absolute inset-y-0 left-0 ${colorClass} transition-[width] duration-75 ease-out`}
          style={{ width: "0%" }}
        />
        {/* Peak indicator */}
        <div
          ref={peakRef}
          className={`absolute top-0 bottom-0 w-px ${clipping ? "bg-destructive" : "bg-foreground/80"}`}
          style={{ left: "0%" }}
        />
        {/* Clip zone hint (brightens when hot) */}
        <div
          className={`absolute inset-y-0 right-0 w-[15%] pointer-events-none transition-colors ${
            clipping ? "bg-destructive/60" : hot ? "bg-destructive/30" : "bg-destructive/10"
          }`}
        />
      </div>
      <span
        ref={valueRef}
        className="text-[10px] font-mono text-muted-foreground w-12 text-right tabular-nums"
      >
        —
      </span>
      {/* Clip / hot badge — fixed width slot to avoid layout shift */}
      <div className="w-14 shrink-0 flex justify-end" aria-live="polite">
        {clipping ? (
          <span
            role="status"
            title="Audio is clipping. Lower input gain or move further from the mic."
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-destructive text-destructive-foreground animate-pulse"
          >
            <AlertTriangle className="w-2.5 h-2.5" /> Clip
          </span>
        ) : hot ? (
          <span
            title="Signal is hot — close to clipping."
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-destructive/20 text-destructive border border-destructive/40"
          >
            Hot
          </span>
        ) : null}
      </div>
    </div>
  );
};
