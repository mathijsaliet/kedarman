/* Small synth. No audio files, so the game still runs from a file:// open. */
(function () {
  const KM = (window.KM = window.KM || {});

  const audio = {
    ctx: null,
    muted: false,
    chompFlip: 0,
    lastChomp: 0,

    loadMute() {
      try {
        this.muted = localStorage.getItem("kedarman-mute") === "1";
      } catch (err) {
        this.muted = false;
      }
    },

    setMuted(muted) {
      this.muted = muted;
      try {
        localStorage.setItem("kedarman-mute", muted ? "1" : "0");
      } catch (err) {
        /* private mode */
      }
    },

    ensure() {
      if (this.muted) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        if (!this.ctx) this.ctx = new AC();
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
      } catch (err) {
        return null;
      }
    },

    tone(freq, dur, type, vol, slideTo, when) {
      const ctx = this.ensure();
      if (!ctx || vol <= 0) return;
      const t = when == null ? ctx.currentTime : when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(Math.max(1, freq), t);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      }
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, dur));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },

    chomp() {
      const now = performance.now();
      if (now - this.lastChomp < 85) return;
      this.lastChomp = now;
      this.chompFlip ^= 1;
      this.tone(this.chompFlip ? 520 : 380, 0.06, "square", 0.035);
    },

    noiseBuf: null,

    noise(dur, vol, filterType, freq, freqTo, q, when) {
      const ctx = this.ensure();
      if (!ctx || vol <= 0) return;
      if (!this.noiseBuf) {
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const t = when == null ? ctx.currentTime : when;
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      src.buffer = this.noiseBuf;
      filter.type = filterType;
      filter.Q.value = q || 1;
      filter.frequency.setValueAtTime(freq, t);
      if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      src.stop(t + dur + 0.03);
    },

    /* One bite: a jaw thump plus a filtered noise crunch. Higher cutoff = crunchier. */
    bite(when, cutoff, vol) {
      this.tone(150, 0.07, "sine", vol * 0.9, 55, when);
      this.noise(0.07, vol, "lowpass", cutoff, cutoff * 0.35, 0.7, when);
    },

    /* Eating sounds, one per fast food in game.js FOODS (same order). */
    munch(kind) {
      const now = performance.now();
      if (now - this.lastChomp < 85) return;
      this.lastChomp = now;
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      switch (kind) {
        case 1: // fries: crispy crunch
          this.noise(0.05, 0.14, "bandpass", 3200, 1500, 0.9, t);
          this.noise(0.05, 0.1, "bandpass", 2600, 1200, 0.9, t + 0.05);
          break;
        case 5: // donut: soft squishy bite
          this.bite(t, 600, 0.09);
          break;
        case 6: // soda: slurp then gulp
          this.noise(0.12, 0.07, "bandpass", 700, 2200, 5, t);
          this.tone(260, 0.07, "sine", 0.07, 110, t + 0.1);
          break;
        case 7: // chicken: big tearing chomp
          this.bite(t, 2400, 0.12);
          this.noise(0.08, 0.06, "highpass", 3000, 1500, 0.7, t + 0.04);
          break;
        case 8: // ice cream: wet nom
          this.bite(t, 900, 0.08);
          this.noise(0.06, 0.04, "bandpass", 1200, 600, 3, t + 0.05);
          break;
        default: {
          // burger, pizza, hot dog, taco: nom-nom double chomp, pitch varies by food
          const crunch = [1400, 0, 1800, 1200, 2200][kind] || 1500;
          this.bite(t, crunch, 0.11);
          this.bite(t + 0.07, crunch * 0.75, 0.08);
        }
      }
    },

    siren(frightened, tick) {
      const base = frightened ? 540 : 196;
      const step = frightened ? 70 : 28;
      this.tone(base + (tick ? step : 0), frightened ? 0.09 : 0.16, "sine", frightened ? 0.03 : 0.022);
    },

    /* Short "hnngh": a low voice through a vowel-ish filter, plus a breath. */
    grunt(when) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = when == null ? ctx.currentTime : when;
      const dur = 0.26;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(125, t);
      osc.frequency.linearRampToValueAtTime(140, t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(82, t + dur);
      filter.type = "bandpass";
      filter.frequency.value = 520;
      filter.Q.value = 2.5;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
      this.noise(0.12, 0.035, "lowpass", 900, 400, 0.7, t);
    },

    power() {
      const ctx = this.ensure();
      if (!ctx) return;
      // Giant burger: big bite, chew, chew, grunt, swallow.
      const t = ctx.currentTime;
      this.lastChomp = performance.now() + 450;
      this.bite(t, 2000, 0.14);
      this.bite(t + 0.13, 1100, 0.1);
      this.bite(t + 0.24, 900, 0.09);
      this.grunt(t + 0.3);
      this.tone(240, 0.08, "sine", 0.08, 100, t + 0.56);
    },

    eat() {
      const ctx = this.ensure();
      if (!ctx) return;
      [620, 830, 1040].forEach((freq, i) => {
        this.tone(freq, 0.09, "square", 0.04, null, ctx.currentTime + i * 0.05);
      });
    },

    bonus() {
      this.tone(880, 0.14, "triangle", 0.05, 1320);
    },

    death() {
      this.tone(494, 0.55, "sawtooth", 0.04, 90);
    },

    win() {
      const ctx = this.ensure();
      if (!ctx) return;
      [523, 659, 784, 1046, 784, 1046].forEach((freq, i) => {
        this.tone(freq, 0.13, "triangle", 0.045, null, ctx.currentTime + i * 0.09);
      });
    },

    ready() {
      const ctx = this.ensure();
      if (!ctx) return;
      [392, 523, 659].forEach((freq, i) => {
        this.tone(freq, 0.12, "square", 0.04, null, ctx.currentTime + i * 0.09);
      });
    },

    extra() {
      this.tone(988, 0.16, "square", 0.045, 1318);
    },
  };

  audio.loadMute();
  KM.audio = audio;
})();
