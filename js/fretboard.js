/* DigitaHinos — violão folk animado (canvas).
 * Visto de frente para quem toca: corpo à esquerda, braço à direita, corda Mi grave (6ª) em cima.
 * Escala real das casas (650 mm), cordas que vibram, dedos da mão esquerda (1-4) descendo sobre o braço,
 * dedos da mão direita (p-i-m-a) que palhetam, capotraste e câmera (violão inteiro ou seguindo a mão). */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const NAMES = ['Dó', 'Dó♯', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const now_s = () => (G.performance ? G.performance.now() : Date.now()) / 1000;

  /* ---- geometria (mm). d = distância à pestana (nut); x do mundo = -d (corpo à esquerda) ---- */
  const SL = 650;
  const D = n => SL * (1 - Math.pow(2, -n / 12));          // posição da casa n
  const sh = d => 17.5 + 9.5 * d / SL;                      // meia-abertura entre as cordas
  const SY = (si, d) => sh(d) * (1 - 2 * si / 5);           // y da corda si (5 = Mi grave, em cima)
  const fbh = d => sh(d) + 5.4;                             // meia-largura do espelho
  const ANG = -0.125;                                       // inclinação (cabeça sobe, como ao tocar)
  const BRIDGE_D = SL, HOLE_D = 487, HOLE_R = 52, END_D = 830;
  const BODY = [[352, -29], [372, -50], [405, -95], [445, -133], [490, -147], [530, -139], [562, -124], [600, -137], [650, -170], [720, -195], [772, -186], [806, -150], [824, -92], [830, 0],
    [824, 92], [806, 150], [772, 186], [720, 195], [650, 170], [600, 137], [562, 126], [535, 127], [506, 121], [478, 106], [450, 84], [420, 66], [392, 50], [368, 38], [352, 29]];
  const RH_D = [572, 586, 600, 614], RH_NAME = ['p', 'i', 'm', 'a'], RH_REST = [3, 2, 1, 0];
  const GOLD = '#d8c18c', CREAM = '#efe6cc';
  const LH_COL = ['#4da3ff', '#4fd37a', '#ffb02e', '#ee6bd8'];     // dedos 1-4 (mão esquerda)
  const RH_COL = ['#ffd84d', '#2fd6c1', '#9bb8ff', '#ff8aa8'];     // p i m a (mão direita)

  function spline(x, P, k) {            // Catmull-Rom → Bézier, em coordenadas (d,y) mapeadas para o mundo (-d,y)
    const pt = i => { const p = P[clamp(i, 0, P.length - 1)]; return [-(p[0] * k[0] + k[2]), p[1] * k[1]]; };
    let a = pt(0); x.moveTo(a[0], a[1]);
    for (let i = 0; i < P.length - 1; i++) { const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2); x.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
  }

  class Fretboard {
    constructor(canvas) {
      this.c = canvas; this.x = canvas.getContext('2d'); this.notes = []; this.type = 'nylon'; this.capo = 0; this.camMode = 'full';
      this.fing = [1, 2, 3, 4].map(() => ({ s: 2, f: 3, a: 0, px: null, py: null, on: false }));
      this.str = [0, 0, 0, 0, 0, 0].map(() => ({ amp: 0, rt0: 0, freq: 9 }));
      this.rh = RH_NAME.map((n, k) => ({ s: RH_REST[k], y: null, rt0: -9, pulse: 0 }));
      this.last = -1; this.spb = 1; this.now = 0; this.idx = 0; this.cam = null; this.reg = null;
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect(); const dpr = Math.min(2, G.devicePixelRatio || 1);
      const w = Math.max(320, Math.round(r.width || 1000)), h = Math.max(180, Math.round(r.height || 420));
      this.c.width = w * dpr; this.c.height = h * dpr; this.W = w; this.H = h; this.dpr = dpr; this.cam = null;
    }
    setCamMode(m) { this.camMode = m === 'follow' ? 'follow' : 'full'; this.cam = null; }
    setNotes(notes, opts) { this.notes = notes.slice().sort((a, b) => a.t - b.t); this.type = opts.type; this.capo = opts.capo || 0; this.idx = 0; this.reset(); }
    reset() { this.fing.forEach(f => { f.a = 0; f.on = false; f.px = null; }); this.str.forEach(s => { s.amp = 0; }); this.rh.forEach(r => { r.pulse = 0; }); this.reg = null; this.cam = null; }
    pluck(s, t, vel) {
      const st = this.str[s]; st.amp = Math.min(1, .55 + vel * .7); st.rt0 = now_s(); st.freq = 8 + (5 - s) * .5;
      const k = s >= 3 ? 0 : s === 2 ? 1 : s === 1 ? 2 : 3; const r = this.rh[k]; r.s = s; r.rt0 = now_s();
    }
    /* câmera */
    fullCam() { const s = Math.min(this.W * .96 / 1075, this.H * .95 / 545); return { cx: -318, cy: 22, s }; }
    camTarget() {
      const full = this.fullCam(); if (this.camMode !== 'follow') return full;
      const reg = this.reg || { lo: 1, hi: 5 }; const dLo = D(Math.max(0, reg.lo - 1.3)), dHi = D(reg.hi + .9);
      const minVW = this.W < 600 ? 230 : 400; const vw = Math.max(minVW, (dHi - dLo) * 1.3 + 70);
      return { cx: -(dLo + dHi) / 2, cy: -22, s: clamp(this.W / vw, full.s, 5.2) };
    }
    update(now, dt, spb) {
      this.spb = spb || 1; const N = this.notes;
      while (this.idx < N.length && N[this.idx].t <= now + 1e-6) { const n = N[this.idx++]; if (now - n.t < 0.6) this.pluck(n.s, now, n.role === 'melody' || n.role === 'solo' ? .9 : .55); }
      const act = []; const lead = 0.14 / Math.max(.2, this.spb);
      for (const n of N) { if (n.t > now + 0.6) break; if (n.f > 0 && now >= n.t - lead && now < n.t + Math.max(n.hold, .3)) act.push(n); }
      const used = new Set();
      act.forEach(n => { const k = n.fin - 1; if (k < 0 || k > 3) return; const f = this.fing[k]; if (used.has(k)) return; used.add(k); f.s = n.s; f.f = n.f; f.on = true; });
      this.fing.forEach((f, k) => { if (!used.has(k)) f.on = false; });
      // região de casas das próximas notas (para a câmera de zoom)
      let lo = 99, hi = 0, cnt = 0;
      for (const n of N) { if (n.t < now - 0.3) continue; if (n.t > now + 2.2 / Math.max(.4, this.spb)) break; if (n.f > 0) { lo = Math.min(lo, this.capo + n.f); hi = Math.max(hi, this.capo + n.f); cnt++; } }
      if (cnt) this.reg = { lo, hi }; else if (!act.length && this.reg) this.reg = { lo: Math.max(1, this.reg.lo * .98), hi: Math.max(this.reg.lo + 3, this.reg.hi * .98) };
      const tg = this.camTarget(); if (!this.cam) this.cam = Object.assign({}, tg); const k = 1 - Math.exp(-dt * 3.6);
      this.cam.cx += (tg.cx - this.cam.cx) * k; this.cam.cy += (tg.cy - this.cam.cy) * k; this.cam.s += (tg.s - this.cam.s) * k;
      this.fing.forEach(f => { f.a += ((f.on ? 1 : 0) - f.a) * (1 - Math.exp(-dt * (f.on ? 22 : 11))); });
      this.str.forEach(s => { s.amp *= Math.exp(-dt * 2.4); });
      this.now = now; this.act = act;
      const top = act.find(n => n.role === 'melody' || n.role === 'solo') || act[0] || null;
      const last = [...N].reverse().find(n => n.t <= now + 1e-6 && (n.role === 'melody' || n.role === 'solo'));
      this.cur = last || top; this.draw(now);
    }
    /* ---------- desenho ---------- */
    drawBody(x, s) {
      // corpo
      const bg = x.createLinearGradient(0, -200, 0, 200); bg.addColorStop(0, '#1d1c19'); bg.addColorStop(.5, '#151412'); bg.addColorStop(1, '#0c0c0b');
      x.beginPath(); spline(x, BODY, [1, 1, 0]); x.closePath(); x.fillStyle = bg; x.fill();
      x.lineJoin = 'round'; x.strokeStyle = GOLD; x.lineWidth = 2.6; x.stroke();
      x.beginPath(); spline(x, BODY.map(p => [(p[0] - 590) * .955 + 590, p[1] * .93]), [1, 1, 0]); x.closePath(); x.strokeStyle = 'rgba(216,193,140,.55)'; x.lineWidth = 1; x.stroke();
      // boca e roseta
      const hx = -HOLE_D; x.beginPath(); x.arc(hx, 0, HOLE_R, 0, 7); x.fillStyle = '#030303'; x.fill();
      x.strokeStyle = GOLD; x.lineWidth = 2.4; x.stroke();
      x.beginPath(); x.arc(hx, 0, HOLE_R + 7, 0, 7); x.lineWidth = 1; x.strokeStyle = 'rgba(216,193,140,.8)'; x.stroke();
      x.beginPath(); x.arc(hx, 0, HOLE_R + 11, 0, 7); x.lineWidth = .7; x.strokeStyle = 'rgba(216,193,140,.5)'; x.stroke();
      // cavalete
      const bx = -BRIDGE_D; x.beginPath(); x.moveTo(bx + 15, -72); x.lineTo(bx - 15, -76); x.quadraticCurveTo(bx - 20, 0, bx - 15, 76); x.lineTo(bx + 15, 72); x.quadraticCurveTo(bx + 20, 0, bx + 15, -72); x.closePath();
      x.fillStyle = '#1f1a14'; x.fill(); x.lineWidth = 1.2; x.strokeStyle = GOLD; x.stroke();
      x.fillStyle = CREAM; x.fillRect(bx - .9, SY(5, BRIDGE_D) - 4, 1.8, SY(0, BRIDGE_D) - SY(5, BRIDGE_D) + 8);
      for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(bx - 9, SY(i, BRIDGE_D), 2.1, 0, 7); x.fillStyle = CREAM; x.fill(); }
    }
    drawNeck(x, s) {
      // cabeça
      const hh = t => 31 + 6 * Math.min(1, t / 150);
      x.beginPath(); x.moveTo(0, -hh(0)); x.lineTo(158, -hh(158)); x.bezierCurveTo(182, -hh(170), 196, -22, 196, 0); x.bezierCurveTo(196, 22, 182, hh(170), 158, hh(158)); x.lineTo(0, hh(0)); x.closePath();
      const hg = x.createLinearGradient(0, -40, 0, 40); hg.addColorStop(0, '#1c1b18'); hg.addColorStop(1, '#0d0d0c'); x.fillStyle = hg; x.fill(); x.lineWidth = 2.2; x.strokeStyle = GOLD; x.stroke();
      // braço (madeira) e espelho
      const L = 462; x.beginPath(); x.moveTo(0, -fbh(0) - 2); for (let d = 0; d <= L; d += 20) x.lineTo(-d, -fbh(d) - 2); for (let d = L; d >= 0; d -= 20) x.lineTo(-d, fbh(d) + 2); x.closePath(); x.fillStyle = '#12110f'; x.fill();
      x.beginPath(); x.moveTo(0, -fbh(0)); for (let d = 0; d <= L; d += 20) x.lineTo(-d, -fbh(d)); for (let d = L; d >= 0; d -= 20) x.lineTo(-d, fbh(d)); x.closePath(); x.fillStyle = '#070706'; x.fill();
      x.lineWidth = 1.5; x.strokeStyle = GOLD; x.stroke();
      // marcadores
      x.fillStyle = 'rgba(232,218,178,.85)';
      for (const m of [3, 5, 7, 9, 12, 15, 17, 19]) { const cd = (D(m - 1) + D(m)) / 2; (m === 12 ? [-8, 8] : [0]).forEach(o => { x.beginPath(); x.arc(-cd, o * (1 + cd / SL * .3), 3.3, 0, 7); x.fill(); }); }
      // trastes e pestana
      for (let n = 1; n <= 20; n++) { const d = D(n); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(-d - .5, -fbh(d), 2.4, 2 * fbh(d)); x.fillStyle = 'rgba(239,230,204,.82)'; x.fillRect(-d - 1, -fbh(d), 1.6, 2 * fbh(d)); }
      x.fillStyle = '#efe6cc'; x.fillRect(-1.2, -fbh(0) - 1, 3.4, 2 * fbh(0) + 2);
      // tarraxas
      const col = [[5, 0], [4, 1], [3, 2], [2, 2], [1, 1], [0, 0]];
      for (const [si, k] of col) { const top = si >= 3; const px = 40 + k * 42, py = (top ? -1 : 1) * (hh(px) - 7); x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fillStyle = CREAM; x.fill(); x.beginPath(); x.ellipse(px + 1, py + (top ? -9 : 9), 8, 5.4, 0, 0, 7); x.fillStyle = '#3b3326'; x.fill(); x.strokeStyle = GOLD; x.lineWidth = 1.2; x.stroke(); }
    }
    draw(now) {
      const x = this.x, dpr = this.dpr, W = this.W, H = this.H; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bgr = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * .75); bgr.addColorStop(0, '#171512'); bgr.addColorStop(1, '#080807'); x.fillStyle = bgr; x.fillRect(0, 0, W, H);
      const cam = this.cam || this.fullCam(); const s = cam.s; const nylon = this.type === 'nylon'; const capo = this.capo, rt = now_s();
      x.save(); x.translate(W / 2, H / 2); x.scale(s, s); x.rotate(ANG); x.translate(-cam.cx, -cam.cy);
      this.drawBody(x, s); this.drawNeck(x, s);
      // números das casas (relativos ao capotraste, como na "casa" da legenda)
      x.font = `600 ${(12 / s).toFixed(2)}px system-ui,sans-serif`; x.textAlign = 'center'; x.fillStyle = 'rgba(216,193,140,.9)';
      for (let n = capo + 1; n <= 19; n++) { const cd = (D(n - 1) + D(n)) / 2; const gap = (D(n) - D(n - 1)) * s; const step = gap < 17 ? 2 : 1; if ((n - capo) % step) continue; x.fillText(String(n - capo), -cd, fbh(cd) + 15 / s + 1); }
      // cordas
      const px = v => v / s; const base = [1.5, 1.8, 2.2, 2.7, 3.2, 3.7].map(w => w * (nylon ? 1 : .9)); const wk = .8 + .2 * clamp(s / 1.2, .5, 1.8);
      for (let si = 0; si < 6; si++) {
        const st = this.str[si]; const pr = this.fing.find(f => f.a > .5 && f.s === si); const fr = pr ? pr.f : 0; const w = px(base[si] * wk);
        const dStart = fr > 0 ? D(capo + fr) : (capo > 0 ? D(capo) - 3 : 0); const wound = si >= 3;
        const c0 = nylon ? (wound ? '#d4d4cc' : '#f1ead6') : (wound ? '#dcaa55' : '#ececec'), c1 = nylon ? (wound ? '#8e8e88' : '#bdb7a2') : (wound ? '#7a5522' : '#8d8d8d');
        const amp = st.amp * (nylon ? 4.2 : 3.4) * (1 - si * .05); const ph = (rt - st.rt0) * st.freq * 6.2832;
        const path = (dy, lw, style, dash) => { x.beginPath(); const n = 40; for (let i = 0; i <= n; i++) { const u = i / n; const d = dStart + (BRIDGE_D - dStart) * u; const y = SY(si, d) + dy + Math.sin(Math.PI * u) * Math.sin(ph) * amp; if (i) x.lineTo(-d, y); else x.moveTo(-d, y); } x.lineWidth = lw; x.strokeStyle = style; x.stroke(); };
        // trecho morto (pestana/capo → dedo) e trecho até a tarraxa
        x.lineCap = 'round'; const hd = 40 + (si >= 3 ? 5 - si : si) * 42 + 0; const postX = si >= 3 ? 40 + (5 - si) * 42 : 40 + si * 42; const postY = (si >= 3 ? -1 : 1) * (31 + 6 * Math.min(1, postX / 150) - 7);
        x.beginPath(); x.moveTo(postX, postY); x.lineTo(0, SY(si, 0)); x.lineWidth = w * .8; x.strokeStyle = 'rgba(210,205,190,.55)'; x.stroke();
        if (dStart > 0) { x.beginPath(); x.moveTo(0, SY(si, 0)); x.lineTo(-dStart, SY(si, dStart)); x.lineWidth = w * .8; x.strokeStyle = 'rgba(200,196,182,.35)'; x.stroke(); }
        path(w * .9, w * 1.2, 'rgba(0,0,0,.45)');
        const gr = x.createLinearGradient(0, -30, 0, 30); gr.addColorStop(0, c0); gr.addColorStop(1, c1); path(0, w, gr);
        if (wound) { x.save(); x.setLineDash([px(1.2), px(1.6)]); path(0, w * .9, 'rgba(0,0,0,.35)'); x.restore(); }
        if (st.amp > .08) { x.globalAlpha = Math.min(.5, st.amp * .5); path(0, w * 2.6, nylon ? 'rgba(255,240,200,.4)' : 'rgba(255,225,160,.4)'); x.globalAlpha = 1; }
      }
      // capotraste
      if (capo > 0) {
        const d = D(capo) - 4.5, h = fbh(d) + 8; const g = x.createLinearGradient(-d - 8, 0, -d + 8, 0); g.addColorStop(0, '#2b2b2b'); g.addColorStop(.5, '#9a9a9a'); g.addColorStop(1, '#2b2b2b');
        x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(-d - 7, -h, 14, 2 * h, 5) : x.rect(-d - 7, -h, 14, 2 * h); x.fill();
        x.save(); x.translate(-d, -h - 6 / s); x.fillStyle = '#e8d9b0'; x.font = `700 ${(12 / s).toFixed(2)}px system-ui,sans-serif`; x.fillText('CAPO ' + capo, 0, 0); x.restore();
      }
      // mão direita (p i m a)
      for (let k = 0; k < 4; k++) {
        const r = this.rh[k], d = RH_D[k]; const ts = (rt - r.rt0); const dip = ts >= 0 && ts < .26 ? Math.sin(Math.PI * Math.min(1, ts / .26)) : 0;
        const rr = clamp(9.5 / s, 6.2, 9.5); const ty = SY(r.s, d) - rr * 1.9 + dip * rr * 1.7; if (r.y === null) r.y = ty; r.y += (ty - r.y) * .35;
        this.bubble(x, -d, r.y, rr, RH_COL[k], RH_NAME[k], 1);
      }
      // mão esquerda (1 2 3 4)
      this.fing.forEach((f, k) => {
        if (f.a < .02) return; const af = capo + f.f; const dp = D(af) - (D(af) - D(af - 1)) * .3; const tx = -dp, ty = SY(f.s, dp);
        if (f.px === null) { f.px = tx; f.py = ty; }
        f.px += (tx - f.px) * (f.on ? .45 : .1); f.py += (ty - f.py) * (f.on ? .45 : .1);
        this.bubble(x, f.px, f.py, clamp(10.5 / s, 7, 10.5), LH_COL[k], String(k + 1), Math.min(1, f.a * 1.05));
      });
      x.restore();
      // legenda
      const c = this.cur; if (c) { x.fillStyle = '#f1dfb8'; x.font = '600 15px system-ui,sans-serif'; x.textAlign = 'left'; const nm = NAMES[((c.p % 12) + 12) % 12] + (Math.floor(c.p / 12) - 1); x.fillText(`${nm} • corda ${c.s + 1} • ${c.f === 0 ? 'solta' : 'casa ' + c.f}${c.fin ? ' • dedo ' + c.fin : ''}`, 16, 24); }
      x.textAlign = 'left';
    }
    /** Bolinha colorida com o número do dedo (esquerda) ou a letra p-i-m-a (direita), sobre a corda. */
    bubble(x, px, py, r, col, label, alpha) {
      x.save(); x.globalAlpha = alpha;
      x.beginPath(); x.arc(px + r * .12, py + r * .16, r * 1.04, 0, 7); x.fillStyle = 'rgba(0,0,0,.45)'; x.fill();
      const g = x.createRadialGradient(px - r * .35, py - r * .4, r * .1, px, py, r * 1.05); g.addColorStop(0, '#ffffff'); g.addColorStop(.28, col); g.addColorStop(1, col);
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fillStyle = g; x.fill(); x.lineWidth = Math.max(.8, r * .13); x.strokeStyle = 'rgba(255,255,255,.92)'; x.stroke();
      x.fillStyle = '#14110c'; x.font = `800 ${(r * 1.18).toFixed(2)}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, px, py + r * .06); x.textBaseline = 'alphabetic'; x.restore();
    }
  }
  DH.Fretboard = Fretboard;
})(typeof window !== 'undefined' ? window : globalThis);
