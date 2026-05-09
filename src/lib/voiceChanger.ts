// Real-time voice changer using Web Audio + AudioWorklet.
// Takes a raw mic MediaStream, returns a processed MediaStream with the
// same metadata (single audio track) but pitch/ring-modulated.

export type VoicePresetId = "none" | "deep" | "chipmunk" | "robot" | "alien" | "demon";

export interface VoicePreset {
  id: VoicePresetId;
  label: string;
  description: string;
  pitch: number;     // 1.0 = no change
  ringFreq: number;  // 0 = disabled
  ringMix: number;   // 0..1
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "none",     label: "Original",  description: "No effect",                pitch: 1.0,  ringFreq: 0,    ringMix: 0 },
  { id: "deep",     label: "Deep",      description: "Lower, heavier voice",     pitch: 0.72, ringFreq: 0,    ringMix: 0 },
  { id: "demon",    label: "Demon",     description: "Very deep + growl",        pitch: 0.55, ringFreq: 30,   ringMix: 0.35 },
  { id: "chipmunk", label: "Chipmunk",  description: "High pitched",             pitch: 1.55, ringFreq: 0,    ringMix: 0 },
  { id: "robot",    label: "Robot",     description: "Metallic ring modulation", pitch: 1.0,  ringFreq: 110,  ringMix: 0.7 },
  { id: "alien",    label: "Alien",     description: "Pitched + warble",         pitch: 1.25, ringFreq: 55,   ringMix: 0.5 },
];

export class VoiceChanger {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private inputStream: MediaStream | null = null;
  private outputStream: MediaStream | null = null;
  private preset: VoicePreset = VOICE_PRESETS[0];

  /** Initialise the audio graph from the given mic stream. */
  async init(inputStream: MediaStream): Promise<MediaStream> {
    await this.dispose();
    this.inputStream = inputStream;

    const Ctx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    await ctx.audioWorklet.addModule("/voice-changer-worklet.js");

    this.source = ctx.createMediaStreamSource(inputStream);
    this.worklet = new AudioWorkletNode(ctx, "voice-changer-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    this.destination = ctx.createMediaStreamDestination();

    this.source.connect(this.worklet);
    this.worklet.connect(this.destination);

    this.applyPreset(this.preset);
    this.outputStream = this.destination.stream;
    return this.outputStream;
  }

  /** Currently active preset. */
  getPreset(): VoicePreset {
    return this.preset;
  }

  /** Apply a new preset. Safe to call any time after init(). */
  applyPreset(preset: VoicePreset) {
    this.preset = preset;
    if (!this.worklet) return;
    const setParam = (name: string, value: number) => {
      const p = (this.worklet!.parameters as unknown as Map<string, AudioParam>).get(name);
      if (p) p.setTargetAtTime(value, this.ctx!.currentTime, 0.01);
    };
    setParam("pitch", preset.pitch);
    setParam("ringFreq", preset.ringFreq);
    setParam("ringMix", preset.ringMix);
  }

  /** Get the processed audio track (single mono track). */
  getProcessedTrack(): MediaStreamTrack | null {
    return this.outputStream?.getAudioTracks()[0] ?? null;
  }

  async dispose() {
    try { this.source?.disconnect(); } catch { /* noop */ }
    try { this.worklet?.disconnect(); } catch { /* noop */ }
    try { this.destination?.disconnect(); } catch { /* noop */ }
    if (this.ctx && this.ctx.state !== "closed") {
      try { await this.ctx.close(); } catch { /* noop */ }
    }
    this.source = null;
    this.worklet = null;
    this.destination = null;
    this.ctx = null;
    this.inputStream = null;
    this.outputStream = null;
  }
}
