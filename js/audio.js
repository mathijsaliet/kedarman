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
