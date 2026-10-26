// masqq voice disguise: pitch shift by time-stretch + resample, with a separate
// formant shift and spectral noise suppression.
//
// 1. A phase-locked vocoder (Laroche & Dolson identity phase locking) stretches
//    the voice in time by `pitch`. Phase locking keeps the voice's pulses
//    intact; without it a vocoder sounds hollow and echoey ("phasiness").
// 2. The stretched signal is read back `pitch` times faster, which restores the
//    duration and shifts the pitch.
// 3. The spectral envelope (formants) is re-warped so formants end up shifted
//    by `formant`, independently of pitch.
// `robot` emits zero-phase frames at a fixed rate for a flat, buzzy voice.
// `denoise` tracks a per-bin noise floor and turns down bins near it.
// With no disguise and pitch = formant = 1, audio passes through exactly,
// with only noise suppression applied.

const N = 1024;
const OSAMP = 8;
const HA = N / OSAMP; // analysis hop
const HALF = N / 2;
const TWO_PI = 2 * Math.PI;
const EPS = 1e-9;
// Hann analysis x synthesis windows overlap-add to 3/8 of N per hop.
const ROBOT_PERIOD = 384; // samples between robot pulses (125 Hz at 48 kHz)

// Noise suppression. Per-frame rates are expressed for 4x overlap and
// converted, so time constants don't depend on OSAMP.
const perFrame = (a) => Math.pow(a, 4 / OSAMP);
const PSD_SMOOTH = perFrame(0.6);
const NOISE_FALL = perFrame(0.9); // power below the floor: follow it down
const NOISE_LIKE = 3; // power within 3x the floor counts as noise
const NOISE_TRACK = perFrame(0.97); // ...and is averaged in
const NOISE_RISE = perFrame(0.9995); // louder than that is speech: barely move
const OVER_SUBTRACT = 2;
const GAIN_FLOOR = 0.08; // about -22 dB
const WARMUP_FRAMES = 12 * (OSAMP / 4);

// Stretched-signal ring buffer (must hold several frames at the largest stretch).
const RING = 1 << 15;
const RING_MASK = RING - 1;

const princarg = (a) => a - TWO_PI * Math.round(a / TWO_PI);

class VoiceShifter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.pitch = 1;
    this.formant = 1;
    this.robot = false;
    this.gain = 1;
    this.denoise = true;
    // When true the vocoder is always used, even if pitch and formant are 1,
    // so the real voice can never pass straight through.
    this.disguise = false;

    this.inFifo = new Float32Array(N);
    this.inFill = 0;
    this.re = new Float32Array(N);
    this.im = new Float32Array(N);
    this.mag = new Float32Array(HALF + 1);
    this.phase = new Float32Array(HALF + 1);
    this.prevPhase = new Float32Array(HALF + 1);
    this.synPhase = new Float32Array(HALF + 1);
    this.env = new Float32Array(HALF + 1);
    this.tmp = new Float32Array(HALF + 1);
    this.peaks = new Int32Array(HALF + 1);
    this.psd = new Float32Array(HALF + 1);
    this.noise = new Float32Array(HALF + 1);
    this.nsGain = new Float32Array(HALF + 1).fill(1);
    this.frames = 0;
    this.firstFrame = true;

    // Stretched output: frames are overlap-added into `ring` at `writePos`;
    // samples before `writePos` are final. `readPos` reads them back at `pitch`x.
    this.ring = new Float32Array(RING);
    this.writePos = 0; // where the next frame starts (integer)
    this.writeFrac = 0; // fractional carry for non-integer synthesis hops
    this.readPos = 0; // fractional read position
    this.started = false;
    this.robotAcc = 0;

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

    this.configure(options && options.processorOptions);
    this.port.onmessage = (e) => this.configure(e.data);
  }

  configure(data) {
    const { pitch, formant, robot, gain, denoise, disguise } = data ?? {};
    if (typeof pitch === "number" && pitch > 0.25 && pitch < 4) this.pitch = pitch;
    if (typeof formant === "number" && formant > 0.25 && formant < 4) this.formant = formant;
    if (typeof robot === "boolean") this.robot = robot;
    if (typeof gain === "number" && gain > 0 && gain < 8) this.gain = gain;
    if (typeof denoise === "boolean") this.denoise = denoise;
    if (typeof disguise === "boolean") this.disguise = disguise;
  }

  get clean() {
    return !this.disguise && this.pitch === 1 && this.formant === 1 && !this.robot;
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
    const { mag, env, tmp, envRadius: r } = this;
    for (let k = 0; k <= HALF; k++) env[k] = Math.log(mag[k] + EPS);
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
    const { mag, psd, noise, nsGain } = this;
    const warm = this.frames < WARMUP_FRAMES;
    for (let k = 0; k <= HALF; k++) {
      const p = mag[k] * mag[k];
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
      nsGain[k] = g > prev ? prev + (g - prev) * (1 - perFrame(0.5)) : prev + (g - prev) * (1 - perFrame(0.85));
    }
    this.frames++;
  }

  // One analysis frame (the last N input samples). Returns nothing; writes into the ring.
  processFrame() {
    const { re, im, window, mag, phase, prevPhase, synPhase, env, nsGain } = this;
    for (let k = 0; k < N; k++) {
      re[k] = this.inFifo[k] * window[k];
      im[k] = 0;
    }
    this.fft(re, im, -1);
    for (let k = 0; k <= HALF; k++) {
      mag[k] = Math.hypot(re[k], im[k]);
      phase[k] = Math.atan2(im[k], re[k]);
    }
    if (this.denoise) this.updateNoiseGain();

    const clean = this.clean;
    // Clean voice: no stretch. Robot: frames placed on a fixed beat instead.
    const stretch = clean || this.robot ? 1 : this.pitch;
    const exactHop = HA * stretch + this.writeFrac;
    const hs = Math.round(exactHop); // synthesis hop for this frame
    this.writeFrac = exactHop - hs;

    if (clean) {
      // Keep the original spectrum; apply only noise suppression.
      for (let k = 0; k <= HALF; k++) {
        const g = this.denoise ? nsGain[k] : 1;
        re[k] *= g;
        im[k] *= g;
      }
      synPhase.set(phase);
    } else {
      // Formant correction in the stretched domain: resampling by `pitch` later
      // moves everything by `pitch`, so warp the envelope by pitch / formant.
      this.envelope();
      const warp = this.pitch / this.formant;
      for (let k = 0; k <= HALF; k++) {
        const src = k * warp;
        const i = Math.floor(src);
        let e = 0;
        if (i < HALF) {
          const f = src - i;
          e = env[i] * (1 - f) + env[i + 1] * f;
        }
        const g = this.denoise ? nsGain[k] : 1;
        mag[k] = (mag[k] / (env[k] + EPS)) * e * g;
      }

      if (this.robot) {
        synPhase.fill(0);
      } else if (this.firstFrame) {
        synPhase.set(phase);
      } else {
        // Identity phase locking: peaks advance by their true frequency over the
        // synthesis hop; other bins keep their phase offset to their peak.
        const { peaks } = this;
        let nPeaks = 0;
        // Local maxima over +/-1 bin: a low voice's harmonics are under 3 bins
        // apart at this FFT size, so a wider test would merge them.
        for (let k = 1; k < HALF; k++) {
          const m = mag[k];
          if (m > EPS && m > mag[k - 1] && m >= mag[k + 1]) peaks[nPeaks++] = k;
        }
        const advance = (k) => {
          const omega = (TWO_PI * k) / N + princarg(phase[k] - prevPhase[k] - (TWO_PI * k * HA) / N) / HA;
          return synPhase[k] + omega * hs;
        };
        if (nPeaks === 0) {
          for (let k = 0; k <= HALF; k++) synPhase[k] = advance(k);
        } else {
          // New peak phases first (they're read below).
          const peakPhase = this.tmp;
          for (let i = 0; i < nPeaks; i++) peakPhase[peaks[i]] = advance(peaks[i]);
          let j = 0;
          for (let k = 0; k <= HALF; k++) {
            while (j < nPeaks - 1 && Math.abs(peaks[j + 1] - k) < Math.abs(peaks[j] - k)) j++;
            const p = peaks[j];
            synPhase[k] = p === k ? peakPhase[k] : peakPhase[p] + phase[k] - phase[p];
          }
        }
      }
      for (let k = 0; k <= HALF; k++) {
        re[k] = mag[k] * Math.cos(synPhase[k]);
        im[k] = mag[k] * Math.sin(synPhase[k]);
      }
    }
    prevPhase.set(phase);
    this.firstFrame = false;

    // Inverse FFT of a real signal from the half spectrum.
    for (let k = 1; k < HALF; k++) {
      re[N - k] = re[k];
      im[N - k] = -im[k];
    }
    im[0] = 0;
    im[HALF] = 0;
    this.fft(re, im, 1);

    // Robot: only emit a frame on each beat, so pulses repeat at a fixed pitch.
    let emit = true;
    // Overlap-add density depends on the synthesis hop actually used.
    let scale = this.gain / N / (0.375 * (N / hs));
    if (this.robot) {
      this.robotAcc += HA;
      emit = this.robotAcc >= ROBOT_PERIOD;
      if (emit) this.robotAcc -= ROBOT_PERIOD;
      // Fewer, sparser frames: rescale to the overlap actually used.
      scale = this.gain / N / (0.375 * (N / ROBOT_PERIOD));
    }
    if (emit) {
      const { ring } = this;
      const base = this.writePos;
      for (let k = 0; k < N; k++) {
        const idx = (base + k) & RING_MASK;
        ring[idx] += window[k] * re[k] * scale;
      }
    }
    this.writePos += hs;
  }

  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0];
    const output = out && out[0];
    if (!output) return true;
    const { ring } = this;

    for (let i = 0; i < output.length; i++) {
      // Feed input; run a frame every HA samples once the window is full.
      this.inFifo[this.inFill++] = input ? input[i] : 0;
      if (this.inFill === N) {
        this.processFrame();
        this.inFifo.copyWithin(0, HA, N);
        this.inFill = N - HA;
      }

      // Samples before writePos are final. Start reading once there's a
      // cushion, then read at `pitch`x (1x for clean and robot).
      const rate = this.clean || this.robot ? 1 : this.pitch;
      if (!this.started && this.writePos >= HA * 2) {
        this.started = true;
        this.readPos = 0;
      }
      let y = 0;
      if (this.started) {
        const pos = this.readPos;
        if (pos + 2 < this.writePos) {
          const i0 = Math.floor(pos);
          const f = pos - i0;
          // Cubic (Catmull-Rom) interpolation.
          const ym1 = ring[(i0 - 1) & RING_MASK];
          const y0 = ring[i0 & RING_MASK];
          const y1 = ring[(i0 + 1) & RING_MASK];
          const y2 = ring[(i0 + 2) & RING_MASK];
          y =
            y0 +
            0.5 * f * (y1 - ym1 + f * (2 * ym1 - 5 * y0 + 4 * y1 - y2 + f * (3 * (y0 - y1) + y2 - ym1)));
          const next = pos + rate;
          // Clear samples we've fully passed so the ring can be reused.
          for (let c = i0 - 1; c < Math.floor(next) - 1; c++) ring[c & RING_MASK] = 0;
          this.readPos = next;
        }
        // Keep the read position from drifting too far behind (e.g. after a
        // preset change) or ahead of the written audio.
        const lag = this.writePos - this.readPos;
        if (lag > HA * 6 * Math.max(1, rate)) this.readPos = this.writePos - HA * 2 * Math.max(1, rate);
      }
      output[i] = y;
    }
    for (let c = 1; c < out.length; c++) out[c].set(output);
    return true;
  }
}

registerProcessor("voice-shifter", VoiceShifter);
