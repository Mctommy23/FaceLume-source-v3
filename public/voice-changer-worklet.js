// Granular pitch-shifter AudioWorklet.
// Uses two overlapping read pointers in a circular buffer with cross-fading
// to shift pitch in real time without changing speed (much).
// Params:
//   pitch        — pitch ratio (0.5 = octave down, 2.0 = octave up)
//   ringFreq     — ring-mod frequency in Hz (0 disables)
//   ringMix      — 0..1 dry/wet for ring mod
//   formantBoost — simple high-shelf-ish gain on shifted signal (0..1 mix)

class VoiceChangerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "pitch", defaultValue: 1.0, minValue: 0.25, maxValue: 4.0, automationRate: "k-rate" },
      { name: "ringFreq", defaultValue: 0, minValue: 0, maxValue: 2000, automationRate: "k-rate" },
      { name: "ringMix", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.bufSize = 8192;
    this.buf = new Float32Array(this.bufSize);
    this.writeIdx = 0;
    // Two read positions, offset by half grain for crossfade
    this.grain = 1024; // grain length in samples
    this.read1 = 0;
    this.read2 = this.grain / 2;
    this.phase = 0; // ring-mod phase
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    const inCh = input[0];
    const outCh = output[0];
    if (!inCh || !outCh) return true;

    const pitch = params.pitch[0];
    const ringFreq = params.ringFreq[0];
    const ringMix = params.ringMix[0];
    const sr = sampleRate;
    const grain = this.grain;
    const halfGrain = grain / 2;

    for (let i = 0; i < inCh.length; i++) {
      // Write input to circular buffer
      this.buf[this.writeIdx] = inCh[i];
      this.writeIdx = (this.writeIdx + 1) % this.bufSize;

      // Advance read heads at `pitch` rate
      this.read1 += pitch;
      this.read2 += pitch;
      if (this.read1 >= this.bufSize) this.read1 -= this.bufSize;
      if (this.read2 >= this.bufSize) this.read2 -= this.bufSize;

      // Linear interpolation reads
      const sample = (pos) => {
        const p = pos < 0 ? pos + this.bufSize : pos;
        const i0 = Math.floor(p) % this.bufSize;
        const i1 = (i0 + 1) % this.bufSize;
        const frac = p - Math.floor(p);
        return this.buf[i0] * (1 - frac) + this.buf[i1] * frac;
      };

      // Distance from write head (in samples behind) — keep within grain window
      const dist1 = (this.writeIdx - this.read1 + this.bufSize) % this.bufSize;
      const dist2 = (this.writeIdx - this.read2 + this.bufSize) % this.bufSize;

      // Wrap reads to stay within `grain` samples of the write head
      if (dist1 > grain) this.read1 = (this.writeIdx - grain + this.bufSize) % this.bufSize;
      if (dist2 > grain) this.read2 = (this.writeIdx - grain + this.bufSize) % this.bufSize;

      // Crossfade window based on distance from write head
      const w1 = 0.5 - 0.5 * Math.cos((Math.PI * 2 * dist1) / grain);
      const w2 = 0.5 - 0.5 * Math.cos((Math.PI * 2 * dist2) / grain);

      let s = sample(this.read1) * w1 + sample(this.read2) * w2;
      // Normalise (the two windows sum ~1 on average)
      s *= 0.9;

      // Ring modulation
      if (ringMix > 0 && ringFreq > 0) {
        const mod = Math.sin(this.phase);
        this.phase += (Math.PI * 2 * ringFreq) / sr;
        if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2;
        s = s * (1 - ringMix) + s * mod * ringMix;
      }

      outCh[i] = Math.max(-1, Math.min(1, s));
    }

    // Mirror to additional output channels if any (mono → stereo)
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(outCh);
    }
    return true;
  }
}

registerProcessor("voice-changer-processor", VoiceChangerProcessor);
