/* DigitaHinos — reprodução: agenda notas no Web Audio com amostras geradas pela síntese física */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});

  class Player {
    constructor() { this.ctx = null; this.type = 'nylon'; this.cache = new Map(); this.events = []; this.entries = []; this.total = 0; this.spb = 1; this.playing = false; this.beat = 0; this.vol = .8; this.voices = new Array(6).fill(null); this.ni = 0; }
    init() {
      if (!this.ctx) {
        const AC = G.AudioContext || G.webkitAudioContext; this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain(); this.master.gain.value = this.vol;
        this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.attack.value = .01; this.comp.release.value = .25;
        this.dry = this.ctx.createGain(); this.wet = this.ctx.createGain(); this.wet.gain.value = .17; this.dry.gain.value = .9;
        const ir = DH.synth.makeIR(this.ctx.sampleRate, 1.4, 11); const buf = this.ctx.createBuffer(2, ir[0].length, this.ctx.sampleRate); buf.copyToChannel(ir[0], 0); buf.copyToChannel(ir[1], 1);
        this.conv = this.ctx.createConvolver(); this.conv.buffer = buf;
        this.master.connect(this.comp); this.comp.connect(this.dry); this.comp.connect(this.conv); this.conv.connect(this.wet); this.dry.connect(this.ctx.destination); this.wet.connect(this.ctx.destination);
        this.rec = this.ctx.createMediaStreamDestination(); this.dry.connect(this.rec); this.wet.connect(this.rec);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
    setType(t) { if (t !== this.type) { this.type = t; this.cache.clear(); } }
    key(n) { return this.type + '|' + n.s + '|' + n.p; }
    /** Gera (assíncrono, em fatias) as amostras necessárias para as notas. */
    async prepare(notes, onProg) {
      this.init(); const need = []; const seen = new Set();
      for (const n of notes) { const k = this.key(n); if (!seen.has(k) && !this.cache.has(k)) { seen.add(k); need.push(n); } }
      if (this.cache.size > 140) this.cache.clear();
      const fs = this.ctx.sampleRate; let i = 0;
      for (const n of need) {
        const d = DH.synth.renderNote({ fs, midi: n.p, string: n.s, type: this.type, vel: .72, seed: 3 });
        const b = this.ctx.createBuffer(1, d.length, fs); b.copyToChannel(d, 0); this.cache.set(this.key(n), b);
        if (++i % 4 === 0) { if (onProg) onProg(i / need.length); await new Promise(r => setTimeout(r, 0)); }
      }
      if (onProg) onProg(1);
    }
    /** monta a linha do tempo (em tempos/semínimas) seguindo a ordem de repetições. */
    build(sc, notes, order, tempo, speed) {
      this.sc = sc; this.spb = 60 / (tempo * speed); const M = sc.measures; const byM = M.map(() => []);
      notes.forEach(n => byM[n.m].push(n));
      this.entries = []; this.events = []; let tl = 0;
      for (const mi of order) {
        const m = M[mi]; const extra = m.fermata ? 1.2 : 0; this.entries.push({ mi, tl0: tl, tl1: tl + m.len + extra });
        byM[mi].forEach(n => this.events.push({ tl: tl + (n.t - m.start), n }));
        tl += m.len + extra;
      }
      this.total = tl; this.events.sort((a, b) => a.tl - b.tl || b.n.p - a.n.p);
      this.ni = 0;
    }
    writtenT(tl) { const E = this.entries; let lo = 0, hi = E.length - 1; if (!E.length) return 0; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (E[mid].tl0 <= tl + 1e-9) lo = mid; else hi = mid - 1; } const e = E[lo]; const m = this.sc.measures[e.mi]; return m.start + Math.min(Math.max(0, tl - e.tl0), m.len - 1e-6); }
    beatForMeasure(mi) { const e = this.entries.find(x => x.mi === mi); return e ? e.tl0 : 0; }
    seek(beat) { this.beat = Math.max(0, Math.min(this.total, beat)); this.ni = this.events.findIndex(e => e.tl >= this.beat - 1e-6); if (this.ni < 0) this.ni = this.events.length; if (this.playing) { this.startBeat = this.beat; this.t0 = this.ctx.currentTime + .05; this.stopVoices(); } }
    play() { this.init(); if (this.beat >= this.total - .01) this.seek(0); this.playing = true; this.startBeat = this.beat; this.t0 = this.ctx.currentTime + .08; this.ni = Math.max(0, this.events.findIndex(e => e.tl >= this.beat - 1e-6)); if (this.ni < 0) this.ni = this.events.length; this._timer = setInterval(() => this.tick(), 25); this.tick(); }
    pause() { this.playing = false; clearInterval(this._timer); this.stopVoices(true); }
    stopVoices(soft) { const t = this.ctx ? this.ctx.currentTime : 0; this.voices.forEach((v, i) => { if (v) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, soft ? .05 : .02); v.src.stop(t + .3); } catch (e) { } this.voices[i] = null; } }); }
    tick() {
      if (!this.playing) return; const ctx = this.ctx; const nowBeat = this.startBeat + Math.max(0, (ctx.currentTime - this.t0)) / this.spb; this.beat = nowBeat;
      const horizon = nowBeat + 0.18 / this.spb; const ev = this.events;
      while (this.ni < ev.length && ev[this.ni].tl <= horizon) {
        const e = ev[this.ni++]; if (e.tl < nowBeat - 0.25 / this.spb && this.beat > this.startBeat + .01) continue;
        let when = this.t0 + (e.tl - this.startBeat) * this.spb; if (when < ctx.currentTime) when = ctx.currentTime + .005;
        this.pluck(e.n, when, e);
      }
      if (nowBeat >= this.total + 1.5) { this.pause(); this.beat = this.total; if (this.onEnd) this.onEnd(); }
    }
    pluck(n, when, e) {
      const buf = this.cache.get(this.key(n)); if (!buf) return; const ctx = this.ctx;
      const lead = n.role === 'melody' || n.role === 'solo'; const rnd = Math.random;
      const vel = (lead ? .95 : n.role === 'bass' ? .8 : .52) * (0.92 + rnd() * .14);
      // dedilhado: ordem polegar → dedos, com micro-atrasos
      let off = 0; if (e) { const idx = this.ev_same(e); off = idx * 0.011; } off += (rnd() - .5) * .006;
      const t = when + Math.max(0, off);
      const prev = this.voices[n.s]; if (prev) { try { prev.g.gain.setTargetAtTime(0, t - .004, .025); prev.src.stop(t + .25); } catch (x) { } }
      const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.value = vel;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { pan.pan.value = (n.s - 2.5) * -.07; src.connect(g); g.connect(pan); pan.connect(this.master); } else { src.connect(g); g.connect(this.master); }
      src.start(t);
      if (n.rel && n.f > 0) { const end = t + Math.max(.25, n.hold * this.spb) + .08; g.gain.setValueAtTime(vel, end); g.gain.setTargetAtTime(0, end, .14); src.stop(end + 1.2); }
      this.voices[n.s] = { src, g };
      if (this.onPluck) this.onPluck(n, t);
    }
    ev_same(e) { let i = 0; const ev = this.events; let k = this.events.indexOf(e); while (k - 1 >= 0 && Math.abs(ev[k - 1].tl - e.tl) < 1e-6) { k--; i++; } return i; }
  }
  DH.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
