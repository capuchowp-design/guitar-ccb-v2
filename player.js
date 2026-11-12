/* DigitaHinos — reprodução: agenda notas no Web Audio usando amostras REAIS de violão (nylon e aço).
 * Se as amostras não puderem ser carregadas, cai para a síntese física (js/synth.js).
 * A mesma cadeia de áudio é usada ao vivo e na exportação offline para .wav. */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const LO = 38, HI = 79;                 // faixa de notas MIDI com arquivo em sounds/<tipo>/<midi>.mp3
  const SAMPLE_GAIN = 2.1;                // as amostras são normalizadas por RMS; este ganho iguala ao volume antigo
  const clampM = m => Math.max(LO, Math.min(HI, m));

  class Player {
    constructor() { this.ctx = null; this.type = 'nylon'; this.cache = new Map(); this.bank = { nylon: new Map(), steel: new Map() }; this.events = []; this.entries = []; this.total = 0; this.spb = 1; this.playing = false; this.beat = 0; this.vol = .8; this.voices = new Array(6).fill(null); this.ni = 0; this.sampleFail = false; }
    /** Cadeia: master → timbre (EQ) → compressor → (seco + reverb) → saída. Serve para contexto ao vivo e offline. */
    makeChain(ctx, vol, type) {
      const master = ctx.createGain(); master.gain.value = vol;
      const tone = ctx.createBiquadFilter(); tone.type = 'highshelf'; tone.frequency.value = 3200; tone.gain.value = type === 'steel' ? 4.5 : 1.0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .25;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .09;
      const dry = ctx.createGain(), wet = ctx.createGain(); wet.gain.value = .17; dry.gain.value = .9;
      const ir = DH.synth.makeIR(ctx.sampleRate, 1.4, 11); const buf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate); buf.copyToChannel(ir[0], 0); buf.copyToChannel(ir[1], 1);
      const conv = ctx.createConvolver(); conv.buffer = buf;
      master.connect(tone); tone.connect(comp); comp.connect(lim); lim.connect(dry); lim.connect(conv); conv.connect(wet); dry.connect(ctx.destination); wet.connect(ctx.destination);
      return { master, tone, comp, dry, wet };
    }
    init() {
      if (!this.ctx) {
        const AC = G.AudioContext || G.webkitAudioContext; this.ctx = new AC({ latencyHint: 'interactive' });
        this.chain = this.makeChain(this.ctx, this.vol, this.type); this.master = this.chain.master;
        this.rec = this.ctx.createMediaStreamDestination(); this.chain.dry.connect(this.rec); this.chain.wet.connect(this.rec);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
    setType(t) { if (t !== this.type) { this.type = t; this.cache.clear(); if (this.chain) this.chain.tone.gain.value = t === 'steel' ? 4.5 : 1.0; } }
    key(n) { return this.type + '|' + n.s + '|' + n.p; }
    /** Carrega (e decodifica) o arquivo de amostra de uma nota MIDI. */
    async loadSample(type, m) {
      const bank = this.bank[type]; if (bank.has(m)) return bank.get(m);
      const r = await fetch('sounds/' + type + '/' + m + '.mp3'); if (!r.ok) throw new Error('amostra ' + m + ' não encontrada');
      const ab = await r.arrayBuffer();
      const buf = await new Promise((ok, no) => { const p = this.ctx.decodeAudioData(ab, ok, no); if (p && p.catch) p.catch(no); });
      bank.set(m, buf); return buf;
    }
    /** Prepara as amostras necessárias para as notas (assíncrono). */
    async prepare(notes, onProg) {
      this.init(); const need = []; const seen = new Set();
      for (const n of notes) { const k = this.key(n); if (!seen.has(k) && !this.cache.has(k)) { seen.add(k); need.push(n); } }
      const fs = this.ctx.sampleRate; let i = 0; const type = this.type;
      for (const n of need) {
        const k = this.key(n); let entry = null;
        if (!this.sampleFail) {
          try { const m = clampM(n.p); const buf = await this.loadSample(type, m); entry = { buf, rate: Math.pow(2, (n.p - m) / 12), sampled: true }; }
          catch (e) { console.warn('Amostras indisponíveis, usando síntese:', e.message); this.sampleFail = true; }
        }
        if (!entry) {
          const d = DH.synth.renderNote({ fs, midi: n.p, string: n.s, type, vel: .72, seed: 3 });
          const b = this.ctx.createBuffer(1, d.length, fs); b.copyToChannel(d, 0); entry = { buf: b, rate: 1, sampled: false };
        }
        this.cache.set(k, entry);
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
    /** Agenda uma nota em qualquer contexto (ao vivo ou offline). Retorna o tempo real de início. */
    voice(ctx, out, voices, n, when, e) {
      const entry = this.cache.get(this.key(n)); if (!entry) return null;
      const lead = n.role === 'melody' || n.role === 'solo'; const rnd = Math.random;
      const vel = (lead ? .95 : n.role === 'bass' ? .8 : .52) * (0.92 + rnd() * .14) * (entry.sampled ? SAMPLE_GAIN : 1);
      // dedilhado: ordem polegar → dedos, com micro-atrasos
      let off = 0; if (e) { const idx = this.ev_same(e); off = idx * 0.011; } off += (rnd() - .5) * .006;
      const t = when + Math.max(0, off);
      const prev = voices[n.s]; if (prev) { try { prev.g.gain.setTargetAtTime(0, t - .004, .025); prev.src.stop(t + .25); } catch (x) { } }
      const src = ctx.createBufferSource(); src.buffer = entry.buf; if (entry.rate !== 1) src.playbackRate.value = entry.rate; const g = ctx.createGain(); g.gain.value = vel;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { pan.pan.value = (n.s - 2.5) * -.07; src.connect(g); g.connect(pan); pan.connect(out); } else { src.connect(g); g.connect(out); }
      src.start(t);
      if (n.rel && n.f > 0) { const end = t + Math.max(.25, n.hold * this.spb) + .08; g.gain.setValueAtTime(vel, end); g.gain.setTargetAtTime(0, end, .14); src.stop(end + 1.2); }
      voices[n.s] = { src, g };
      return t;
    }
    pluck(n, when, e) {
      const t = this.voice(this.ctx, this.master, this.voices, n, when, e);
      if (t !== null && this.onPluck) this.onPluck(n, t);
    }
    ev_same(e) { let i = 0; const ev = this.events; let k = ev.indexOf(e); while (k - 1 >= 0 && Math.abs(ev[k - 1].tl - e.tl) < 1e-6) { k--; i++; } return i; }

    /** Renderiza a partitura inteira, offline, exatamente como é ouvida (tom, capo, modo, andamento, violão e volume atuais). */
    async renderOffline(onProg) {
      const OAC = G.OfflineAudioContext || G.webkitOfflineAudioContext; if (!OAC) throw new Error('Este navegador não suporta exportação de áudio.');
      const fs = 44100; const secs = this.total * this.spb + 4.5;
      const oc = new OAC(2, Math.ceil(secs * fs), fs); const chain = this.makeChain(oc, this.vol, this.type);
      const voices = new Array(6).fill(null); const t0 = 0.1;
      for (const e of this.events) this.voice(oc, chain.master, voices, e.n, t0 + e.tl * this.spb, e);
      if (onProg) onProg(0.1);
      const buf = await oc.startRendering(); if (onProg) onProg(1);
      return buf;
    }
    /** Converte um AudioBuffer em arquivo WAV (PCM 16 bits, estéreo), cortando o silêncio final. */
    static toWav(buf) {
      const ch = buf.numberOfChannels, fs = buf.sampleRate; const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
      let last = buf.length - 1; const thr = 0.0006; while (last > 0 && Math.abs(data[0][last]) < thr && Math.abs(data[ch > 1 ? 1 : 0][last]) < thr) last--;
      const n = Math.min(buf.length, last + Math.floor(0.35 * fs)); const bytes = n * ch * 2; const ab = new ArrayBuffer(44 + bytes); const v = new DataView(ab);
      const W = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      W(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); W(8, 'WAVE'); W(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, fs, true); v.setUint32(28, fs * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); W(36, 'data'); v.setUint32(40, bytes, true);
      let o = 44; const fade = Math.floor(0.2 * fs);
      for (let i = 0; i < n; i++) { const k = i > n - fade ? (n - i) / fade : 1; for (let c = 0; c < ch; c++) { let s = data[c][i] * k; s = s < -1 ? -1 : s > 1 ? 1 : s; v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; } }
      return new Blob([ab], { type: 'audio/wav' });
    }
  }
  DH.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
