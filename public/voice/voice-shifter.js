// Masq voice disguise: phase-vocoder pitch shift with a separate formant shift.
//
// Each frame is split into a spectral envelope (formants, i.e. the shape of the
// vocal tract) and a fine structure (the harmonics, i.e. pitch). Harmonics are
// moved by `pitch`, and the envelope is stretched by `formant`, so the two can be
// changed independently. `robot` throws away phase to give a flat, buzzy voice.
//
// `denoise` is spectral noise suppression: a per-bin noise floor is tracked
// (it falls quickly and rises slowly, so it follows steady background noise but
// not speech), and bins near the floor are turned down. With pitch = formant = 1
// and no robot, the vocoder is bypassed and only noise suppression is applied.
//
// FFT size 1024 with 4x overlap: added latency is N - hop = 768 samples
// (16 ms at 48 kHz).

const N = 1024;
const OSAMP = 4;
const HOP = N / OSAMP;
const HALF = N / 2;
const LATENCY = N - HOP;
const TWO_PI = 2 * Math.PI;
const EXPECTED = (TWO_PI * HOP) / N;
const EPS = 1e-9;
const PSD_SMOOTH = 0.6;
const NOISE_FALL = 0.9; // power below the floor: follow it down
const NOISE_LIKE = 3; // power within 3x the floor counts as noise
const NOISE_TRACK = 0.97; // ...and is averaged in
const NOISE_RISE = 0.9995; // louder than that is speech: barely move
const OVER_SUBTRACT = 2;
const GAIN_FLOOR = 0.08; // about -22 dB
const WARMUP_FRAMES = 12;

class VoiceShifter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pitch = 1;
    this.formant = 1;
    this.robot = false;
    this.gain = 1;
    this.denoise = true;

    this.inFifo = new Float32Array(N);
    this.outFifo = new Float32Array(N);
    this.outAccum = new Float32Array(2 * N);
    this.re = new Float32Array(N);
    this.im = new Float32Array(N);
    this.lastPhase = new Float32Array(HALF + 1);
    this.sumPhase = new Float32Array(HALF + 1);
    this.anaMag = new Float32Array(HALF + 1);
    this.anaFreq = new Float32Array(HALF + 1);
    this.synMag = new Float32Array(HALF + 1);
    this.synFreq = new Float32Array(HALF + 1);
    this.env = new Float32Array(HALF + 1);
    this.tmp = new Float32Array(HALF + 1);
    this.psd = new Float32Array(HALF + 1);
    this.noise = new Float32Array(HALF + 1);
    this.nsGain = new Float32Array(HALF + 1).fill(1);
    this.frames = 0;
    this.rover = LATENCY;

    this.window = new Float32Array(N);
    for (let k = 0; k < N; k++) this.window[k] = 0.5 - 0.5 * Math.cos((TWO_PI * k) / N);

    // FFT tables.
    this.bitrev = new Uint32Array(N);
    const bits = Math.log2(N);
    for (let i = 0; i < N; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.bitrev[i] = r;
    }
    this.cos = new Float32Array(HALF);
    this.sin = new Float32Array(HALF);
    for (let i = 0; i < HALF; i++) {
      this.cos[i] = Math.cos((TWO_PI * i) / N);
      this.sin[i] = Math.sin((TWO_PI * i) / N);
    }

    // Envelope smoothing radius: wide enough to smear out harmonics of a
    // typical speaking voice, narrow enough to keep the formant peaks.
    const binHz = sampleRate / N;
    this.envRadius = Math.max(2, Math.round(300 / binHz));

    this.port.onmessage = (e) => {
      const { pitch, formant, robot, gain, denoise } = e.data ?? {};
      if (typeof pitch === "number" && pitch > 0.25 && pitch < 4) this.pitch = pitch;
      if (typeof formant === "number" && formant > 0.25 && formant < 4) this.formant = formant;
      if (typeof robot === "boolean") this.robot = robot;
      if (typeof gain === "number" && gain > 0 && gain < 8) this.gain = gain;
      if (typeof denoise === "boolean") this.denoise = denoise;
    };
  }

  // In-place iterative radix-2 FFT. sign = -1 forward, +1 inverse (unscaled).
  fft(re, im, sign) {
    const { bitrev, cos, sin } = this;
    for (let i = 0; i < N; i++) {
      const j = bitrev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const halfSize = size >> 1;
      const step = N / size;
      for (let start = 0; start < N; start += size) {
        for (let k = 0; k < halfSize; k++) {
          const wr = cos[k * step];
          const wi = sign * sin[k * step];
          const a = start + k;
          const b = a + halfSize;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }

  // Smoothed log-magnitude: two passes of a moving average (a triangle filter).
  envelope() {
    const { anaMag, env, tmp, envRadius: r } = this;
    for (let k = 0; k <= HALF; k++) env[k] = Math.log(anaMag[k] + EPS);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k <= HALF; k++) {
        let sum = 0;
        let n = 0;
        for (let j = k - r; j <= k + r; j++) {
          if (j >= 0 && j <= HALF) {
            sum += env[j];
            n++;
          }
        }
        tmp[k] = sum / n;
      }
      env.set(tmp);
    }
    for (let k = 0; k <= HALF; k++) env[k] = Math.exp(env[k]);
  }

  // Per-bin suppression gain from a tracked noise floor (spectral subtraction).
  updateNoiseGain() {
    const { re, im, psd, noise, nsGain } = this;
    const warm = this.frames < WARMUP_FRAMES;
    for (let k = 0; k <= HALF; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      // Smooth power over a few frames: per-frame power is far too jumpy.
      psd[k] = this.frames === 0 ? p : PSD_SMOOTH * psd[k] + (1 - PSD_SMOOTH) * p;
      const ps = psd[k];
      if (warm) {
        noise[k] = this.frames === 0 ? ps : noise[k] + (ps - noise[k]) / (this.frames + 1);
      } else if (ps < noise[k]) {
        noise[k] = NOISE_FALL * noise[k] + (1 - NOISE_FALL) * ps;
      } else if (ps < NOISE_LIKE * noise[k]) {
        noise[k] = NOISE_TRACK * noise[k] + (1 - NOISE_TRACK) * ps;
      } else {
        noise[k] = NOISE_RISE * noise[k] + (1 - NOISE_RISE) * ps;
      }
      const g = Math.max(GAIN_FLOOR, 1 - (OVER_SUBTRACT * noise[k]) / (ps + EPS));
      // Open quickly, close slowly: avoids "musical noise" warble.
      const prev = nsGain[k];
      nsGain[k] = g > prev ? 0.5 * prev + 0.5 * g : 0.85 * prev + 0.15 * g;
    }
    this.frames++;
  }

  processFrame() {
    const { re, im, window, anaMag, anaFreq, synMag, synFreq, env, lastPhase, sumPhase, nsGain } = this;

    for (let k = 0; k < N; k++) {
      re[k] = this.inFifo[k] * window[k];
      im[k] = 0;
    }
    this.fft(re, im, -1);
    if (this.denoise) this.updateNoiseGain();

    if (this.pitch === 1 && this.formant === 1 && !this.robot) {
      // Clean voice: keep the original phases, apply only noise suppression.
      for (let k = 0; k <= HALF; k++) {
        const g = this.denoise ? nsGain[k] : 1;
        re[k] *= g;
        im[k] *= g;
        // Keep phase tracking current so switching to a preset doesn't click.
        const phase = Math.atan2(im[k], re[k]);
        lastPhase[k] = phase;
        sumPhase[k] = phase;
      }
      for (let k = 1; k < HALF; k++) {
        re[N - k] = re[k];
        im[N - k] = -im[k];
      }
      this.fft(re, im, 1);
      this.overlapAdd(1 / N);
      return;
    }

    // Analysis: magnitude and true frequency (in bins) for each bin.
    for (let k = 0; k <= HALF; k++) {
      const mag = 2 * Math.hypot(re[k], im[k]);
      const phase = Math.atan2(im[k], re[k]);
      let d = phase - lastPhase[k];
      lastPhase[k] = phase;
      d -= k * EXPECTED;
      let qpd = Math.trunc(d / Math.PI);
      if (qpd >= 0) qpd += qpd & 1;
      else qpd -= qpd & 1;
      d -= Math.PI * qpd;
      anaFreq[k] = k + (OSAMP * d) / TWO_PI;
      anaMag[k] = this.denoise ? mag * nsGain[k] : mag;
    }

    this.envelope();

    // Move the flattened harmonics by `pitch`.
    synMag.fill(0);
    synFreq.fill(0);
    const pitch = this.pitch;
    for (let k = 0; k <= HALF; k++) {
      const idx = Math.round(k * pitch);
      if (idx > HALF) break;
      synMag[idx] += anaMag[k] / (env[k] + EPS);
      synFreq[idx] = anaFreq[k] * pitch;
    }

    // Re-apply the envelope, stretched by `formant`.
    const formant = this.formant;
    for (let k = 0; k <= HALF; k++) {
      const src = k / formant;
      const i = Math.floor(src);
      let e = 0;
      if (i < HALF) {
        const f = src - i;
        e = env[i] * (1 - f) + env[i + 1] * f;
      }
      synMag[k] *= e;
    }

    // Synthesis.
    for (let k = 0; k <= HALF; k++) {
      let phase = 0;
      if (!this.robot) {
        sumPhase[k] += (TWO_PI * (synFreq[k] - k)) / OSAMP + k * EXPECTED;
        phase = sumPhase[k];
      }
      re[k] = synMag[k] * Math.cos(phase);
      im[k] = synMag[k] * Math.sin(phase);
    }
    for (let k = HALF + 1; k < N; k++) {
      re[k] = 0;
      im[k] = 0;
    }
    this.fft(re, im, 1);

    this.overlapAdd((2 / (HALF * OSAMP)) * this.gain);
  }

  // Window, overlap-add and advance by one hop. Hann analysis and synthesis
  // windows at 4x overlap sum to 1.5, hence the division.
  overlapAdd(scale) {
    const s = scale / 1.5;
    for (let k = 0; k < N; k++) this.outAccum[k] += this.window[k] * this.re[k] * s;
    for (let k = 0; k < HOP; k++) this.outFifo[k] = this.outAccum[k];
    this.outAccum.copyWithin(0, HOP, HOP + N);
    this.outAccum.fill(0, N, N + HOP);
    this.inFifo.copyWithin(0, HOP, N);
  }

  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0];
    const output = out && out[0];
    if (!output) return true;

    for (let i = 0; i < output.length; i++) {
      this.inFifo[this.rover] = input ? input[i] : 0;
      output[i] = this.outFifo[this.rover - LATENCY];
      this.rover++;
      if (this.rover >= N) {
        this.rover = LATENCY;
        this.processFrame();
      }
    }
    for (let c = 1; c < out.length; c++) out[c].set(output);
    return true;
  }
}

registerProcessor("voice-shifter", VoiceShifter);
