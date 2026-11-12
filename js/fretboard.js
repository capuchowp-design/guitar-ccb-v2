/* DigitaHinos — braço do violão realista (canvas): escala real das casas, cordas que vibram,
 * dedos que se movem com suavidade, janela de casas que acompanha a mão, capotraste, pestana. */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const NAMES = ['Dó', 'Dó♯', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
  const OPEN = [64, 59, 55, 50, 45, 40];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fretPos = n => 1 - Math.pow(2, -n / 12);            // posição normalizada (0 = pestana, 1 ≈ ponte virtual)
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

  class Fretboard {
    constructor(canvas) {
      this.c = canvas; this.x = canvas.getContext('2d'); this.notes = []; this.type = 'nylon'; this.capo = 0;
      this.view = 0; this.viewT = 0; this.span = 6.6;
      this.fing = [1, 2, 3, 4].map(() => ({ s: 2, f: 3, a: 0, tx: 0, ty: 0, px: null, py: null, on: false }));
      this.str = [0, 0, 0, 0, 0, 0].map(() => ({ amp: 0, t0: -9, freq: 6 }));
      this.last = -1; this.bg = null; this.info = ''; this.spb = 1; this._tex = null; this.now = 0; this.idx = 0;
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect(); const dpr = Math.min(2, G.devicePixelRatio || 1);
      const w = Math.max(320, Math.round(r.width || 1000)), h = Math.max(180, Math.round(r.height || 420));
      this.c.width = w * dpr; this.c.height = h * dpr; this.W = w; this.H = h; this.dpr = dpr; this._tex = null;
    }
    setNotes(notes, opts) { this.notes = notes.slice().sort((a, b) => a.t - b.t); this.type = opts.type; this.capo = opts.capo || 0; this.idx = 0; this.reset(); }
    reset() { this.fing.forEach(f => { f.a = 0; f.on = false; f.px = null; }); this.str.forEach(s => { s.amp = 0; }); this.view = this.viewT = 0; }
    /* geometria */
    geo() {
      const W = this.W, H = this.H; const L = 28, R = W - 18; const topY = H * 0.17, botY = H * 0.80;
      const f0 = this.view, f1 = this.view + this.span; const p0 = fretPos(f0), p1 = fretPos(f1);
      const X = f => L + (fretPos(f) - p0) / (p1 - p0) * (R - L);
      // espaçamento entre cordas cresce em direção ao corpo
      const spacing = f => { const u = clamp(fretPos(f), 0, 1); const w = (botY - topY) * (0.86 + 0.34 * u); return w / 5; };
      const Y = (si, f) => (topY + botY) / 2 + (si - 2.5) * spacing(f) * 1.0;
      return { L, R, topY, botY, X, Y, W, H, spacing };
    }
    texture(g) {
      if (this._tex && this._tex.w === this.W) return this._tex.c;
      const c = document.createElement('canvas'); c.width = this.W; c.height = this.H; const x = c.getContext('2d'); const r = rng(7);
      // madeira escura (jacarandá / escala de ébano) com veios
      const gr = x.createLinearGradient(0, 0, 0, this.H); gr.addColorStop(0, '#3a2216'); gr.addColorStop(.5, '#4a2c1b'); gr.addColorStop(1, '#2f1a10');
      x.fillStyle = gr; x.fillRect(0, 0, this.W, this.H);
      for (let i = 0; i < 260; i++) { const y = r() * this.H; x.strokeStyle = `rgba(${r() > .5 ? '20,10,5' : '110,70,45'},${0.05 + r() * .12})`; x.lineWidth = .5 + r() * 1.6; x.beginPath(); x.moveTo(0, y); let yy = y; for (let k = 0; k <= 12; k++) { yy += (r() - .5) * 3; x.lineTo(k * this.W / 12, yy); } x.stroke(); }
      for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${r() * .12})`; x.fillRect(r() * this.W, r() * this.H, 1 + r() * 2, 1); }
      this._tex = { w: this.W, c }; return c;
    }
    pluck(s, t, vel) { const st = this.str[s]; st.amp = Math.min(1, .55 + vel * .7); st.t0 = t; st.freq = 5 + s * .6; }
    update(now, dt, spb) {
      this.spb = spb || 1; const N = this.notes;
      // dispara palhetadas
      while (this.idx < N.length && N[this.idx].t <= now + 1e-6) { const n = N[this.idx++]; if (now - n.t < 0.6) this.pluck(n.s, now, n.role === 'melody' || n.role === 'solo' ? .9 : .55); }
      // notas ativas (dedos)
      const act = []; const lead = 0.14 / Math.max(.2, this.spb);
      for (const n of N) { if (n.t > now + 0.6) break; if (n.f > 0 && now >= n.t - lead && now < n.t + Math.max(n.hold, .3)) act.push(n); }
      const key = act.map(n => n.id).join(',');
      // dedos alvo
      const used = new Set();
      act.forEach(n => { const k = n.fin - 1; if (k < 0 || k > 3) return; const f = this.fing[k]; if (used.has(k)) return; used.add(k); f.s = n.s; f.f = n.f; f.on = true; f.pressedAt = now; });
      this.fing.forEach((f, k) => { if (!used.has(k)) f.on = false; });
      // próxima janela: média das próximas posições
      let lo = 99, hi = 0; let cnt = 0;
      for (const n of N) { if (n.t < now - 0.3) continue; if (n.t > now + 2.2 / Math.max(.4, this.spb)) break; if (n.f > 0) { lo = Math.min(lo, n.f); hi = Math.max(hi, n.f); cnt++; } }
      if (cnt) { const target = clamp(Math.min(lo - 0.9, hi - this.span + 2.2), 0, 13); this.viewT = target; }
      else if (!act.length) this.viewT = Math.max(0, this.viewT * 0.98);
      const k = 1 - Math.exp(-dt * 4.2); this.view += (this.viewT - this.view) * k;
      this.fing.forEach(f => { f.a += ((f.on ? 1 : 0) - f.a) * (1 - Math.exp(-dt * (f.on ? 22 : 11))); });
      this.str.forEach(s => { s.amp *= Math.exp(-dt * 2.4); });
      this.now = now; this.act = act;
      const top = act.find(n => n.role === 'melody' || n.role === 'solo') || act[0] || null;
      const last = [...N].reverse().find(n => n.t <= now + 1e-6 && (n.role === 'melody' || n.role === 'solo'));
      this.cur = last || top; this.draw(now);
    }
    draw(now) {
      const x = this.x, dpr = this.dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); const g = this.geo(); const { L, R, topY, botY, X, Y, W, H } = g;
      x.clearRect(0, 0, W, H); x.fillStyle = '#17110c'; x.fillRect(0, 0, W, H);
      // corpo do braço (trapézio)
      const nutVisible = this.view < 0.2; const yTopAt = f => Y(0, f) - g.spacing(f) * .9, yBotAt = f => Y(5, f) + g.spacing(f) * .9;
      x.save(); x.beginPath(); x.moveTo(L - 20, yTopAt(this.view) - 2); x.lineTo(R + 10, yTopAt(this.view + this.span) - 2); x.lineTo(R + 10, yBotAt(this.view + this.span) + 2); x.lineTo(L - 20, yBotAt(this.view) + 2); x.closePath(); x.clip();
      x.drawImage(this.texture(g), 0, 0, W, H);
      // sombra superior/inferior para volume
      const sh = x.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(.18, 'rgba(0,0,0,0)'); sh.addColorStop(.82, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = sh; x.fillRect(0, 0, W, H);
      // marcadores
      const f0 = Math.floor(this.view), f1 = Math.ceil(this.view + this.span) + 1;
      for (const m of [3, 5, 7, 9, 12, 15, 17, 19, 21]) {
        if (m < f0 || m > f1) continue; const cx = (X(m - 1) + X(m)) / 2; const my = (Y(0, m) + Y(5, m)) / 2; const spc = g.spacing(m);
        const dots = m === 12 ? [-1, 1] : [0]; dots.forEach(d => { const rg = x.createRadialGradient(cx - 2, my + d * spc * 1.3 - 2, 1, cx, my + d * spc * 1.3, spc * .42); rg.addColorStop(0, '#f7f0dc'); rg.addColorStop(1, '#b9ae92'); x.fillStyle = rg; x.beginPath(); x.arc(cx, my + d * spc * 1.3, spc * .36, 0, 7); x.fill(); });
      }
      // casas (trastes) metálicos
      for (let f = Math.max(0, f0); f <= f1; f++) {
        if (f === 0 && nutVisible) { const xx = X(0); const gr = x.createLinearGradient(xx - 8, 0, xx + 6, 0); gr.addColorStop(0, '#d8cfb6'); gr.addColorStop(1, '#8f866f'); x.fillStyle = gr; x.fillRect(xx - 7, yTopAt(0) - 4, 10, yBotAt(0) - yTopAt(0) + 8); continue; }
        const xx = X(f); if (xx < L - 22 || xx > R + 12) continue; const a = yTopAt(f) - 1, b = yBotAt(f) + 1;
        x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(xx + 1.5, a, 3.5, b - a);
        const gr = x.createLinearGradient(xx - 2.2, 0, xx + 2.2, 0); gr.addColorStop(0, '#9a9a94'); gr.addColorStop(.45, '#f4f2ea'); gr.addColorStop(1, '#85857f'); x.fillStyle = gr; x.fillRect(xx - 2.2, a, 4.4, b - a);
      }
      x.restore();
      // números das casas
      x.fillStyle = '#cdb98f'; x.font = '600 14px system-ui,sans-serif'; x.textAlign = 'center';
      for (let f = Math.max(1, f0); f <= f1; f++) { const cx = (X(f - 1) + X(f)) / 2; if (cx > L && cx < R) x.fillText(String(f), cx, H - 10); }
      // capotraste (se houver) — barra sobre a pestana
      if (this.capo > 0 && nutVisible) { const xx = X(0) - 6; const gr = x.createLinearGradient(xx - 7, 0, xx + 7, 0); gr.addColorStop(0, '#3b3b3b'); gr.addColorStop(.5, '#8d8d8d'); gr.addColorStop(1, '#2a2a2a'); x.fillStyle = gr; x.beginPath(); x.roundRect ? x.roundRect(xx - 8, yTopAt(0) - 12, 16, yBotAt(0) - yTopAt(0) + 24, 6) : x.rect(xx - 8, yTopAt(0) - 12, 16, yBotAt(0) - yTopAt(0) + 24); x.fill(); x.fillStyle = '#e8d9b0'; x.font = '700 12px system-ui'; x.save(); x.translate(xx + 1, (yTopAt(0) + yBotAt(0)) / 2); x.rotate(-Math.PI / 2); x.fillText('CAPO ' + this.capo, 0, 4); x.restore(); }
      // cordas
      const nylon = this.type === 'nylon';
      const sw = [1.3, 1.8, 2.5, 3.2, 3.9, 4.7].map(w => w * (nylon ? 1 : .92));
      for (let si = 0; si < 6; si++) {
        const st = this.str[si]; const pressed = this.fing.find(f => f.a > .5 && f.s === si); const fr = pressed ? pressed.f : 0;
        const xa = fr > 0 ? (X(fr) + X(fr - 1)) / 2 + (X(fr) - X(fr - 1)) * .12 : X(0) - 4; const xb = R + 14;
        const wound = si >= 3; const w = sw[si];
        const col = nylon ? (wound ? ['#d6d6cf', '#8e8e88'] : ['#efe9d6', '#b9b39e']) : (wound ? ['#d9a64f', '#7a5522'] : ['#e8e8e8', '#8d8d8d']);
        const amp = st.amp * (nylon ? 3.6 : 3.0) * (1 - si * .06); const ph = (now - st.t0) * st.freq * 6.2832 * (1 / Math.max(.4, this.spb)) * 2.2;
        const pts = 36; const pathLine = (dy, lw, style) => { x.beginPath(); for (let i = 0; i <= pts; i++) { const u = i / pts; const xx = xa + (xb - xa) * u; const yy = Y(si, this.view + this.span * (xx - L) / (R - L) * 0.0 + (fr > 0 ? fr : 0) + (xx - xa) / (R - L) * this.span) + dy + Math.sin(Math.PI * u) * Math.sin(ph) * amp; if (i) x.lineTo(xx, yy); else x.moveTo(xx, yy); } x.lineWidth = lw; x.strokeStyle = style; x.stroke(); };
        // sombra projetada na madeira
        pathLine(w * 1.4, w * 1.4, 'rgba(0,0,0,.35)');
        // parte morta (entre pestana e casa pressionada) mais fraca
        if (fr > 0) { x.beginPath(); x.moveTo(X(0), Y(si, 0)); x.lineTo(xa, Y(si, fr)); x.lineWidth = w; x.strokeStyle = 'rgba(200,200,190,.35)'; x.stroke(); }
        const gr = x.createLinearGradient(0, Y(si, 3) - w, 0, Y(si, 3) + w); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
        pathLine(0, w, gr);
        if (wound) { x.save(); x.setLineDash([1.2, 1.6]); pathLine(0, w * .95, 'rgba(0,0,0,.35)'); x.restore(); }
        if (st.amp > .08) { x.globalAlpha = Math.min(.5, st.amp * .5); pathLine(0, w * 2.4, nylon ? 'rgba(255,240,200,.35)' : 'rgba(255,220,150,.35)'); x.globalAlpha = 1; }
      }
      // dedos
      const rad = f => g.spacing(f) * .56;
      this.fing.forEach((f, k) => {
        if (f.a < .02) return; const xx = (X(f.f) + X(f.f - 1)) / 2 + (X(f.f) - X(f.f - 1)) * .12; const yy = Y(f.s, f.f); const r = rad(f.f);
        if (f.px === null) { f.px = xx; f.py = yy + 60; }
        const sm = 1 - Math.exp(-.2); f.px += (xx - f.px) * (f.on ? .35 : .1); f.py += (yy - f.py) * (f.on ? .4 : .1); const lift = (1 - f.a) * 26;
        const px = f.px, py = f.py + lift; const ang = -0.28 + k * 0.06;
        x.save(); x.globalAlpha = Math.min(1, f.a * 1.05);
        // corpo do dedo vindo de baixo (mão fica fora da tela)
        const len = this.H - py + 40; const bx = px - Math.tan(ang) * len * .35;
        const gr = x.createLinearGradient(px - r, 0, px + r, 0); gr.addColorStop(0, '#c08a63'); gr.addColorStop(.5, '#e7b992'); gr.addColorStop(1, '#a8714d');
        x.fillStyle = gr; x.beginPath(); x.moveTo(px - r * .95, py); x.lineTo(bx - r * 1.12, this.H + 10); x.lineTo(bx + r * 1.12, this.H + 10); x.lineTo(px + r * .95, py); x.arc(px, py, r * .95, 0, Math.PI, true); x.fill();
        // ponta
        const rg = x.createRadialGradient(px - r * .25, py - r * .3, r * .1, px, py, r); rg.addColorStop(0, '#f3cfae'); rg.addColorStop(1, '#c98f68'); x.fillStyle = rg; x.beginPath(); x.ellipse(px, py, r * .95, r * .82, 0, 0, 7); x.fill();
        x.strokeStyle = 'rgba(80,40,20,.35)'; x.lineWidth = 1.2; x.stroke();
        // unha
        x.fillStyle = 'rgba(255,235,220,.5)'; x.beginPath(); x.ellipse(px, py - r * .42, r * .42, r * .22, 0, 0, 7); x.fill();
        x.fillStyle = '#2a160b'; x.font = `800 ${Math.round(r * .95)}px system-ui,sans-serif`; x.textAlign = 'center'; x.fillText(String(k + 1), px, py + r * .36);
        x.restore();
      });
      // legenda
      const c = this.cur; if (c) { const sp = c.sp !== undefined ? c.sp : c.p - this.capo; x.fillStyle = '#f1dfb8'; x.font = '600 15px system-ui,sans-serif'; x.textAlign = 'left'; const nm = NAMES[((c.p % 12) + 12) % 12] + (Math.floor(c.p / 12) - 1); x.fillText(`${nm} • corda ${c.s + 1} • ${c.f === 0 ? 'solta' : 'casa ' + c.f}${c.fin ? ' • dedo ' + c.fin : ''}`, 16, 24); }
      x.textAlign = 'left';
    }
  }
  DH.Fretboard = Fretboard;
})(typeof window !== 'undefined' ? window : globalThis);
