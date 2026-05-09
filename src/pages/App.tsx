import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Play, Square, Camera, Sparkles, Activity, Cpu, Wifi, Zap, Wand2, AlertTriangle, RefreshCw, ShieldOff, VideoOff, Lock, Mic, MicOff, Volume2, VolumeX, Circle, Download, X, Clock, Check, Loader2, Maximize2, Minimize2, LogOut, LayoutDashboard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { OBSGuide } from "@/components/OBSGuide";
import { OBSConnectionTest } from "@/components/OBSConnectionTest";
import { StreamQualityPanel } from "@/components/StreamQualityPanel";
import { TopUpModal } from "@/components/TopUpModal";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { createDecartClient, models, type RealTimeClient } from "@decartai/sdk";
import { VoiceChanger, VOICE_PRESETS, type VoicePresetId } from "@/lib/voiceChanger";
import { VuMeter } from "@/components/VuMeter";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { CREDITS_PER_SECOND, formatMinutes } from "@/lib/creditPlans";

type Status = "idle" | "connecting" | "active" | "streaming";

type StreamErrorKind = "permission" | "no-device" | "in-use" | "insecure" | "unsupported" | "network" | "unknown";

interface StreamError {
  kind: StreamErrorKind;
  title: string;
  message: string;
  hint: string;
}

const checkEnvironmentSupport = (): StreamError | null => {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) {
    return {
      kind: "insecure",
      title: "Secure connection required",
      message: "Camera access only works on HTTPS or localhost.",
      hint: "Open this site over HTTPS and try again.",
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      kind: "unsupported",
      title: "Camera API unavailable",
      message: "Your browser doesn't expose getUserMedia.",
      hint: "Use a recent version of Chrome, Edge, Firefox, or Safari.",
    };
  }
  if (typeof RTCPeerConnection === "undefined") {
    return {
      kind: "unsupported",
      title: "WebRTC not supported",
      message: "This browser can't establish a WebRTC connection.",
      hint: "Switch to Chrome, Edge, Firefox, or Safari and disable extensions that block WebRTC.",
    };
  }
  return null;
};

const classifyError = (err: unknown): StreamError => {
  const name = (err as { name?: string })?.name ?? "";
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (name === "NotAllowedError" || name === "SecurityError" || lower.includes("permission") || lower.includes("denied")) {
    return {
      kind: "permission",
      title: "Camera permission blocked",
      message: "Your browser blocked camera access for this site.",
      hint: "Click the camera icon in the address bar, allow access, then retry.",
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || lower.includes("not found") || lower.includes("no device")) {
    return {
      kind: "no-device",
      title: "No camera detected",
      message: "We couldn't find a camera that matches the required resolution.",
      hint: "Plug in a webcam or close other apps that may be locking it, then retry.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError" || lower.includes("in use") || lower.includes("could not start")) {
    return {
      kind: "in-use",
      title: "Camera is busy",
      message: "Another app (Zoom, OBS, browser tab) is using the camera.",
      hint: "Close other apps using the webcam and retry.",
    };
  }
  if (lower.includes("network") || lower.includes("ice") || lower.includes("dtls") || lower.includes("fetch")) {
    return {
      kind: "network",
      title: "Network connection failed",
      message: "Couldn't reach the streaming servers.",
      hint: "Check your internet connection or VPN/firewall, then retry.",
    };
  }
  return {
    kind: "unknown",
    title: "Could not start stream",
    message: message || "An unexpected error occurred.",
    hint: "Try again. If the problem persists, refresh the page.",
  };
};

const statusMeta: Record<Status, { label: string; color: string; pulse: boolean }> = {
  idle: { label: "OFFLINE", color: "bg-muted-foreground", pulse: false },
  connecting: { label: "CONNECTING", color: "bg-yellow-400", pulse: true },
  active: { label: "ACTIVE", color: "bg-secondary", pulse: true },
  streaming: { label: "STREAMING LIVE", color: "bg-primary", pulse: true },
};

const App = () => {
  const inputVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const realtimeRef = useRef<RealTimeClient | null>(null);
  const meterStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const meterBarsRef = useRef<HTMLDivElement>(null);
  const transformedStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const voiceChangerRef = useRef<VoiceChanger | null>(null);
  const lastClipToastRef = useRef<number>(0);
  const lastOutClipToastRef = useRef<number>(0);
  // Ephemeral Decart token cache + refresh timer.
  // The realtime session does not consume the token after the WebRTC handshake,
  // but we keep a fresh one warm so reconnects/resubscribes never fail.
  const currentTokenRef = useRef<{ apiKey: string; expiresAt: number } | null>(null);
  const tokenRefreshTimerRef = useRef<number | null>(null);
  // Auto-reconnect bookkeeping
  const outboundStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const isReconnectingRef = useRef(false);
  const userStoppedRef = useRef(false);
  const startRunRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  // Usage tracking — wall-clock seconds streamed in the current session.
  const sessionStartRef = useRef<number | null>(null);
  // Server-owned streaming session id (single-active per user, atomic credits).
  const streamingSessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  // Credit-based usage enforcement — track Decart-reported seconds delta.
  const lastTickSecondsRef = useRef<number>(0);
  const creditsExhaustedRef = useRef<boolean>(false);
  // Forward ref to stopStream (defined later) so callbacks created in
  // connectRealtime can safely trigger a stop without TDZ issues.
  const stopStreamRef = useRef<(() => void) | null>(null);
  // Adaptive quality controller — dynamically lowers/raises the outbound
  // video resolution & framerate based on observed FPS / RTT so the stream
  // stays smooth on weak networks and crisp on strong ones.
  // Tiers go from 0 (lowest) to N-1 (native model resolution).
  const adaptiveTierRef = useRef<number>(-1); // -1 = not initialised
  const adaptiveBaseRef = useRef<{ w: number; h: number; fps: number } | null>(null);
  const adaptiveLastChangeRef = useRef<number>(0);
  const adaptivePoorStreakRef = useRef<number>(0);
  const adaptiveGoodStreakRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>("idle");
  const [realtimeClient, setRealtimeClient] = useState<RealTimeClient | null>(null);
  const [liveRttMs, setLiveRttMs] = useState<number | null>(null);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [transformedReady, setTransformedReady] = useState(false);
  const [lowLatency, setLowLatency] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<{ url: string; file: File } | null>(null);
  const [streamError, setStreamError] = useState<StreamError | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedAudioId, setSelectedAudioId] = useState<string>("none");
  const [devicesLabeled, setDevicesLabeled] = useState(false);
  const [meterActive, setMeterActive] = useState(false);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activationBanner, setActivationBanner] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePresetId, setVoicePresetId] = useState<VoicePresetId>("none");
  // Streams exposed to VU meters (state so the meter component re-binds)
  const [rawMicStream, setRawMicStream] = useState<MediaStream | null>(null);
  const [processedMicStream, setProcessedMicStream] = useState<MediaStream | null>(null);
  // Usage tracking UI state
  type UsageState = "idle" | "tracking" | "saving" | "saved" | "error";
  const [usageState, setUsageState] = useState<UsageState>("idle");
  const [usageElapsed, setUsageElapsed] = useState(0);
  const [usageLastSaved, setUsageLastSaved] = useState<number | null>(null);
  const usageTickRef = useRef<number | null>(null);
  const usageSavedToIdleRef = useRef<number | null>(null);

  // Credit-based usage enforcement
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  // Smoothly-decrementing display value for "X seconds remaining" while
  // streaming. Snaps to authoritative `remainingCredits` whenever it changes
  // (server reload or generationTick), then ticks down locally between updates.
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);
  const displayAnchorRef = useRef<{ value: number; at: number } | null>(null);
  // AI Output fullscreen mode
  const [outputFullscreen, setOutputFullscreen] = useState(false);
  const [monitorOutput, setMonitorOutput] = useState(false);

  // Keep the output <video> element's mute state in sync with monitorOutput.
  // Default is muted to prevent acoustic feedback when not on headphones.
  useEffect(() => {
    const v = outputVideoRef.current;
    if (!v) return;
    v.muted = !monitorOutput;
    if (monitorOutput) {
      // play() may have been gated by autoplay policy when unmuting
      v.play().catch(() => { /* ignore */ });
    }
  }, [monitorOutput, transformedReady]);
  const userExitedFullscreenRef = useRef(false);

  // Guard: only activated users (or admins) can access the studio.
  const allowedToView = !!user && !!profile && (profile.is_activated || profile.is_admin);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/get-started", { replace: true });
      return;
    }
    if (profile && !profile.is_activated && !profile.is_admin) {
      navigate("/activate", { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  // Auto-enter fullscreen when streaming starts; auto-exit when it stops
  useEffect(() => {
    if (status === "streaming") {
      if (!userExitedFullscreenRef.current) setOutputFullscreen(true);
    } else if (status === "idle") {
      setOutputFullscreen(false);
      userExitedFullscreenRef.current = false;
    }
  }, [status]);

  // ESC to exit fullscreen
  useEffect(() => {
    if (!outputFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        userExitedFullscreenRef.current = true;
        setOutputFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [outputFullscreen]);

  // Drive the browser's native Fullscreen API so the output covers the
  // entire screen (hiding Chrome tabs, address bar, taskbar). We request
  // fullscreen on <html> so our React overlay UI (Stop / Exit buttons)
  // remains visible inside the fullscreen element.
  useEffect(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const isFs = () => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

    if (outputFullscreen) {
      if (!isFs()) {
        const req = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el);
        req?.().catch(() => { /* user gesture may be required; overlay still works */ });
      }
    } else {
      if (isFs()) {
        const exit = doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc);
        exit?.().catch(() => { /* ignore */ });
      }
    }
  }, [outputFullscreen]);

  // Sync state if the user exits native fullscreen via browser chrome (Esc, F11).
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!isFs && outputFullscreen) {
        userExitedFullscreenRef.current = true;
        setOutputFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as EventListener);
    };
  }, [outputFullscreen]);

  // Hide all toast notifications while the output is in fullscreen mode.
  useEffect(() => {
    if (outputFullscreen) {
      document.body.classList.add("hide-toasts");
    } else {
      document.body.classList.remove("hide-toasts");
    }
    return () => {
      document.body.classList.remove("hide-toasts");
    };
  }, [outputFullscreen]);

  // Show activation success banner after first-time activation flow,
  // and force-refresh credit balance from backend so the UI reflects the bonus.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("facelume:justActivated") === "1") {
        setActivationBanner(true);
        sessionStorage.removeItem("facelume:justActivated");
        // Refresh balance immediately (don't wait for next mount/poll).
        if (user) {
          supabase
            .from("profiles")
            .select("credits")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) setRemainingCredits(data.credits);
              refreshProfile();
            });
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const reloadCredits = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setRemainingCredits(data.credits);
    refreshProfile();
  };

  // Load credits from backend on mount + when user changes
  useEffect(() => {
    let cancelled = false;
    const loadCredits = async () => {
      if (!user) {
        setRemainingCredits(null);
        setCreditsLoading(false);
        return;
      }
      setCreditsLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load credits", error);
        // Fall back to AuthProvider's cached value if available
        setRemainingCredits(profile?.credits ?? 0);
      } else {
        setRemainingCredits(data?.credits ?? 0);
      }
      setCreditsLoading(false);
    };
    loadCredits();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-sync credits from server whenever stream status transitions to a
  // live phase. Keeps the UI aligned with authoritative server-side
  // validation (decart-token enforces credits before issuing a token).
  useEffect(() => {
    if (!user) return;
    if (status === "connecting" || status === "active" || status === "streaming") {
      reloadCredits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  // Snap the smooth display to the authoritative credit balance whenever it
  // changes (server reload, generationTick deduction, top-up, etc.).
  useEffect(() => {
    if (remainingCredits === null) {
      setDisplaySeconds(null);
      displayAnchorRef.current = null;
      return;
    }
    displayAnchorRef.current = { value: remainingCredits, at: performance.now() };
    setDisplaySeconds(remainingCredits);
  }, [remainingCredits]);

  // Smoothly decrement the display while streaming, interpolating between
  // authoritative updates so the counter feels live (~4 updates/sec).
  useEffect(() => {
    const isLive = status === "active" || status === "streaming";
    if (!isLive || remainingCredits === null) return;
    const id = window.setInterval(() => {
      const anchor = displayAnchorRef.current;
      if (!anchor) return;
      const elapsed = (performance.now() - anchor.at) / 1000;
      // Credits drop at CREDITS_PER_SECOND credits per second.
      const next = Math.max(0, anchor.value - elapsed * CREDITS_PER_SECOND);
      setDisplaySeconds(next);
    }, 250);
    return () => window.clearInterval(id);
  }, [status, remainingCredits]);

  // Apply mute state to all live audio tracks (main stream + meter stream + processed)
  const applyMuteToTracks = (muted: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    meterStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    const processed = voiceChangerRef.current?.getProcessedTrack();
    if (processed) processed.enabled = !muted;
  };

  const toggleMicMute = () => {
    if (!selectedAudioId || selectedAudioId === "none") return;
    setMicMuted((prev) => {
      const next = !prev;
      applyMuteToTracks(next);
      toast.message(next ? "Microphone muted" : "Microphone unmuted");
      return next;
    });
  };

  // Keyboard shortcut: press "M" to toggle mute/unmute
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "m" && e.key !== "M") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      e.preventDefault();
      toggleMicMute();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedAudioId]);

  // Live-update voice changer preset while streaming (no reconnect needed)
  useEffect(() => {
    const vc = voiceChangerRef.current;
    if (!vc) return;
    const preset = VOICE_PRESETS.find((p) => p.id === voicePresetId) ?? VOICE_PRESETS[0];
    vc.applyPreset(preset);
  }, [voicePresetId]);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const vids = all.filter((d) => d.kind === "videoinput");
      const auds = all.filter((d) => d.kind === "audioinput");
      setVideoDevices(vids);
      setAudioDevices(auds);
      setDevicesLabeled(vids.some((d) => !!d.label));
      setSelectedVideoId((cur) => cur || vids[0]?.deviceId || "");
    } catch (err) {
      console.error("enumerateDevices failed", err);
    }
  };

  useEffect(() => {
    setStreamError(checkEnvironmentSupport());
    refreshDevices();
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, []);

  const stopMeter = () => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    meterStreamRef.current?.getTracks().forEach((t) => t.stop());
    meterStreamRef.current = null;
    setMeterActive(false);
    if (meterBarsRef.current) {
      meterBarsRef.current.querySelectorAll<HTMLDivElement>("[data-bar]").forEach((b) => {
        b.style.opacity = "0.15";
      });
    }
  };

  const startMeter = async () => {
    if (!selectedAudioId || selectedAudioId === "none") {
      setMeterError("Select a microphone first");
      return;
    }
    stopMeter();
    setMeterError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedAudioId }, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      meterStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => { t.enabled = !micMuted; });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      setMeterActive(true);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(1, rms * 2.2);
        if (meterBarsRef.current) {
          const bars = meterBarsRef.current.querySelectorAll<HTMLDivElement>("[data-bar]");
          const lit = Math.round(level * bars.length);
          bars.forEach((bar, i) => {
            bar.style.opacity = i < lit ? "1" : "0.15";
          });
        }
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      const classified = classifyError(err);
      setMeterError(classified.message);
      toast.error("Mic preview failed", { description: classified.hint });
      stopMeter();
    }
  };

  // Auto-stop meter if mic changes / stream starts / unmount
  useEffect(() => {
    if (meterActive) stopMeter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioId]);

  useEffect(() => {
    if (streamActive && meterActive) stopMeter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamActive]);

  useEffect(() => {
    return () => {
      stopMeter();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (usageTickRef.current !== null) {
        window.clearInterval(usageTickRef.current);
        usageTickRef.current = null;
      }
      if (usageSavedToIdleRef.current !== null) {
        window.clearTimeout(usageSavedToIdleRef.current);
        usageSavedToIdleRef.current = null;
      }
      if (tokenRefreshTimerRef.current !== null) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      userStoppedRef.current = true;
      // Best-effort: end the server-side streaming session on unmount so
      // the user isn't blocked by the single-active guard next time.
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      const sid = streamingSessionIdRef.current;
      if (sid) {
        streamingSessionIdRef.current = null;
        const totalSeconds = lastTickSecondsRef.current;
        supabase.functions.invoke("streaming-session", {
          method: "POST",
          body: { action: "end", session_id: sid, total_seconds: totalSeconds, reason: "unmount" },
        }).catch((err) => console.error("end session on unmount failed", err));
      }
      sessionStartRef.current = null;
      realtimeRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceChangerRef.current?.dispose();
      voiceChangerRef.current = null;
    };
  }, []);

  const requestDevicePermissions = async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tmp.getTracks().forEach((t) => t.stop());
      await refreshDevices();
      toast.success("Devices unlocked");
    } catch (err) {
      const classified = classifyError(err);
      setStreamError(classified);
      toast.error(classified.title, { description: classified.hint });
    }
  };

  // Fatal token errors that should NOT be retried — backend rejected the
  // request for a definitive reason (no credits, not activated, no session).
  const FATAL_TOKEN_ERRORS = new Set([
    "INSUFFICIENT_CREDITS",
    "NOT_ACTIVATED",
    "PROFILE_NOT_FOUND",
    "NO_ACTIVE_SESSION",
    "INVALID_SESSION",
    "Unauthorized",
  ]);

  class FatalTokenError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "FatalTokenError";
    }
  }

  const fetchClientTokenOnce = async (): Promise<{ apiKey: string; expiresAt: number }> => {
    const sessionId = streamingSessionIdRef.current;
    if (!sessionId) throw new FatalTokenError("NO_ACTIVE_SESSION", "No active streaming session");
    const { data, error } = await supabase.functions.invoke("decart-token", {
      method: "POST",
      headers: { "x-streaming-session-id": sessionId },
    });
    // Edge-function business errors arrive in `data.error` (non-2xx still
    // returns parsed body alongside `error`). Detect fatal codes and bail
    // out without retrying.
    const code = (data && typeof data === "object" && "error" in data) ? String((data as any).error) : null;
    if (code && FATAL_TOKEN_ERRORS.has(code)) {
      throw new FatalTokenError(code, (data as any)?.message || code);
    }
    if (error) throw new Error(error.message);
    if (!data?.apiKey) throw new Error("No apiKey returned");
    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt).getTime()
      : Date.now() + 5 * 60 * 1000;
    return { apiKey: data.apiKey as string, expiresAt };
  };

  // Retry token fetch up to 3 times for transient/network errors.
  // Fatal errors (credits, auth, session) bubble immediately.
  const fetchClientToken = async (
    maxAttempts = 3,
    baseDelayMs = 1000,
  ): Promise<{ apiKey: string; expiresAt: number }> => {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fetchClientTokenOnce();
      } catch (err) {
        lastErr = err;
        if (err instanceof FatalTokenError) throw err;
        if (attempt < maxAttempts) {
          console.warn(`Token fetch attempt ${attempt} failed, retrying…`, err);
          await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Token fetch failed");
  };

  const clearTokenRefresh = () => {
    if (tokenRefreshTimerRef.current !== null) {
      window.clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  };

  // Decart sessions are capped at 60s server-side. Refresh the token at the
  // ~50s mark so the backend (decart-token) re-validates the user's credits
  // mid-session. Transient failures are retried; only fatal errors (credits
  // exhausted, deactivated) stop the stream.
  const scheduleTokenRefresh = () => {
    clearTokenRefresh();
    const token = currentTokenRef.current;
    if (!token) return;
    const REVALIDATE_AFTER_MS = 50_000;
    tokenRefreshTimerRef.current = window.setTimeout(async () => {
      try {
        const next = await fetchClientToken(3, 1000);
        currentTokenRef.current = next;
        scheduleTokenRefresh();
      } catch (err) {
        if (err instanceof FatalTokenError) {
          console.error("Decart token refresh fatally rejected", err);
          const isCredits = err.code === "INSUFFICIENT_CREDITS";
          toast.error(isCredits ? "Credits exhausted" : "Stream stopped", {
            description: isCredits
              ? "Your balance ran out — stream ended."
              : err.message || "Backend rejected the streaming session.",
          });
          if (isCredits) creditsExhaustedRef.current = true;
          setStreamError({
            kind: "unknown",
            title: isCredits ? "Credits exhausted" : "Stream stopped",
            message: err.message || "Backend rejected the streaming session.",
            hint: isCredits ? "Top up to keep streaming." : "Try starting the stream again.",
          });
          setTimeout(() => stopStreamRef.current?.(), 0);
          return;
        }
        // Transient failure — keep the stream alive. Allow a 2.5s grace
        // window then try one more refresh; if that also fails, stop.
        console.warn("Token refresh transient failure, entering grace period", err);
        toast.message("Reconnecting to streaming server…");
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const next = await fetchClientToken(2, 1000);
          currentTokenRef.current = next;
          scheduleTokenRefresh();
        } catch (err2) {
          console.error("Token refresh failed after grace period", err2);
          const isFatal = err2 instanceof FatalTokenError;
          setStreamError({
            kind: "network",
            title: "Connection lost",
            message: isFatal
              ? (err2 as FatalTokenError).message
              : "Could not reach the streaming server after retries.",
            hint: "Click Retry to start a fresh stream.",
          });
          toast.error("Stream stopped", {
            description: "Could not refresh streaming credentials.",
          });
          setTimeout(() => stopStreamRef.current?.(), 0);
        }
      }
    }, REVALIDATE_AFTER_MS);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  // ----- Adaptive quality controller --------------------------------------
  // Scales the outbound video track between resolution/fps tiers based on
  // observed network + encoder health. Uses MediaStreamTrack.applyConstraints
  // so the encoder can drop to a cheaper profile without renegotiating the
  // PeerConnection. Tier 0 = lowest, last tier = native model resolution.
  const buildAdaptiveTiers = (base: { w: number; h: number; fps: number }) => [
    { w: Math.round(base.w * 0.5),  h: Math.round(base.h * 0.5),  fps: Math.max(12, Math.round(base.fps * 0.5)) },
    { w: Math.round(base.w * 0.66), h: Math.round(base.h * 0.66), fps: Math.max(15, Math.round(base.fps * 0.66)) },
    { w: Math.round(base.w * 0.83), h: Math.round(base.h * 0.83), fps: Math.max(20, Math.round(base.fps * 0.83)) },
    { w: base.w, h: base.h, fps: base.fps },
  ];

  const applyAdaptiveTier = async (tier: number) => {
    const base = adaptiveBaseRef.current;
    const stream = outboundStreamRef.current;
    if (!base || !stream) return;
    const tiers = buildAdaptiveTiers(base);
    const clamped = Math.max(0, Math.min(tiers.length - 1, tier));
    if (clamped === adaptiveTierRef.current) return;
    const cfg = tiers[clamped];
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        width: { ideal: cfg.w },
        height: { ideal: cfg.h },
        frameRate: { ideal: cfg.fps, max: cfg.fps },
      });
      adaptiveTierRef.current = clamped;
      adaptiveLastChangeRef.current = performance.now();
      adaptivePoorStreakRef.current = 0;
      adaptiveGoodStreakRef.current = 0;
    } catch {
      /* applyConstraints can fail mid-stream on some devices — ignore */
    }
  };

  const adaptQuality = (
    fps: number | null,
    rtt: number | null,
    lossDelta: number,
    limitation: string | null,
  ) => {
    if (adaptiveBaseRef.current == null || adaptiveTierRef.current < 0) return;
    // Cooldown: don't churn tiers faster than every 4s
    if (performance.now() - adaptiveLastChangeRef.current < 4000) return;
    if (fps == null && rtt == null) return;

    const bad =
      (fps != null && fps < 14) ||
      (rtt != null && rtt > 250) ||
      lossDelta > 5 ||
      limitation === "bandwidth" ||
      limitation === "cpu";
    const good =
      (fps == null || fps >= 22) &&
      (rtt == null || rtt < 120) &&
      lossDelta === 0 &&
      !limitation;

    if (bad) {
      adaptiveGoodStreakRef.current = 0;
      adaptivePoorStreakRef.current += 1;
      if (adaptivePoorStreakRef.current >= 2 && adaptiveTierRef.current > 0) {
        void applyAdaptiveTier(adaptiveTierRef.current - 1);
      }
    } else if (good) {
      adaptivePoorStreakRef.current = 0;
      adaptiveGoodStreakRef.current += 1;
      // Slow to upgrade so we don't oscillate.
      if (adaptiveGoodStreakRef.current >= 6) {
        void applyAdaptiveTier(adaptiveTierRef.current + 1);
      }
    } else {
      adaptivePoorStreakRef.current = 0;
      adaptiveGoodStreakRef.current = 0;
    }
  };


  // Establish (or re-establish) the Decart realtime WebRTC session using
  // the currently-cached ephemeral token and the existing outbound stream.
  const connectRealtime = async (outboundStream: MediaStream): Promise<RealTimeClient> => {
    let token = currentTokenRef.current;
    // Refresh token if missing or within 10s of expiry.
    if (!token || token.expiresAt - Date.now() < 10_000) {
      token = await fetchClientToken();
      currentTokenRef.current = token;
    }
    const model = models.realtime("lucy-2.1");
    const client = createDecartClient({ apiKey: token.apiKey });
    const realtime = await client.realtime.connect(outboundStream, {
      model,
      onRemoteStream: (transformed) => {
        transformedStreamRef.current = transformed;
        const v = outputVideoRef.current;
        if (v) {
          // Low-latency playback: minimize buffering, prioritize freshness
          // over perfect smoothness/sharpness. These hints are cheap and
          // ignored where unsupported.
          try {
            (v as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
            // Hint to the UA to avoid heavy decoding pipelines / frame queues.
            (v as unknown as { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
          } catch { /* noop */ }
          v.srcObject = transformed;
          // Keep playback head close to live edge — drop instead of buffer.
          const keepLive = () => {
            try {
              const buf = v.buffered;
              if (buf && buf.length > 0) {
                const liveEdge = buf.end(buf.length - 1);
                if (liveEdge - v.currentTime > 0.25) {
                  v.currentTime = Math.max(0, liveEdge - 0.05);
                }
              }
            } catch { /* noop */ }
          };
          v.addEventListener("loadedmetadata", keepLive, { once: true });
          v.play().catch(() => {});
        }
        setTransformedReady(true);
        setStatus("streaming");
      },
      initialState: {
        prompt: {
          text: prompt.trim() || "Keep the person's appearance natural",
          enhance: true,
        },
        ...(referenceImage ? { image: referenceImage.file } : {}),
      },
    });

    realtime.on("connectionChange", (s) => {
      if (s === "disconnected") {
        if (!userStoppedRef.current) {
          attemptReconnect();
        } else {
          setStatus("idle");
        }
      } else if (s === "generating" || s === "connected") {
        // Successful (re)connection — reset backoff
        reconnectAttemptsRef.current = 0;
        isReconnectingRef.current = false;
        setStatus("streaming");
      }
    });
    realtime.on("error", (e) => {
      console.error("Decart realtime error", e);
      const classified = classifyError(e);
      // Network errors during streaming → try to recover transparently
      if (classified.kind === "network" && !userStoppedRef.current) {
        attemptReconnect();
        return;
      }
      setStreamError(classified);
      toast.error(classified.title, { description: classified.hint });
    });

    // Credit-based deduction — Decart emits cumulative seconds since session
    // start. We forward those to the server as heartbeats; the server
    // atomically deducts credits and is the source of truth.
    realtime.on("generationTick", ({ seconds }) => {
      const last = lastTickSecondsRef.current;
      if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < last) {
        lastTickSecondsRef.current = Math.max(0, seconds || 0);
        return;
      }
      lastTickSecondsRef.current = seconds;
      // Optimistic local UI decrement
      const deltaSeconds = seconds - last;
      if (deltaSeconds > 0) {
        const deltaCredits = deltaSeconds * CREDITS_PER_SECOND;
        setRemainingCredits((prev) => {
          if (prev === null) return prev;
          return Math.max(0, prev - deltaCredits);
        });
      }
    });

    // Live stats for the top status bar (panel subscribes separately).
    // Throttle to ~1Hz to avoid extra React rerenders on the streaming path.
    let lastStatsAt = 0;
    realtime.on("stats", (s) => {
      const now = performance.now();
      if (now - lastStatsAt < 900) return;
      lastStatsAt = now;
      const nextRtt = s.connection?.currentRoundTripTime != null
        ? Math.round(s.connection.currentRoundTripTime * 1000)
        : null;
      const nextFps = s.video ? Math.round(s.video.framesPerSecond) : null;
      const lossDelta = s.video?.packetsLostDelta ?? 0;
      const limitation = (s as { outboundVideo?: { qualityLimitationReason?: string } | null })
        .outboundVideo?.qualityLimitationReason;
      setLiveRttMs((prev) => (prev === nextRtt ? prev : nextRtt));
      setLiveFps((prev) => (prev === nextFps ? prev : nextFps));
      // Adaptive quality — react to sustained good/bad samples.
      adaptQuality(nextFps, nextRtt, lossDelta, limitation ?? null);
    });

    return realtime;
  };

  // Tear down the dead realtime session and try connecting again with
  // exponential backoff, reusing the cached (auto-refreshed) ephemeral token.
  const attemptReconnect = () => {
    if (userStoppedRef.current) return;
    if (isReconnectingRef.current) return;
    const outbound = outboundStreamRef.current;
    if (!outbound) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      toast.error("Connection lost", {
        description: "Couldn't reconnect to Decart. Please retry manually.",
      });
      setStatus("idle");
      setStreamError({
        kind: "network",
        title: "Reconnection failed",
        message: "Lost connection to the streaming server and could not recover.",
        hint: "Click Retry to start a fresh stream.",
      });
      return;
    }

    isReconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;
    // Faster first retry (250ms) with capped exponential backoff. Most
    // disconnects are transient — recovering quickly feels much more "live".
    const delay = Math.min(250 * 2 ** (attempt - 1), 6000);

    setStatus("connecting");
    setTransformedReady(false);
    toast.message(`Reconnecting… (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);

    try {
      realtimeRef.current?.disconnect();
    } catch { /* noop */ }
    realtimeRef.current = null;
    setRealtimeClient(null);
    // generationTick handler also covers this, but reset proactively.
    lastTickSecondsRef.current = 0;
    clearReconnectTimer();
    reconnectTimerRef.current = window.setTimeout(async () => {
      try {
        const realtime = await connectRealtime(outbound);
        realtimeRef.current = realtime;
        setRealtimeClient(realtime);
      } catch (err) {
        console.error("Reconnect attempt failed", err);
        isReconnectingRef.current = false;
        // Schedule next attempt
        attemptReconnect();
      }
    }, delay);
  };

  // Stop the heartbeat ticker.
  const clearHeartbeat = () => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  // Send a heartbeat to the server with the latest cumulative seconds.
  // Server atomically deducts credits and may end the session if depleted.
  const sendHeartbeat = async () => {
    const sessionId = streamingSessionIdRef.current;
    if (!sessionId) return;
    const totalSeconds = lastTickSecondsRef.current;
    try {
      const { data, error } = await supabase.functions.invoke("streaming-session", {
        method: "POST",
        body: { action: "heartbeat", session_id: sessionId, total_seconds: totalSeconds },
      });
      if (error) throw new Error(error.message);
      if (data?.credits != null) setRemainingCredits(data.credits);
      if (data?.ended && !creditsExhaustedRef.current) {
        creditsExhaustedRef.current = true;
        toast.error("Credits exhausted");
        setTimeout(() => stopStreamRef.current?.(), 0);
      }
    } catch (err) {
      console.error("heartbeat failed", err);
    }
  };

  // End the server-side streaming session, charging any remaining unbilled time.
  const endStreamingSession = async (reason = "client_end") => {
    const sessionId = streamingSessionIdRef.current;
    streamingSessionIdRef.current = null;
    clearHeartbeat();
    if (!sessionId) return;
    const totalSeconds = lastTickSecondsRef.current;
    setUsageState("saving");
    try {
      const { data, error } = await supabase.functions.invoke("streaming-session", {
        method: "POST",
        body: { action: "end", session_id: sessionId, total_seconds: totalSeconds, reason },
      });
      if (error) throw new Error(error.message);
      if (data?.credits != null) setRemainingCredits(data.credits);
      setUsageLastSaved(totalSeconds);
      setUsageState("saved");
      if (usageSavedToIdleRef.current !== null) window.clearTimeout(usageSavedToIdleRef.current);
      usageSavedToIdleRef.current = window.setTimeout(() => setUsageState("idle"), 5000);
    } catch (err) {
      console.error("end session failed", err);
      setUsageState("error");
    }
  };

  // Legacy wall-clock usage flush — kept for unmount best-effort.
  const reportUsage = async () => {
    sessionStartRef.current = null;
    if (usageTickRef.current !== null) {
      window.clearInterval(usageTickRef.current);
      usageTickRef.current = null;
    }
    await endStreamingSession("client_end");
  };

  const startStream = async () => {
    const runId = startRunRef.current + 1;
    startRunRef.current = runId;
    const assertStartCurrent = () => {
      if (userStoppedRef.current || startRunRef.current !== runId) {
        const err = new Error("Stream start cancelled");
        err.name = "AbortError";
        throw err;
      }
    };

    const envError = checkEnvironmentSupport();
    if (envError) {
      setStreamError(envError);
      setStatus("idle");
      toast.error(envError.title, { description: envError.hint });
      return;
    }
    // Credit gate — refuse to start if insufficient credits for >=1 second
    if (remainingCredits !== null && remainingCredits < CREDITS_PER_SECOND) {
      toast.error("Credits exhausted");
      setStatus("idle");
      return;
    }
    setStreamError(null);
    setStatus("connecting");
    setStreamActive(true);
    userStoppedRef.current = false;
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    // Reset per-session credit tracking
    lastTickSecondsRef.current = 0;
    creditsExhaustedRef.current = false;
    try {
      // 0. Open a server-owned streaming session (closes any prior open one).
      const { data: sessData, error: sessErr } = await supabase.functions.invoke("streaming-session", {
        method: "POST",
        body: { action: "start" },
      });
      // Try to surface the real reason (edge function returns { error: "CODE" } on non-2xx).
      let sessBodyCode: string | null = null;
      let sessBodyMessage: string | null = null;
      if (sessErr) {
        try {
          const ctx = (sessErr as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const parsed = await ctx.json();
            sessBodyCode = parsed?.error ?? null;
            sessBodyMessage = parsed?.message ?? null;
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.text();
            try {
              const parsed = JSON.parse(txt);
              sessBodyCode = parsed?.error ?? null;
              sessBodyMessage = parsed?.message ?? null;
            } catch { sessBodyMessage = txt; }
          }
        } catch { /* ignore parse errors */ }
        const code = sessBodyCode ?? "UNKNOWN";
        if (code === "NOT_ACTIVATED") {
          throw new Error("Account not activated. Activate your license to start streaming.");
        }
        if (code === "INSUFFICIENT_CREDITS") {
          throw new Error("Not enough credits to start a stream. Top up to continue.");
        }
        if (code === "PROFILE_NOT_FOUND") {
          throw new Error("Profile not found. Please sign out and sign back in.");
        }
        if (code === "Unauthorized") {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(sessBodyMessage || sessErr.message || "Could not start session");
      }
      if (!sessData?.session_id) throw new Error(sessData?.error || "Could not start session");
      streamingSessionIdRef.current = sessData.session_id;
      if (sessData.credits != null) setRemainingCredits(sessData.credits);
      assertStartCurrent();

      // 1. Mint short-lived client token (and cache for auto-refresh)
      const token = await fetchClientToken();
      currentTokenRef.current = token;
      assertStartCurrent();

      // 2. Pick the realtime model (Lucy 2)
      const model = models.realtime("lucy-2.1");

      // 3. Capture webcam at the model's required resolution/fps
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // Use `ideal` so the UA can pick the closest supported mode rather
          // than failing or forcing a costly software rescale — this keeps
          // the capture pipeline fast and the FPS stable.
          frameRate: { ideal: model.fps, max: model.fps },
          width: { ideal: model.width },
          height: { ideal: model.height },
          ...(selectedVideoId ? { deviceId: { exact: selectedVideoId } } : {}),
        },
        audio: selectedAudioId && selectedAudioId !== "none"
          ? {
              deviceId: { exact: selectedAudioId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });
      assertStartCurrent();
      // Re-enumerate now that labels are unlocked
      refreshDevices();
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => { t.enabled = !micMuted; });
      // Expose raw mic to the input VU meter (isolated audio-only stream)
      const audioTracks = stream.getAudioTracks();
      setRawMicStream(audioTracks.length ? new MediaStream([audioTracks[0]]) : null);
      if (inputVideoRef.current) {
        inputVideoRef.current.srcObject = stream;
        await inputVideoRef.current.play().catch(() => {});
      }

      // 4a. If a voice preset is active and we have audio, route mic through
      //     the voice-changer worklet and swap in the processed track.
      let outboundStream: MediaStream = stream;
      const hasAudio = stream.getAudioTracks().length > 0;
      const activePreset = VOICE_PRESETS.find((p) => p.id === voicePresetId) ?? VOICE_PRESETS[0];
      if (hasAudio && activePreset.id !== "none") {
        try {
          const vc = new VoiceChanger();
          const processed = await vc.init(stream);
          vc.applyPreset(activePreset);
          voiceChangerRef.current = vc;
          const processedTrack = processed.getAudioTracks()[0];
          if (processedTrack) {
            processedTrack.enabled = !micMuted;
            outboundStream = new MediaStream([
              ...stream.getVideoTracks(),
              processedTrack,
            ]);
            // Expose processed audio to its VU meter
            setProcessedMicStream(new MediaStream([processedTrack]));
          }
        } catch (vcErr) {
          console.error("Voice changer init failed", vcErr);
          toast.error("Voice changer unavailable", {
            description: "Continuing with original voice.",
          });
        }
      }

      // Cache the outbound stream so reconnect attempts can reuse it.
      outboundStreamRef.current = outboundStream;

      // Initialise adaptive-quality controller at the model's native tier.
      adaptiveBaseRef.current = { w: model.width, h: model.height, fps: model.fps };
      adaptiveTierRef.current = 3; // top tier (native)
      adaptiveLastChangeRef.current = performance.now();
      adaptivePoorStreakRef.current = 0;
      adaptiveGoodStreakRef.current = 0;

      // 4. Connect to Decart realtime via WebRTC (with auto-reconnect handlers)
      const realtime = await connectRealtime(outboundStream);
      assertStartCurrent();

      realtimeRef.current = realtime;
      setRealtimeClient(realtime);
      sessionStartRef.current = Date.now();
      setUsageElapsed(0);
      setUsageState("tracking");
      if (usageTickRef.current !== null) window.clearInterval(usageTickRef.current);
      usageTickRef.current = window.setInterval(() => {
        if (sessionStartRef.current) {
          setUsageElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
        }
      }, 1000);
      setStatus("active");
      // Start auto-refreshing the ephemeral token in the background.
      scheduleTokenRefresh();
      // Heartbeat the server every 5s so credits are deducted atomically
      // and the session stays alive.
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = window.setInterval(() => { void sendHeartbeat(); }, 5000);
      toast.success("Connected");
    } catch (err) {
      console.error(err);
      setStatus("idle");
      setStreamActive(false);
      clearTokenRefresh();
      clearReconnectTimer();
      clearHeartbeat();
      currentTokenRef.current = null;
      outboundStreamRef.current = null;
      // Roll back the server session so the user isn't blocked by the
      // single-active-session guard on the next attempt.
      if (streamingSessionIdRef.current) {
        void endStreamingSession("start_failed");
      }
      const classified = classifyError(err);
      setStreamError(classified);
      toast.error(classified.title, { description: classified.hint });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setRawMicStream(null);
      setProcessedMicStream(null);
    }
  };

  const stopStream = () => {
    startRunRef.current += 1;
    const hadActiveStream = streamActive || status !== "idle" || Boolean(streamingSessionIdRef.current);
    if (isRecording) stopRecording();
    userStoppedRef.current = true;
    isReconnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    clearReconnectTimer();
    clearTokenRefresh();
    clearHeartbeat();
    currentTokenRef.current = null;
    outboundStreamRef.current = null;
    // Reset adaptive controller
    adaptiveBaseRef.current = null;
    adaptiveTierRef.current = -1;
    adaptivePoorStreakRef.current = 0;
    adaptiveGoodStreakRef.current = 0;
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
    setRealtimeClient(null);
    setLiveRttMs(null);
    setLiveFps(null);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    voiceChangerRef.current?.dispose();
    voiceChangerRef.current = null;
    transformedStreamRef.current = null;
    setRawMicStream(null);
    setProcessedMicStream(null);
    if (inputVideoRef.current) inputVideoRef.current.srcObject = null;
    if (outputVideoRef.current) outputVideoRef.current.srcObject = null;
    setStreamActive(false);
    setTransformedReady(false);
    setStatus("idle");
    if (hadActiveStream) toast("Stream stopped");
    void reportUsage().then(() => {
      // Re-sync credits from backend after usage is recorded
      refreshProfile().then(() => {
        if (user) {
          supabase.from("profiles").select("credits").eq("id", user.id).maybeSingle()
            .then(({ data }) => {
              if (data) setRemainingCredits(data.credits);
            });
        }
      });
    });
  };

  // Keep ref in sync so the generationTick callback can call the latest stopStream
  useEffect(() => {
    stopStreamRef.current = stopStream;
  });

  const pickRecorderMime = (): string | undefined => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    }
    return undefined;
  };

  const startRecording = () => {
    const stream = transformedStreamRef.current;
    if (!stream) {
      toast.error("Stream not ready", { description: "Wait for the AI output to go LIVE." });
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("Recording not supported", { description: "MediaRecorder is unavailable in this browser." });
      return;
    }
    try {
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
        recordedChunksRef.current = [];
        if (blob.size === 0) {
          toast.error("Empty recording");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "facelume-recording.webm";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Recording saved", { description: "facelume-recording.webm" });
      };
      recorder.start(1000); // 1s chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      toast.success("Recording started");
    } catch (err) {
      console.error(err);
      toast.error("Could not start recording", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch (e) { console.error(e); }
    }
    mediaRecorderRef.current = null;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setReferenceImage({ url, file });
    toast.success("Reference image loaded", { description: file.name });

    if (realtimeRef.current?.isConnected()) {
      try {
        await realtimeRef.current.set({
          image: file,
          prompt,
          enhance: true,
        });
        toast.success("Reference applied to live stream");
      } catch (err) {
        toast.error("Failed to apply reference", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  const applyPrompt = async () => {
    if (!realtimeRef.current?.isConnected()) {
      toast("Prompt saved", { description: "Will be applied when stream starts" });
      return;
    }
    try {
      await realtimeRef.current.setPrompt(prompt, { enhance: true });
      toast.success("Prompt updated");
    } catch (err) {
      toast.error("Failed to update prompt", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const meta = statusMeta[status];

  // Detect Electron to offset for the 32px custom title bar
  const isElectron = typeof window !== "undefined" && Boolean((window as unknown as { facelume?: { isElectron?: boolean } }).facelume?.isElectron);
  const shellHeight = isElectron ? "calc(100vh - 32px)" : "100vh";

  const creditsBadgeClass = creditsLoading
    ? "border-border/50 text-muted-foreground"
    : (remainingCredits ?? 0) < CREDITS_PER_SECOND
    ? "border-destructive/60 bg-destructive/15 text-destructive animate-pulse"
    : (remainingCredits ?? 0) < 60 // <30 seconds
    ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
    : "border-secondary/50 bg-secondary/10 text-secondary";

  const creditsLabel = creditsLoading
    ? "…"
    : (() => {
        const isLive = status === "active" || status === "streaming";
        const credits = isLive && displaySeconds !== null ? displaySeconds : (remainingCredits ?? 0);
        const safe = Math.max(0, credits);
        // Show precise credit balance (1 decimal while live, integer otherwise).
        const formatted = isLive ? safe.toFixed(1) : Math.floor(safe).toLocaleString();
        return `${formatted} credits`;
      })();

  if (authLoading || !allowedToView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <title>FaceLume Studio — Live AI Streaming</title>
      <meta name="description" content="Real-time AI face transformation studio powered by Decart Lucy 2. Connect your camera, apply a style, go live." />

      <div className="flex flex-col bg-background text-foreground overflow-hidden" style={{ height: shellHeight }}>
        {/* === TOP BAR === */}
        <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="font-display font-black text-base tracking-[0.25em]">
              FACE<span className="neon-text">LUME</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-l border-border/60 pl-3">Studio</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className={`block w-2 h-2 rounded-full ${meta.color}`} />
                {meta.pulse && <span className={`absolute inset-0 rounded-full ${meta.color} animate-ping opacity-75`} />}
              </div>
              <span className="tracking-widest text-[11px]">{meta.label}</span>
            </div>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><Activity className="w-3 h-3 text-secondary" /> {liveFps != null ? `${liveFps} FPS` : "—"}</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><Wifi className="w-3 h-3 text-accent" /> {liveRttMs != null ? `${liveRttMs}ms` : "—"}</span>
            {user && (
              <button
                type="button"
                onClick={() => setTopUpOpen(true)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors hover:bg-muted/40 ${creditsBadgeClass}`}
                title="Streaming credits remaining (click to top up)"
              >
                <Clock className="w-3 h-3" />
                <span>{creditsLabel}</span>
              </button>
            )}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-1 py-0.5 rounded-full border border-border/60 hover:bg-muted/40 transition-colors"
                    title="Account"
                  >
                    <span className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                      {(profile?.display_name || user.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-strong">
                  <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      try { stopStreamRef.current?.(); } catch { /* ignore */ }
                      await signOut();
                      navigate("/");
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* === COMPRESSED QUALITY STRIP (was bottom panel) === */}
        <StreamQualityPanel
          realtime={realtimeClient}
          status={status}
          compact
          className="mx-2 mt-2 shrink-0"
        />

        {/* === BODY: SIDEBAR + MAIN === */}
        <div className="flex-1 min-h-0 flex">
          {/* === LEFT SIDEBAR === */}
          <aside className="w-[320px] shrink-0 border-r border-border/50 bg-card/30 overflow-y-auto">
            <div className="p-3 space-y-4">
              {/* DEVICES */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">Devices</h3>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    <Camera className="w-3 h-3 inline mr-1" /> Camera
                  </label>
                  <Select value={selectedVideoId} onValueChange={setSelectedVideoId} disabled={streamActive}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={videoDevices.length ? "Select camera" : "No cameras"} />
                    </SelectTrigger>
                    <SelectContent>
                      {videoDevices.map((d, i) => (
                        <SelectItem key={d.deviceId || i} value={d.deviceId || `cam-${i}`}>
                          {d.label || `Camera ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    <Mic className="w-3 h-3 inline mr-1" /> Microphone
                  </label>
                  <div className="flex items-center gap-1">
                    <Select value={selectedAudioId} onValueChange={setSelectedAudioId} disabled={streamActive}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Select mic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No microphone</SelectItem>
                        {audioDevices.map((d, i) => (
                          <SelectItem key={d.deviceId || i} value={d.deviceId || `mic-${i}`}>
                            {d.label || `Microphone ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={meterActive ? stopMeter : startMeter}
                      disabled={streamActive || selectedAudioId === "none" || !selectedAudioId}
                      title={meterActive ? "Stop mic test" : "Test microphone"}
                      className={`shrink-0 h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
                        meterActive
                          ? "border-secondary/60 text-secondary bg-secondary/10"
                          : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {meterActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleMicMute}
                      disabled={selectedAudioId === "none" || !selectedAudioId}
                      title={`${micMuted ? "Unmute" : "Mute"} (M)`}
                      aria-pressed={micMuted}
                      className={`shrink-0 h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
                        micMuted
                          ? "border-destructive/60 text-destructive bg-destructive/10"
                          : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {micMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {meterActive && (
                    <div ref={meterBarsRef} className="mt-1.5 flex items-end gap-[2px] h-1.5" aria-label="Mic level">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <div
                          key={i}
                          data-bar
                          className={`flex-1 rounded-[1px] transition-opacity duration-75 h-full ${
                            i < 22 ? "bg-secondary" : i < 28 ? "bg-yellow-400" : "bg-destructive"
                          }`}
                          style={{ opacity: 0.15 }}
                        />
                      ))}
                    </div>
                  )}
                  {meterError && (
                    <p className="text-[10px] font-mono text-destructive mt-1">{meterError}</p>
                  )}
                </div>

                {!devicesLabeled && (
                  <Button variant="glass" size="sm" onClick={requestDevicePermissions} disabled={streamActive} className="w-full h-8 text-xs">
                    <Camera className="w-3.5 h-3.5" /> Unlock device names
                  </Button>
                )}
              </section>

              {/* TRANSFORM — Reference image only (style prompt + voice moved to bottom strip) */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">Transform</h3>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Reference Image</label>
                  <label>
                    <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
                    <Button variant="glass" size="sm" asChild className="w-full h-8 text-xs">
                      <span className="cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> {referenceImage ? "Change" : "Upload"}
                      </span>
                    </Button>
                  </label>
                  {referenceImage && (
                    <div className="flex items-center gap-2 px-2 py-1.5 mt-1.5 rounded-md bg-primary/10 border border-primary/30">
                      <img src={referenceImage.url} alt="Reference" className="w-6 h-6 rounded object-cover" />
                      <span className="text-[10px] font-mono text-primary-glow truncate">REFERENCE LOADED</span>
                    </div>
                  )}
                </div>
              </section>

              {/* AUDIO LEVELS (live) */}
              {streamActive && rawMicStream && (
                <section className="space-y-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">Audio Levels</h3>
                  <div className="space-y-2 rounded-md border border-border/40 bg-muted/20 p-2">
                    <VuMeter
                      stream={rawMicStream}
                      label="Mic in"
                      colorClass="bg-secondary"
                      onClip={() => {
                        if (lastClipToastRef.current && Date.now() - lastClipToastRef.current < 8000) return;
                        lastClipToastRef.current = Date.now();
                        toast.warning("Mic input is clipping");
                      }}
                    />
                    <VuMeter
                      stream={processedMicStream ?? rawMicStream}
                      label={processedMicStream ? "Voice out" : "Out"}
                      colorClass="bg-primary"
                      onClip={() => {
                        if (lastOutClipToastRef.current && Date.now() - lastOutClipToastRef.current < 8000) return;
                        lastOutClipToastRef.current = Date.now();
                        toast.warning("Voice output is clipping");
                      }}
                    />
                  </div>
                </section>
              )}

              {/* STREAM ACTIONS */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">Stream</h3>

                <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md glass cursor-pointer hover:border-primary/40 transition-colors">
                  <span className="flex items-center gap-2">
                    <Zap className={`w-3.5 h-3.5 ${lowLatency ? "text-secondary" : "text-muted-foreground"}`} />
                    <span className="text-[11px] font-mono uppercase tracking-wider">Low-Latency</span>
                  </span>
                  <Switch
                    checked={lowLatency}
                    onCheckedChange={(v) => {
                      setLowLatency(v);
                      toast(v ? "Low-latency mode enabled" : "Standard mode");
                    }}
                  />
                </label>

                {!streamActive ? (
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={startStream}
                    disabled={status === "connecting" || (remainingCredits !== null && remainingCredits < CREDITS_PER_SECOND)}
                    className="w-full h-9"
                  >
                    <Play className="w-4 h-4" />
                    {status === "connecting"
                      ? "Connecting…"
                      : (remainingCredits !== null && remainingCredits < CREDITS_PER_SECOND)
                      ? "Credits exhausted"
                      : "Start Stream"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopStream}
                    className="w-full h-9 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Square className="w-4 h-4" /> Stop Stream
                  </Button>
                )}

                {!isRecording ? (
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={startRecording}
                    disabled={!transformedReady}
                    className="w-full h-8 text-xs"
                    title={transformedReady ? "Record AI output" : "Waiting for AI output…"}
                  >
                    <Circle className="w-3.5 h-3.5 fill-destructive text-destructive" /> Record
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopRecording}
                    className="w-full h-8 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Download className="w-3.5 h-3.5" /> Stop & Save · {formatDuration(recordingSeconds)}
                  </Button>
                )}

              </section>

              {/* CREDITS */}
              {user && (
                <section className="space-y-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">Credits</h3>
                  <div className={`rounded-md border p-2.5 ${creditsBadgeClass}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider opacity-80">Balance</span>
                      <Clock className="w-3 h-3" />
                    </div>
                    <div className="font-mono text-lg font-bold mt-0.5">{creditsLabel}</div>
                    <Button
                      variant="hero"
                      size="sm"
                      onClick={() => setTopUpOpen(true)}
                      className="w-full h-7 text-[11px] mt-2"
                    >
                      Top up
                    </Button>
                  </div>
                </section>
              )}
            </div>
          </aside>

          {/* === MAIN: VIDEO STAGE === */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden p-2 gap-2">
            {activationBanner && (
              <Alert className="glass-strong border-primary/40 py-2 bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertTitle className="text-sm font-display tracking-wide text-primary">
                  Account activated — +1,200 bonus credits granted
                </AlertTitle>
                <AlertDescription className="text-xs flex items-center justify-between gap-2">
                  <span>Your license key is active and 1,200 streaming credits were added to your balance.</span>
                  <Button size="sm" variant="ghost" onClick={() => setActivationBanner(false)}>
                    <X className="w-3 h-3" /> Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {/* Inline alerts (errors / no credits) */}
            {streamError && (
              <Alert variant="destructive" className="glass-strong border-destructive/40 py-2">
                {streamError.kind === "permission" ? <ShieldOff className="h-4 w-4" /> :
                 streamError.kind === "no-device" ? <VideoOff className="h-4 w-4" /> :
                 streamError.kind === "insecure" ? <Lock className="h-4 w-4" /> :
                 <AlertTriangle className="h-4 w-4" />}
                <AlertTitle className="text-sm font-display tracking-wide">{streamError.title}</AlertTitle>
                <AlertDescription className="text-xs">
                  <p>{streamError.message}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => { setStreamError(null); startStream(); }} disabled={status === "connecting"}>
                      <RefreshCw className="w-3 h-3" /> Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStreamError(null)}>Dismiss</Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {!creditsLoading && user && remainingCredits !== null && remainingCredits < CREDITS_PER_SECOND && (
              <Alert variant="destructive" className="glass-strong border-destructive/40 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm font-display tracking-wide">No credits available</AlertTitle>
                <AlertDescription className="text-xs">
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant="hero" onClick={() => setTopUpOpen(true)}>Buy credits</Button>
                    <Button size="sm" variant="glass" asChild><Link to="/credits">View plans</Link></Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <TopUpModal open={topUpOpen} onOpenChange={setTopUpOpen} onCredited={reloadCredits} />

            {/* Video grid — primary focus, fills remaining space */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
              <StreamWindow
                title="Camera Input"
                tag="LOCAL"
                accent="cyan"
                empty={!streamActive}
                emptyIcon={Camera}
                emptyText="Camera offline"
              >
                <video ref={inputVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              </StreamWindow>

              <div
                className={
                  outputFullscreen
                    ? "fixed inset-0 z-[100] bg-black animate-fade-in"
                    : "relative h-full min-h-0"
                }
              >
                <StreamWindow
                  title="AI Output · Lucy 2"
                  tag={transformedReady ? "LIVE" : "STANDBY"}
                  accent="purple"
                  empty={!transformedReady}
                  emptyIcon={Sparkles}
                  emptyText={streamActive ? "Connecting model…" : "Start stream to begin"}
                  fullscreen={outputFullscreen}
                  headerAction={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMonitorOutput((v) => !v)}
                        className={`p-1 rounded hover:bg-muted/40 transition-colors ${monitorOutput ? "text-secondary" : "text-muted-foreground hover:text-foreground"}`}
                        title={monitorOutput ? "Mute monitor (use headphones to avoid feedback)" : "Hear yourself (monitor output audio)"}
                        aria-label={monitorOutput ? "Mute output monitor" : "Unmute output monitor"}
                      >
                        {monitorOutput ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          userExitedFullscreenRef.current = outputFullscreen;
                          setOutputFullscreen((v) => !v);
                        }}
                        className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                        title={outputFullscreen ? "Exit full screen (Esc)" : "Full screen"}
                        aria-label={outputFullscreen ? "Exit full screen" : "Enter full screen"}
                      >
                        {outputFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  }
                >
                  <video
                    ref={outputVideoRef}
                    autoPlay
                    playsInline
                    muted={!monitorOutput}
                    // Decode hints: keep playback close to live, prefer
                    // smooth motion over perfect frame ordering.
                    // @ts-expect-error - non-standard attribute supported by Chromium
                    disableremoteplayback="true"
                    className="w-full h-full object-cover [will-change:transform] [transform:translateZ(0)]"
                  />
                  {transformedReady && !outputFullscreen && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/20 to-transparent animate-scan-line" />
                    </div>
                  )}
                  {/* Idle / connecting state: gentle pulse so the surface feels alive */}
                  {!transformedReady && !outputFullscreen && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-primary/10 blur-2xl animate-pulse-glow" />
                    </div>
                  )}

                  {/* Fullscreen overlay — minimal: status + Stop + Exit, fade in on hover */}
                  {outputFullscreen && (
                    <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                      {/* Top-left: status indicator only */}
                      <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono">
                        <span className="relative flex w-2 h-2">
                          <span className={`block w-2 h-2 rounded-full ${meta.color}`} />
                          {meta.pulse && <span className={`absolute inset-0 rounded-full ${meta.color} animate-ping opacity-75`} />}
                        </span>
                        <span className="tracking-widest text-[11px] text-white/90">{meta.label}</span>
                      </div>
                      {/* Top-right: Stop + Exit only */}
                      <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
                        {status !== "idle" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={stopStream}
                            className="h-9 border-destructive/60 text-destructive hover:bg-destructive/15 hover:text-destructive bg-black/60 backdrop-blur-md"
                          >
                            <Square className="w-4 h-4" /> Stop
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="glass"
                          onClick={() => {
                            userExitedFullscreenRef.current = true;
                            setOutputFullscreen(false);
                          }}
                          className="h-9 bg-black/60 backdrop-blur-md text-white/90"
                          title="Exit full screen (Esc)"
                        >
                          <Minimize2 className="w-4 h-4" /> Exit
                        </Button>
                      </div>
                    </div>
                  )}
                </StreamWindow>
              </div>
            </div>

            {/* === BOTTOM CONTROL DECK === */}
            <div className="shrink-0 flex flex-col gap-2">
              {/* ROW 1 — Style Prompt (full width, primary creative control) */}
              <div className="glass rounded-md p-3 flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-md bg-gradient-primary flex items-center justify-center shadow-[0_0_18px_hsl(var(--primary)/0.5)]">
                    <Wand2 className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="hidden md:block">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground leading-tight">Style Prompt</div>
                    <div className="text-[10px] text-muted-foreground/70 leading-tight">Describe the look</div>
                  </div>
                </div>
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Cyberpunk samurai, neon rim light, cinematic lighting…"
                  className="h-9 text-sm flex-1 bg-background/60"
                  onKeyDown={(e) => { if (e.key === "Enter") applyPrompt(); }}
                />
                <Button
                  variant="glass"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => {
                    setPrompt("");
                    if (streamActive && realtimeRef.current) {
                      realtimeRef.current.setPrompt("", { enhance: false }).catch(() => {});
                      toast.success("Prompt cleared");
                    }
                  }}
                  disabled={!prompt}
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>
                <Button variant="hero" size="sm" className="h-9 shrink-0" onClick={applyPrompt}>
                  <Wand2 className="w-3.5 h-3.5" /> Apply
                </Button>
              </div>

              {/* ROW 2 — Voice Changer (70%) + unified OBS tools (30%) */}
              {(() => {
                const micMissing = selectedAudioId === "none" || !selectedAudioId;
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-2">
                    {/* Voice Changer — 70% */}
                    <div className="lg:col-span-7 glass rounded-md px-4 py-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                          <Mic className="w-3 h-3" /> Voice Changer
                          {streamActive && voicePresetId !== "none" && (
                            <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-[9px] text-primary">
                              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" /> LIVE
                            </span>
                          )}
                        </label>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                          {VOICE_PRESETS.find((p) => p.id === voicePresetId)?.label ?? "—"}
                        </span>
                      </div>
                      {micMissing && (
                        <div className="flex items-center gap-1.5 text-[10px] text-yellow-400/90">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Microphone required for voice effects</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Voice preset">
                        {VOICE_PRESETS.map((p) => {
                          const active = voicePresetId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setVoicePresetId(p.id)}
                              disabled={micMissing}
                              title={p.description}
                              role="radio"
                              aria-checked={active}
                              className={`group relative px-3.5 py-2 rounded-full border text-[11px] font-mono uppercase tracking-[0.12em] transition-all duration-150 active:scale-[0.97] ${
                                active
                                  ? "border-primary bg-primary/20 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
                                  : "border-border/50 bg-background/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border hover:shadow-[0_0_10px_hsl(var(--primary)/0.15)]"
                              } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background/30 disabled:hover:text-muted-foreground disabled:hover:shadow-none`}
                            >
                              {active && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5 align-middle shadow-[0_0_6px_hsl(var(--primary))]" />
                              )}
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* OBS tools — 30%, unified block */}
                    <div className="lg:col-span-3 glass rounded-md px-4 py-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                          <Wand2 className="w-3 h-3" /> OBS Tools
                        </label>
                      </div>
                      <div className="flex flex-col gap-2 [&>*]:w-full [&_button]:w-full [&_button]:justify-center [&_button]:h-9">
                        <OBSConnectionTest />
                        <OBSGuide />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            {isRecording && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-destructive/50 bg-destructive/10 text-destructive self-start"
                role="status"
                aria-live="polite"
              >
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-destructive" />
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider">REC · {formatDuration(recordingSeconds)}</span>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

const StreamWindow = ({
  title, tag, accent, empty, emptyIcon: EmptyIcon, emptyText, children, headerAction, fullscreen = false,
}: {
  title: string; tag: string; accent: "cyan" | "purple"; empty: boolean;
  emptyIcon: React.ComponentType<{ className?: string }>; emptyText: string; children?: React.ReactNode;
  headerAction?: React.ReactNode; fullscreen?: boolean;
}) => {
  const ring = accent === "purple" ? "from-primary to-primary-glow" : "from-secondary to-accent";
  const dotColor = accent === "purple" ? "bg-primary" : "bg-secondary";
  return (
    <div className={`relative group ${fullscreen ? "h-full w-full" : "h-full w-full min-h-0"}`}>
      {!fullscreen && (
        <div className={`absolute -inset-0.5 bg-gradient-to-br ${ring} rounded-2xl opacity-40 blur-md group-hover:opacity-70 transition-opacity`} />
      )}
      <div className={`relative overflow-hidden flex flex-col ${fullscreen ? "h-full w-full rounded-none bg-black" : "h-full w-full glass-strong rounded-2xl"}`}>
        {!fullscreen && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-background/40 shrink-0">
            <div className="font-display font-bold text-sm tracking-wider">{title}</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                {tag}
              </div>
              {headerAction}
            </div>
          </div>
        )}
        <div className={`relative ${fullscreen ? "flex-1 min-h-0 bg-black" : "flex-1 min-h-0 bg-background/60"}`}>
          {children}
          {empty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <EmptyIcon className="w-12 h-12 opacity-50" />
              <span className="text-sm font-mono uppercase tracking-widest">{emptyText}</span>
            </div>
          )}
          {!fullscreen && [0, 1, 2, 3].map((c) => (
            <div key={c} className={`absolute w-5 h-5 border-primary/60 ${
              c === 0 ? "top-2 left-2 border-t-2 border-l-2" :
              c === 1 ? "top-2 right-2 border-t-2 border-r-2" :
              c === 2 ? "bottom-2 left-2 border-b-2 border-l-2" :
              "bottom-2 right-2 border-b-2 border-r-2"
            }`} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
