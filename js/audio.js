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

    noise(dur, vol, filterType, freq, freqTo, q) {
      const ctx = this.ensure();
      if (!ctx || vol <= 0) return;
      if (!this.noiseBuf) {
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const t = ctx.currentTime;
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

    /* Odd noises, one per fast food in game.js FOODS (same order). */
    munch(kind) {
      const now = performance.now();
      if (now - this.lastChomp < 85) return;
      this.lastChomp = now;
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      switch (kind) {
        case 0: // burger: little burp
          this.tone(130, 0.16, "sawtooth", 0.05, 70);
          this.tone(95, 0.12, "square", 0.025, 60, t + 0.03);
          break;
        case 1: // fries: crunch
          this.noise(0.07, 0.12, "bandpass", 2400, 900, 0.8);
          break;
        case 2: // pizza: boing
          this.tone(180, 0.18, "sine", 0.07, 720);
          this.tone(360, 0.1, "sine", 0.03, 260, t + 0.08);
          break;
        case 3: // hot dog: rubber squeak
          this.tone(900, 0.05, "square", 0.03, 1400);
          this.tone(1400, 0.06, "square", 0.025, 1000, t + 0.05);
          break;
        case 4: // taco: kazoo
          this.tone(330, 0.13, "sawtooth", 0.045, 370);
          this.tone(333, 0.13, "sawtooth", 0.03, 365);
          break;
        case 5: // donut: bloop
          this.tone(720, 0.12, "sine", 0.08, 140);
          break;
        case 6: // soda: slurp
          this.noise(0.16, 0.09, "bandpass", 500, 2600, 6);
          break;
        case 7: // chicken: bawk
          this.tone(620, 0.05, "square", 0.035, 760);
          this.tone(480, 0.08, "square", 0.03, 380, t + 0.06);
          break;
        default: // ice cream: pew
          this.tone(1600, 0.12, "triangle", 0.06, 200);
      }
    },

    siren(frightened, tick) {
      const base = frightened ? 540 : 196;
      const step = frightened ? 70 : 28;
      this.tone(base + (tick ? step : 0), frightened ? 0.09 : 0.16, "sine", frightened ? 0.03 : 0.022);
    },

    power() {
      const ctx = this.ensure();
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((freq, i) => {
        this.tone(freq, 0.11, "square", 0.04, null, ctx.currentTime + i * 0.07);
      });
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
