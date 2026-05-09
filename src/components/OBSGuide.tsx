import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy, Radio, Video, Settings2, Zap, Server, Key, Cpu, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VIRTUAL_CAM_NAME = "FaceLume Virtual Camera";
const DEFAULT_RTMP_URL = "rtmp://stream.facelume.live/live";
const DEFAULT_STREAM_KEY = "fl_xxxx-xxxx-xxxx";

type EncoderId = "x264" | "nvenc" | "apple_vt" | "amf";

const ENCODERS: Record<EncoderId, {
  label: string;
  obsName: string;
  rateControl: string;
  bitrate: string;
  keyframe: string;
  preset: string;
  profile: string;
  extra: string;
}> = {
  x264: {
    label: "x264 (CPU)",
    obsName: "x264",
    rateControl: "CBR",
    bitrate: "4500–6000 Kbps",
    keyframe: "2s",
    preset: "veryfast",
    profile: "main",
    extra: "Tune: zerolatency",
  },
  nvenc: {
    label: "NVIDIA NVENC H.264",
    obsName: "NVIDIA NVENC H.264",
    rateControl: "CBR",
    bitrate: "6000–8000 Kbps",
    keyframe: "2s",
    preset: "P5: Quality",
    profile: "high",
    extra: "Tuning: Low Latency · Multipass: Quarter Resolution",
  },
  apple_vt: {
    label: "Apple VideoToolbox",
    obsName: "Apple VT H264 Hardware Encoder",
    rateControl: "CBR",
    bitrate: "5000–7000 Kbps",
    keyframe: "2s",
    preset: "—",
    profile: "main",
    extra: "Enable B-Frames: off",
  },
  amf: {
    label: "AMD AMF H.264",
    obsName: "AMD HW H.264 (AVC)",
    rateControl: "CBR",
    bitrate: "6000–8000 Kbps",
    keyframe: "2s",
    preset: "Quality",
    profile: "high",
    extra: "Pre-Analysis: off · Latency Optimized: on",
  },
};

const Step = ({ n, title, children, tone = "primary" }: { n: number | React.ReactNode; title: string; children: React.ReactNode; tone?: "primary" | "secondary" }) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        tone === "secondary"
          ? "bg-secondary/20 border border-secondary/50 text-secondary"
          : "bg-gradient-primary shadow-[0_0_16px_hsl(var(--primary)/0.6)]"
      }`}>
        {n}
      </div>
      <div className="w-px flex-1 bg-border/50 my-2" />
    </div>
    <div className="pb-6 flex-1">
      <h4 className="font-display font-bold mb-1.5">{title}</h4>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </div>
  </div>
);

const CopyField = ({ value, masked = false }: { value: string; masked?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-background/60 border border-border/50">
      <code className="flex-1 text-xs font-mono text-primary-glow truncate">
        {masked ? "•".repeat(Math.min(value.length, 24)) : value}
      </code>
      <Button size="sm" variant="ghost" onClick={copy} className="h-7 px-2">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
};

type DetectionResult = { encoder: EncoderId; gpu: string; reason: string };

const detectGpuEncoder = async (): Promise<DetectionResult> => {
  // Try WebGL UNMASKED_RENDERER for GPU vendor/model fingerprinting
  let renderer = "";
  let vendor = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "");
        vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "");
      }
    }
  } catch { /* noop */ }

  const haystack = `${vendor} ${renderer}`.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  const isMac = platform.includes("mac") || ua.includes("mac os");

  if (/nvidia|geforce|quadro|rtx|gtx|nvenc/.test(haystack)) {
    return { encoder: "nvenc", gpu: renderer || "NVIDIA GPU", reason: "NVIDIA GPU detected — NVENC offers the lowest CPU overhead." };
  }
  if (isMac || /apple|m1|m2|m3|metal/.test(haystack)) {
    return { encoder: "apple_vt", gpu: renderer || "Apple Silicon / Mac", reason: "Apple hardware detected — VideoToolbox is the native low-latency path." };
  }
  if (/amd|radeon|amf|rdna/.test(haystack)) {
    return { encoder: "amf", gpu: renderer || "AMD GPU", reason: "AMD GPU detected — AMF leverages your dedicated encoder." };
  }
  if (/intel|iris|uhd|hd graphics|quicksync/.test(haystack)) {
    return { encoder: "x264", gpu: renderer || "Intel iGPU", reason: "Intel iGPU detected — x264 stays most reliable until QuickSync support ships." };
  }
  return { encoder: "x264", gpu: renderer || "Unknown GPU", reason: "Couldn't fingerprint GPU — defaulting to x264 (works everywhere)." };
};

export const OBSGuide = () => {
  const [rtmpMode, setRtmpMode] = useState(false);
  const [rtmpUrl, setRtmpUrl] = useState(DEFAULT_RTMP_URL);
  const [streamKey, setStreamKey] = useState(DEFAULT_STREAM_KEY);
  const [encoder, setEncoder] = useState<EncoderId>("x264");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectionResult | null>(null);
  const enc = ENCODERS[encoder];

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      // Tiny artificial delay so the spinner registers
      await new Promise((r) => setTimeout(r, 250));
      const result = await detectGpuEncoder();
      setDetected(result);
      setEncoder(result.encoder);
      toast.success(`${ENCODERS[result.encoder].label} preselected`, { description: result.gpu });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="glass">
          <Radio /> OBS Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl glass-strong max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" /> Stream to OBS Studio
          </DialogTitle>
          <DialogDescription>
            Pipe your AI-transformed output into OBS for streaming, recording, or video calls.
          </DialogDescription>
        </DialogHeader>

        {/* Workflow toggle */}
        <div className="mt-4 p-4 rounded-lg border border-border/50 bg-background/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Server className={`w-5 h-5 ${rtmpMode ? "text-secondary" : "text-muted-foreground"}`} />
            <div>
              <div className="font-display font-bold text-sm">
                {rtmpMode ? "Direct RTMP Workflow" : "Virtual Camera Workflow"}
              </div>
              <div className="text-xs text-muted-foreground">
                {rtmpMode ? "Push directly to an RTMP endpoint — no OBS Virtual Cam needed." : "Capture FaceLume output through OBS as a video device."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">RTMP</span>
            <Switch checked={rtmpMode} onCheckedChange={(v) => {
              setRtmpMode(v);
              toast(v ? "RTMP workflow enabled" : "Virtual Camera workflow enabled");
            }} />
          </div>
        </div>

        <div className="mt-4">
          {!rtmpMode ? (
            <>
              <Step n={1} title="Enable Low-Latency Mode">
                <p>Toggle <span className="text-foreground font-semibold">Low-Latency</span> in the studio controls. This drops processing buffers below 80ms — required for live streaming.</p>
              </Step>
              <Step n={2} title="Install OBS Studio">
                <p>Download OBS from <a href="https://obsproject.com" target="_blank" rel="noreferrer" className="text-primary hover:text-primary-glow underline underline-offset-2">obsproject.com</a> (Windows, macOS, Linux).</p>
              </Step>
              <Step n={3} title="Add the FaceLume Virtual Camera">
                <p>In OBS, click <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">+</kbd> under <span className="text-foreground">Sources</span> → <span className="text-foreground">Video Capture Device</span>, then select:</p>
                <CopyField value={VIRTUAL_CAM_NAME} />
              </Step>
              <Step n={4} title="Match Resolution & FPS">
                <p>Open <span className="text-foreground">Settings → Video</span> and set:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Base & Output resolution: <span className="text-foreground font-mono">1280×720</span></li>
                  <li>Common FPS Value: <span className="text-foreground font-mono">60</span></li>
                  <li>Color Format: <span className="text-foreground font-mono">NV12</span></li>
                </ul>
              </Step>
              <Step n={<Check className="w-4 h-4" />} title="You're live" tone="secondary">
                <p>Hit <span className="text-foreground">Start Virtual Camera</span> in OBS. Your AI output will appear in your scene.</p>
              </Step>
            </>
          ) : (
            <>
              <Step n={1} title="Enable Low-Latency Mode">
                <p>Required for RTMP — keeps glass-to-glass latency under 100ms.</p>
              </Step>
              <Step n={2} title="Paste your RTMP endpoint">
                <p>Use the FaceLume default, or paste a Twitch / YouTube / Restream URL.</p>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      value={rtmpUrl}
                      onChange={(e) => setRtmpUrl(e.target.value)}
                      placeholder="rtmp://live.twitch.tv/app"
                      className="font-mono text-xs h-9 bg-background/60"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      value={streamKey}
                      onChange={(e) => setStreamKey(e.target.value)}
                      placeholder="Stream key"
                      type="password"
                      className="font-mono text-xs h-9 bg-background/60"
                    />
                  </div>
                </div>
              </Step>
              <Step n={3} title="Configure OBS Stream settings">
                <p>In OBS, open <span className="text-foreground">Settings → Stream</span> → Service: <span className="text-foreground font-mono">Custom...</span></p>
                <p className="text-foreground">Server</p>
                <CopyField value={rtmpUrl || DEFAULT_RTMP_URL} />
                <p className="text-foreground mt-2">Stream Key</p>
                <CopyField value={streamKey || DEFAULT_STREAM_KEY} masked />
              </Step>
              <Step n={4} title="Tune the encoder for low latency">
                <p>Auto-detect your GPU or pick manually — the checklist updates automatically.</p>
                <div className="flex items-center gap-2 mt-2">
                  <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select value={encoder} onValueChange={(v) => {
                    setEncoder(v as EncoderId);
                    toast(`${ENCODERS[v as EncoderId].label} preset loaded`);
                  }}>
                    <SelectTrigger className="h-9 bg-background/60 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ENCODERS) as EncoderId[]).map((id) => (
                        <SelectItem key={id} value={id} className="font-mono text-xs">
                          {ENCODERS[id].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={handleAutoDetect}
                    disabled={detecting}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Auto-detect
                  </Button>
                </div>
                {detected && (
                  <div className="mt-2 p-2.5 rounded-md border border-secondary/40 bg-secondary/10 flex gap-2 items-start">
                    <Sparkles className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="text-foreground font-mono truncate">{detected.gpu}</div>
                      <div className="text-muted-foreground">{detected.reason}</div>
                    </div>
                  </div>
                )}
                <p className="mt-3">In <span className="text-foreground">Settings → Output</span> (Advanced) set:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Encoder: <span className="text-foreground font-mono">{enc.obsName}</span></li>
                  <li>Rate Control: <span className="text-foreground font-mono">{enc.rateControl}</span> · Bitrate <span className="text-foreground font-mono">{enc.bitrate}</span></li>
                  <li>Keyframe Interval: <span className="text-foreground font-mono">{enc.keyframe}</span></li>
                  <li>Preset: <span className="text-foreground font-mono">{enc.preset}</span></li>
                  <li>Profile: <span className="text-foreground font-mono">{enc.profile}</span></li>
                  <li>{enc.extra}</li>
                </ul>
              </Step>
              <Step n={<Check className="w-4 h-4" />} title="Start streaming" tone="secondary">
                <p>Click <span className="text-foreground">Start Streaming</span> in OBS. The FaceLume output will publish straight to your RTMP endpoint.</p>
              </Step>
            </>
          )}

          <div className="mt-2 p-4 rounded-lg border border-primary/30 bg-primary/5 flex gap-3">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-semibold">Pro tip:</span> Combine <Settings2 className="inline w-3 h-3" /> <span className="font-mono">Tune: zerolatency</span> with FaceLume's low-latency mode for sub-100ms end-to-end on Twitch / YouTube.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
