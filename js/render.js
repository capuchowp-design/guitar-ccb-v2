/* DigitaHinos — partitura (pauta) + tablatura em SVG, com acordes e diagramas */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const EPS = 1e-4, mod = (a, n) => ((a % n) + n) % n;
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], LPC = [0, 2, 4, 5, 7, 9, 11];
  const SHARP_ORD = [38, 35, 39, 36, 33, 37, 34], FLAT_ORD = [34, 37, 33, 36, 32, 35, 31]; // posições diatônicas (C4=28)
  const STD = [6, 4, 3, 2, 1.5, 1, .75, .5, .375, .25, .125];
  const f1 = x => Math.round(x * 10) / 10;

  function keyAlter(fifths) { // alteração por letra na armadura
    const a = [0, 0, 0, 0, 0, 0, 0];
    const sh = [3, 0, 4, 1, 5, 2, 6], fl = [6, 2, 5, 1, 4, 0, 3];
    if (fifths > 0) for (let i = 0; i < fifths; i++) a[sh[i]] = 1; else for (let i = 0; i < -fifths; i++) a[fl[i]] = -1;
    return a;
  }
  /** Ortografia de um tom (MIDI) → {li (índice letra), al (alteração), oct} */
  function spell(p, fifths, hint) {
    if (hint && hint.st) { const li = LETTERS.indexOf(hint.st); if (li >= 0 && mod(LPC[li] + hint.al, 12) === mod(p, 12)) return { li, al: hint.al, oct: Math.round((p - LPC[li] - hint.al) / 12) - 1 }; }
    const ka = keyAlter(fifths); const pc = mod(p, 12);
    for (let li = 0; li < 7; li++) if (mod(LPC[li] + ka[li], 12) === pc) return { li, al: ka[li], oct: Math.round((p - LPC[li] - ka[li]) / 12) - 1 };
    const sharp = fifths > 0; // cromático
    for (let li = 0; li < 7; li++) { const al = sharp ? 1 : -1; if (mod(LPC[li] + al, 12) === pc) return { li, al, oct: Math.round((p - LPC[li] - al) / 12) - 1 }; }
    for (let li = 0; li < 7; li++) { const al = sharp ? -1 : 1; if (mod(LPC[li] + al, 12) === pc) return { li, al, oct: Math.round((p - LPC[li] - al) / 12) - 1 }; }
    return { li: 0, al: 0, oct: 4 };
  }
  function decompose(d) { const r = []; let x = d; while (x > 0.115) { let v = STD.find(s => s <= x + EPS); if (!v) break; r.push(v); x -= v; } return r.length ? r : [Math.max(.125, d)]; }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Clave de Sol desenhada em traços (unidade = espaço da pauta; origem = linha do Sol). */
  const CLEF = '<path d="M0.78 -2.7C1.05 -3.9 0.6 -5.1 0.2 -5.0C-0.35 -4.9 -0.4 -3.8 0 -2.5C0.3 -1.5 0.1 -0.3 0.05 0.8C0 1.9 0.1 2.7 0.12 3.1C0.1 3.75 -0.65 3.75 -0.6 3.1" fill="none" stroke="currentColor" stroke-width="0.26" stroke-linecap="round"/><path d="M0.1 -0.9C0.95 -1.25 1.35 0.1 0.65 1C-0.2 1.8 -1.25 0.95 -1 -0.1C-0.8 -0.95 0.25 -1.2 0.5 -0.45C0.65 0.05 0.1 0.45 -0.15 0.15" fill="none" stroke="currentColor" stroke-width="0.24" stroke-linecap="round"/><circle cx="-0.6" cy="3.15" r="0.22" fill="currentColor"/>';

  function acc(al, x, y, sp) {
    if (al === 1) return `<path d="M${f1(x - .25 * sp)} ${f1(y - 1.05 * sp)}V${f1(y + 1.05 * sp)}M${f1(x + .25 * sp)} ${f1(y - 1.15 * sp)}V${f1(y + .95 * sp)}" stroke="currentColor" stroke-width="${f1(.1 * sp)}"/><path d="M${f1(x - .5 * sp)} ${f1(y - .25 * sp)}L${f1(x + .5 * sp)} ${f1(y - .55 * sp)}M${f1(x - .5 * sp)} ${f1(y + .55 * sp)}L${f1(x + .5 * sp)} ${f1(y + .25 * sp)}" stroke="currentColor" stroke-width="${f1(.28 * sp)}"/>`;
    if (al === -1) return `<path d="M${f1(x - .2 * sp)} ${f1(y - 1.7 * sp)}V${f1(y + .5 * sp)}C${f1(x + .9 * sp)} ${f1(y - .2 * sp)} ${f1(x + .8 * sp)} ${f1(y - 1.1 * sp)} ${f1(x - .2 * sp)} ${f1(y + .2 * sp)}" fill="none" stroke="currentColor" stroke-width="${f1(.14 * sp)}" stroke-linecap="round"/>`;
    return `<path d="M${f1(x - .3 * sp)} ${f1(y - 1.1 * sp)}V${f1(y + .4 * sp)}L${f1(x + .3 * sp)} ${f1(y + .25 * sp)}M${f1(x + .3 * sp)} ${f1(y + 1.1 * sp)}V${f1(y - .4 * sp)}L${f1(x - .3 * sp)} ${f1(y - .25 * sp)}" fill="none" stroke="currentColor" stroke-width="${f1(.12 * sp)}"/>`;
  }
  function restGlyph(dur, x, yMid, sp) {
    if (dur >= 4) return `<rect x="${f1(x - .6 * sp)}" y="${f1(yMid - sp)}" width="${f1(1.2 * sp)}" height="${f1(.5 * sp)}" fill="currentColor"/>`;
    if (dur >= 2) return `<rect x="${f1(x - .6 * sp)}" y="${f1(yMid - .5 * sp)}" width="${f1(1.2 * sp)}" height="${f1(.5 * sp)}" fill="currentColor"/>`;
    if (dur >= 1) return `<path d="M${f1(x - .3 * sp)} ${f1(yMid - 1.4 * sp)}L${f1(x + .35 * sp)} ${f1(yMid - .5 * sp)}L${f1(x - .35 * sp)} ${f1(yMid + .3 * sp)}L${f1(x + .3 * sp)} ${f1(yMid + 1.1 * sp)}" fill="none" stroke="currentColor" stroke-width="${f1(.28 * sp)}" stroke-linejoin="round"/>`;
    return `<circle cx="${f1(x - .15 * sp)}" cy="${f1(yMid - .4 * sp)}" r="${f1(.28 * sp)}" fill="currentColor"/><path d="M${f1(x + .3 * sp)} ${f1(yMid - .6 * sp)}L${f1(x - .3 * sp)} ${f1(yMid + 1 * sp)}" stroke="currentColor" stroke-width="${f1(.14 * sp)}"/>`;
  }

  /** Monta eventos por compasso e voz. */
  function buildMeasures(sc, arr, trueDurVoices) {
    const M = sc.measures; const per = M.map(() => ({ v: { 1: [], 2: [] }, tab: [], chords: [] }));
    // segmenta notas por compasso (ligaduras)
    for (const n of arr.notes) {
      let t = n.t, rem = (n.voice === 2 && !trueDurVoices[2]) ? n.d : n.d; let mi = n.m, first = true;
      while (rem > EPS && mi < M.length) {
        const avail = M[mi].start + M[mi].len - t; const take = Math.min(rem, avail);
        if (take > EPS) {
          let tt = t; const parts = decompose(take);
          parts.forEach((d, k) => { per[mi].v[n.voice].push({ t: tt - M[mi].start, d, n, tieNext: k < parts.length - 1 || rem - take > EPS, tiePrev: !(first && k === 0), seg: true }); tt += d; });
        }
        rem -= take; t += take; mi++; first = false; if (take <= EPS) break;
      }
      per[n.m].tab.push(n);
    }
    arr.chords.forEach(c => { const mi = c.m; if (per[mi]) per[mi].chords.push(c); });
    return per;
  }

  function layout(sc, arr, o) {
    const sp = o.sp || 7.5, W = o.W; const fifths = arr.fifths; const tabOnly = !!o.tabOnly;
    const M = sc.measures; const verseSet = new Set(); arr.notes.forEach(n => { if (n.lyrs) Object.keys(n.lyrs).forEach(k => verseSet.add(k)); else if (n.lyr) verseSet.add('1'); });
    const verses = [...verseSet].sort((x, y) => x - y); const lyrOn = !!o.lyrics && verses.length > 0;
    const singleVoice = !arr.notes.some(n => n.voice === 2);
    const trueDur = { 1: true, 2: !(arr.info.mode === 'full' || arr.info.mode === 'simple') };
    const per = buildMeasures(sc, arr, trueDur);
    const meas = [];
    M.forEach((m, mi) => {
      const P = per[mi]; const len = m.len;
      // eventos por voz: agrupa por onset
      const voices = {};
      for (const v of [1, 2]) {
        const segs = P.v[v].slice().sort((a, b) => a.t - b.t);
        const groups = []; for (const s of segs) { const g = groups[groups.length - 1]; if (g && Math.abs(g.t - s.t) < EPS) { g.items.push(s); g.d = Math.min(g.d, s.d); } else groups.push({ t: s.t, d: s.d, items: [s] }); }
        const evs = [];
        let cur = 0;
        groups.forEach((g, i) => {
          if (g.t > cur + EPS) decompose(g.t - cur).forEach(d => { evs.push({ rest: true, t: cur, d }); cur += d; });
          const nx = groups[i + 1]; let d = g.d;
          if (!trueDur[v]) { const iv = (nx ? nx.t : len) - g.t; d = Math.min(iv, d >= iv - EPS ? iv : Math.max(d, iv)); const dd = decompose(Math.max(.125, iv)); d = dd[0]; if (!nx || dd.length === 1) d = iv > EPS ? (decompose(iv)[0]) : d; }
          else if (nx && g.t + d > nx.t + EPS) d = Math.max(.125, nx.t - g.t);
          const parts = decompose(d); let tt = g.t;
          parts.forEach((dd, k) => { evs.push({ t: tt, d: dd, items: g.items, tieNext: k < parts.length - 1 || g.items.some(x => x.tieNext), tiePrev: k > 0 || g.items.some(x => x.tiePrev) }); tt += dd; });
          cur = g.t + parts.reduce((a, b) => a + b, 0);
          if (trueDur[v] && nx === undefined) { /* resto final abaixo */ }
        });
        if (trueDur[v] && groups.length) { if (cur < len - EPS) decompose(len - cur).forEach(d => { evs.push({ rest: true, t: cur, d }); cur += d; }); }
        else if (!groups.length && v === 1) { evs.push({ rest: true, t: 0, d: len, whole: true }); }
        voices[v] = evs;
      }
      // colunas
      const times = new Set([0]); for (const v of [1, 2]) voices[v].forEach(e => times.add(Math.round(e.t * 1000) / 1000)); P.tab.forEach(n => times.add(Math.round((n.t - m.start) * 1000) / 1000)); P.chords.forEach(c => times.add(Math.round((c.t - m.start) * 1000) / 1000));
      const cols = [...times].filter(t => t < len - EPS).sort((a, b) => a - b).map(t => ({ t, w: 0 }));
      const hasAcc = new Array(cols.length).fill(false);
      meas.push({ m, mi, len, voices, cols, tab: P.tab, chords: P.chords, hasAcc });
    });
    // acidentes + largura das colunas
    const keyAl = keyAlter(fifths);
    meas.forEach(ms => {
      const state = {}; ms.heads = new Map();
      const idxOf = t => { let b = 0, bd = 1e9; ms.cols.forEach((c, i) => { const d = Math.abs(c.t - t); if (d < bd) { bd = d; b = i; } }); return b; };
      ms.idxOf = idxOf;
      const all = [];
      for (const v of [1, 2]) ms.voices[v].forEach(e => { if (!e.rest) all.push({ v, e }); });
      all.sort((a, b) => a.e.t - b.e.t);
      all.forEach(({ v, e }) => {
        const heads = e.items.map(it => it.n).filter((n, i, a) => a.indexOf(n) === i).map(n => {
          const sp2 = spell(n.p, fifths, n.st ? { st: n.st, al: n.al } : null);
          const dia = sp2.li + 7 * (sp2.oct + 1); // escrito uma oitava acima do som real
          const cur = state[dia] !== undefined ? state[dia] : keyAl[sp2.li]; let accid = null;
          if (e.tiePrev && state[dia] === sp2.al) accid = null; else if (cur !== sp2.al) { accid = sp2.al === 0 ? 0 : sp2.al; }
          state[dia] = sp2.al; return { n, dia, al: sp2.al, accid };
        }).sort((a, b) => a.dia - b.dia);
        e.heads = heads; if (heads.some(h => h.accid !== null)) ms.hasAcc[idxOf(e.t)] = true;
      });
      ms.cols.forEach((c, i) => { const nx = i + 1 < ms.cols.length ? ms.cols[i + 1].t : ms.len; const g = Math.max(.125, nx - c.t); c.w = (1.5 + 2.3 * Math.sqrt(g)) * sp + (ms.hasAcc[i] ? 1.2 * sp : 0); if (g < .26) c.w = Math.max(c.w, 2.7 * sp); });
      ms.pad0 = 1.1 * sp; ms.pad1 = 0.9 * sp; ms.w = ms.pad0 + ms.cols.reduce((a, c) => a + c.w, 0) + ms.pad1;
    });
    // sistemas
    const left = 1 * sp, headW = 6.8 * sp + Math.abs(fifths) * 1.15 * sp, firstExtra = 3 * sp;
    const systems = []; let cur = null;
    meas.forEach(ms => {
      const hw = headW + (systems.length === 0 ? firstExtra : 0);
      if (!cur || cur.w + ms.w > W - 2 * left - (systems.length === 1 ? 0 : 0)) { cur = { ms: [], w: hw }; systems.push(cur); }
      cur.ms.push(ms); cur.w += ms.w; cur.hw = systems.length === 1 ? headW + firstExtra : headW;
    });
    return { meas, systems, sp, W, left, headW, firstExtra, fifths, lyrOn, verses, singleVoice, tabOnly, trueDur };
  }

  function draw(sc, arr, L, o) {
    const sp = L.sp, W = L.W, fifths = L.fifths, tabOnly = L.tabOnly; const keyAl = keyAlter(fifths);
    const out = []; const colMap = []; const measMap = []; const sysMap = [];
    const staffH = 4 * sp, tabGap = sp * 1.05, tabH = 5 * tabGap;
    const sysTopPad = 5.2 * sp;               // acordes + notas altas
    const midLine = 2 * sp;
    const chordsOn = true;
    let y = 1.2 * sp;
    const voltas = [];
    L.systems.forEach((sys, si) => {
      const staffTop = y + sysTopPad + (tabOnly ? 1 * sp : 0), staffBot = staffTop + staffH;
      const lyrY = staffBot + 5.7 * sp;
      const nv = L.lyrOn ? L.verses.length : 0, VG = 1.95 * sp;
      const tabTop = tabOnly ? staffTop + sp * 0.6 : staffBot + (L.lyrOn ? 7.2 * sp + (nv - 1) * VG : 4.8 * sp);
      const tabBot = tabTop + tabH; const rhyY = tabBot + 1.4 * sp;
      const sysBottom = tabBot + (tabOnly ? 6.4 : 3.6) * sp + (L.lyrOn && tabOnly ? 3 * sp + (nv - 1) * VG : 0);
      const lyrYy = tabOnly ? tabBot + 7.2 * sp : lyrY;
      // extras de largura: justificar
      const hw = si === 0 ? L.headW + L.firstExtra : L.headW; const avail = W - 2 * L.left - hw;
      const natural = sys.ms.reduce((a, m) => a + m.w, 0); const last = si === L.systems.length - 1;
      let k = avail / natural; if (last) k = Math.min(k, 1.25); k = Math.max(.9, k);
      const x0 = L.left; const xs = x0 + hw; const xEnd = last && natural * k < avail ? xs + natural * k : x0 + W - 2 * L.left;
      const staffY = d => staffBot - (d - 30) * sp / 2;
      const g = [];
      // linhas da pauta e tablatura
      if (!tabOnly) for (let i = 0; i < 5; i++) g.push(`<line x1="${x0}" x2="${f1(xEnd)}" y1="${f1(staffTop + i * sp)}" y2="${f1(staffTop + i * sp)}" class="ln"/>`);
      for (let i = 0; i < 6; i++) g.push(`<line x1="${x0}" x2="${f1(xEnd)}" y1="${f1(tabTop + i * tabGap)}" y2="${f1(tabTop + i * tabGap)}" class="ln tl"/>`);
      g.push(`<line x1="${x0}" x2="${x0}" y1="${f1(tabOnly ? tabTop : staffTop)}" y2="${f1(tabBot)}" class="ln thick"/>`);
      // clave, armadura, fórmula
      let hx = x0 + .6 * sp;
      if (!tabOnly) {
        g.push(`<g transform="translate(${f1(hx + 1.2 * sp)} ${f1(staffTop + 3 * sp)}) scale(${sp})">${CLEF}</g><text x="${f1(hx + .55 * sp)}" y="${f1(staffBot + 1.9 * sp)}" font-size="${f1(1.5 * sp)}" font-family="Georgia,serif" font-weight="700">8</text>`);
        hx += 3.4 * sp;
        const ord = fifths > 0 ? SHARP_ORD : FLAT_ORD; for (let i = 0; i < Math.abs(fifths); i++) { g.push(acc(fifths > 0 ? 1 : -1, hx + i * 1.15 * sp, staffY(ord[i]), sp)); }
        hx += Math.abs(fifths) * 1.15 * sp + .6 * sp;
      } else hx += 3.4 * sp;
      g.push(`<text x="${f1(x0 + .5 * sp)}" y="${f1(tabTop + 2.75 * tabGap)}" font-size="${f1(1.55 * sp)}" font-weight="800" font-family="system-ui,sans-serif" transform="rotate(0)" class="tabl">T</text><text x="${f1(x0 + .5 * sp)}" y="${f1(tabTop + 3.85 * tabGap)}" font-size="${f1(1.55 * sp)}" font-weight="800" font-family="system-ui,sans-serif" class="tabl">A</text><text x="${f1(x0 + .5 * sp)}" y="${f1(tabTop + 4.95 * tabGap)}" font-size="${f1(1.55 * sp)}" font-weight="800" font-family="system-ui,sans-serif" class="tabl">B</text>`);
      if (si === 0 || sys.ms[0].m.beatsEff !== (L.systems[si - 1] ? L.systems[si - 1].ms.slice(-1)[0].m.beatsEff : -1)) {
        const mm = sys.ms[0].m; const tx = xs - 2.2 * sp;
        if (!tabOnly) g.push(`<text x="${f1(tx)}" y="${f1(staffTop + 2 * sp - .15 * sp)}" font-size="${f1(2.2 * sp)}" font-family="Georgia,serif" font-weight="700" text-anchor="middle">${mm.beatsEff}</text><text x="${f1(tx)}" y="${f1(staffBot - .15 * sp)}" font-size="${f1(2.2 * sp)}" font-family="Georgia,serif" font-weight="700" text-anchor="middle">${mm.beatTypeEff}</text>`);
      }
      // compassos
      let cx = xs;
      sys.ms.forEach((ms, mIdx) => {
        const m = ms.m; const x1 = cx; const wScaled = ms.w * k; const mEnd = x1 + wScaled;
        const colX = []; let px = x1 + ms.pad0 * k; ms.cols.forEach(c => { colX.push(px); px += c.w * k; });
        measMap.push({ mi: ms.mi, x0: x1, x1: mEnd, sys: si, y0: staffTop - 3 * sp, y1: sysBottom - 2 * sp });
        ms.cols.forEach((c, i) => colMap.push({ t: m.start + c.t, x: colX[i] + 0.0, sys: si, mi: ms.mi, i }));
        const X = t => colX[ms.idxOf(t)];
        // barras
        const top = tabOnly ? tabTop : staffTop;
        const barStyle = (x, right) => {
          if (m.repeatBack && right) return `<line x1="${f1(x - 2.4)}" x2="${f1(x - 2.4)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln thick2"/><line x1="${f1(x)}" x2="${f1(x)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln"/>` + (tabOnly ? '' : `<circle cx="${f1(x - 5.2)}" cy="${f1(staffTop + 1.5 * sp)}" r="${f1(.25 * sp)}" fill="currentColor"/><circle cx="${f1(x - 5.2)}" cy="${f1(staffTop + 2.5 * sp)}" r="${f1(.25 * sp)}" fill="currentColor"/>`);
          if (right && ms.mi === sc.measures.length - 1) return `<line x1="${f1(x - 2.8)}" x2="${f1(x - 2.8)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln"/><line x1="${f1(x)}" x2="${f1(x)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln thick2"/>`;
          return `<line x1="${f1(x)}" x2="${f1(x)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln"/>`;
        };
        if (!tabOnly) g.push(`<line x1="${f1(mEnd)}" x2="${f1(mEnd)}" y1="${f1(staffTop)}" y2="${f1(staffBot)}" class="ln" style="display:none"/>`);
        g.push(barStyle(mEnd, true));
        if (m.repeatFwd) g.push(`<line x1="${f1(x1 + 2.6)}" x2="${f1(x1 + 2.6)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln"/><line x1="${f1(x1)}" x2="${f1(x1)}" y1="${f1(top)}" y2="${f1(tabBot)}" class="ln thick2"/>` + (tabOnly ? '' : `<circle cx="${f1(x1 + 5.2)}" cy="${f1(staffTop + 1.5 * sp)}" r="${f1(.25 * sp)}" fill="currentColor"/><circle cx="${f1(x1 + 5.2)}" cy="${f1(staffTop + 2.5 * sp)}" r="${f1(.25 * sp)}" fill="currentColor"/>`));
        else if (mIdx === 0 && si > 0) { /* já há traço inicial */ }
        if (m.endStart) { g.push(`<path d="M${f1(x1 + 2)} ${f1(top - 2.4 * sp)}V${f1(top - 3.4 * sp)}H${f1(mEnd - 2)}" fill="none" class="vl"/><text x="${f1(x1 + 4)}" y="${f1(top - 2.6 * sp)}" font-size="${f1(1.3 * sp)}" font-family="system-ui,sans-serif">${m.endStart.join(',')}.</text>`); }
        // acordes
        ms.chords.forEach(c => { const x = X(c.t - m.start); g.push(`<text x="${f1(x - .5 * sp)}" y="${f1(top - 3.9 * sp - (m.endStart ? 1.2 * sp : 0) + (tabOnly ? 0 : 0.6 * sp))}" font-size="${f1(1.85 * sp)}" font-weight="800" font-family="system-ui,sans-serif" class="chn">${esc(c.name)}</text>`); });
        // notas
        if (!tabOnly) {
          const dirFor = (v, e) => { if (!L.singleVoice) return v === 1 ? 'up' : 'down'; const ds = e.heads.map(h => h.dia); const avg = (Math.min(...ds) + Math.max(...ds)) / 2; return avg >= 34 ? 'down' : 'up'; };
          for (const v of [1, 2]) {
            const evs = ms.voices[v]; const beams = [];
            // grupos de colcheia por pulso
            const inf = DH.mxl.meterInfo(m.beatsEff, m.beatTypeEff); let grp = null;
            evs.forEach((e, ei) => {
              const ci = ms.idxOf(e.t); const x = colX[ci];
              e.x = x; e.cidx = ci;
              if (e.rest) { if (e.whole) g.push(restGlyph(4, (x1 + mEnd) / 2, staffTop + sp, sp)); else g.push(restGlyph(e.d, x + .6 * sp, staffTop + (v === 1 && !L.singleVoice ? 1.4 : (v === 2 ? 3 : 2)) * sp, sp)); grp = null; return; }
              const dir = dirFor(v, e); e.dir = dir;
              const ys = e.heads.map(h => staffY(h.dia));
              // cabeças + ledger
              const flipped = new Set();
              for (let hi = 1; hi < e.heads.length; hi++) if (e.heads[hi].dia - e.heads[hi - 1].dia === 1 && !flipped.has(hi - 1)) flipped.add(hi);
              const sx = x + (v === 2 && !L.singleVoice ? 0 : 0);
              const cls = `n c${ms.mi}_${ci}`;
              const inner = [];
              e.heads.forEach((h, hi) => {
                const hy = ys[hi]; const hx = sx + (flipped.has(hi) ? (dir === 'up' ? .95 * sp : -.95 * sp) : 0);
                const open = e.d >= 2 - EPS;
                if (e.d >= 4 - EPS) inner.push(`<ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="${f1(.72 * sp)}" ry="${f1(.48 * sp)}" fill="none" stroke="currentColor" stroke-width="${f1(.18 * sp)}"/>`);
                else inner.push(`<ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="${f1(.62 * sp)}" ry="${f1(.46 * sp)}" transform="rotate(-22 ${f1(hx)} ${f1(hy)})" ${open ? `fill="none" stroke="currentColor" stroke-width="${f1(.2 * sp)}"` : 'fill="currentColor"'}/>`);
                if (h.accid !== null) inner.push(acc(h.accid, hx - 1.45 * sp - (flipped.has(hi) && dir === 'down' ? .8 * sp : 0), hy, sp));
                if (isDotted(e.d)) inner.push(`<circle cx="${f1(hx + 1.15 * sp)}" cy="${f1(hy + (Math.round((staffBot - hy) / (sp / 2)) % 2 === 0 ? -.5 * sp : 0))}" r="${f1(.2 * sp)}" fill="currentColor"/>`);
                // linhas suplementares
                const d = h.dia;
                if (d <= 28) for (let ld = 28; ld >= d; ld -= 2) inner.push(`<line x1="${f1(hx - 1.1 * sp)}" x2="${f1(hx + 1.1 * sp)}" y1="${f1(staffY(ld))}" y2="${f1(staffY(ld))}" class="ln"/>`);
                if (d >= 40) for (let ld = 40; ld <= d; ld += 2) inner.push(`<line x1="${f1(hx - 1.1 * sp)}" x2="${f1(hx + 1.1 * sp)}" y1="${f1(staffY(ld))}" y2="${f1(staffY(ld))}" class="ln"/>`);
              });
              const yMin = Math.min(...ys), yMax = Math.max(...ys);
              if (e.d < 4 - EPS) {
                const sxs = dir === 'up' ? sx + .6 * sp : sx - .6 * sp; const yStart = dir === 'up' ? yMax : yMin; let yEnd = dir === 'up' ? yMin - 3.4 * sp : yMax + 3.4 * sp;
                if (dir === 'up' && yEnd > staffTop + sp) yEnd = staffTop + sp; if (dir === 'down' && yEnd < staffBot - sp) yEnd = staffBot - sp;
                e.stem = { x: sxs, y0: yStart, y1: yEnd, dir };
              }
              e.g = inner; e.ci = ci;
              // beams
              const beamable = e.d <= 0.5 + EPS && !e.rest;
              const gi = Math.floor((e.t + 1e-6) / inf.pulse);
              if (beamable) { if (grp && grp.gi === gi && grp.v === v && grp.dir === dir && Math.abs(grp.endT - e.t) < EPS) { grp.list.push(e); grp.endT = e.t + e.d; } else { grp = { gi, v, dir, list: [e], endT: e.t + e.d }; beams.push(grp); } } else grp = null;
            });
            // desenha vozes: cabeças + hastes
            const beamed = new Set();
            beams.forEach(b => { if (b.list.length >= 2) b.list.forEach(e => beamed.add(e)); });
            beams.filter(b => b.list.length >= 2).forEach(b => {
              const f = b.list[0], l = b.list[b.list.length - 1]; const dirB = b.dir;
              let slope = (l.stem.y1 - f.stem.y1) / Math.max(1, (l.stem.x - f.stem.x)); slope = Math.max(-.2, Math.min(.2, slope));
              const mid = b.list.reduce((a, e) => a + e.stem.y1, 0) / b.list.length; const xm = (f.stem.x + l.stem.x) / 2;
              let off = 0; b.list.forEach(e => { const y = mid + slope * (e.stem.x - xm); const need = dirB === 'up' ? (e.stem.y0 - 2.6 * sp) - y : y - (e.stem.y0 + 2.6 * sp); if (need < off) off = need; });
              b.list.forEach(e => { e.stem.y1 = mid + slope * (e.stem.x - xm) + (dirB === 'up' ? off : -off) * (off < 0 ? 1 : 0); e.beamed = true; });
              // linhas de barra
              const mk = (a, z, lvl) => { const sgn = dirB === 'up' ? 1 : -1; const dy = lvl * 0.75 * sp * sgn; return `<path d="M${f1(a.stem.x)} ${f1(a.stem.y1 + dy)}L${f1(z.stem.x)} ${f1(z.stem.y1 + dy)}" stroke="currentColor" stroke-width="${f1(.5 * sp)}" fill="none"/>`; };
              g.push(`<g class="n c${ms.mi}_${f.ci}">${mk(f, l, 0)}</g>`);
              // semicolcheias
              for (let i = 0; i < b.list.length; i++) { const e = b.list[i]; if (e.d <= .25 + EPS) { const nx = b.list[i + 1]; const pv = b.list[i - 1]; if (nx && nx.d <= .25 + EPS) g.push(mk(e, nx, 1)); else if (pv && pv.d <= .25 + EPS) { } else { const tgt = nx || pv; if (tgt) { const a = { stem: { x: e.stem.x, y1: e.stem.y1 } }, z = { stem: { x: e.stem.x + (nx ? 1 : -1) * 1.1 * sp, y1: e.stem.y1 } }; g.push(mk(a, z, 1)); } } } }
            });
            evs.forEach(e => {
              if (e.rest) return;
              g.push(`<g class="n c${ms.mi}_${e.ci}" data-t="${f1(m.start + e.t)}">${e.g.join('')}`);
              if (e.stem) {
                g.push(`<line x1="${f1(e.stem.x)}" x2="${f1(e.stem.x)}" y1="${f1(e.stem.y0)}" y2="${f1(e.stem.y1)}" stroke="currentColor" stroke-width="${f1(.14 * sp)}"/>`);
                if (e.d <= .5 + EPS && !e.beamed) { const s = e.stem.dir === 'up' ? 1 : -1; g.push(`<path d="M${f1(e.stem.x)} ${f1(e.stem.y1)}c${f1(.2 * sp)} ${f1(s * .9 * sp)} ${f1(1.4 * sp)} ${f1(s * 1.2 * sp)} ${f1(.9 * sp)} ${f1(s * 2.6 * sp)}" fill="none" stroke="currentColor" stroke-width="${f1(.3 * sp)}"/>`); }
              }
              g.push('</g>');
              // ligadura
              if (e.tieNext) { const nxE = evs[evs.indexOf(e) + 1]; const nxX = nxE && !nxE.rest ? colX[ms.idxOf(nxE.t)] : mEnd - .5 * sp; const hy = e.heads.map(h => staffY(h.dia)); const yy = e.dir === 'up' ? Math.max(...hy) + .7 * sp : Math.min(...hy) - .7 * sp; const bend = e.dir === 'up' ? 1.1 * sp : -1.1 * sp; g.push(`<path d="M${f1(e.x + .5 * sp)} ${f1(yy)}Q${f1((e.x + nxX) / 2)} ${f1(yy + bend)} ${f1(nxX - .3 * sp)} ${f1(yy)}" fill="none" stroke="currentColor" stroke-width="${f1(.17 * sp)}"/>`); }
            });
          }
        }
        // letra
        if (L.lyrOn) L.verses.forEach((vn, vi) => ms.voices[1].forEach(e => {
          const get = n => (n.lyrs ? n.lyrs[vn] : (vn === '1' ? n.lyr : null));
          if (e.rest || e.tiePrev && !get(e.items[0].n)) return; const ly = e.items.map(i => get(i.n)).find(Boolean); if (!ly) return;
          g.push(`<text x="${f1(X(e.t))}" y="${f1(lyrYy + vi * VG)}" font-size="${f1(1.7 * sp)}" font-family="Georgia,serif" text-anchor="middle" class="lyr">${esc(ly.text)}${ly.syl === 'begin' || ly.syl === 'middle' ? '-' : ''}</text>`);
        }));
        // tablatura
        ms.tab.forEach(n => {
          const ti = ms.idxOf(n.t - m.start); const x = colX[ti]; const yy = tabTop + n.s * tabGap; const txt = String(n.f);
          g.push(`<g class="n c${ms.mi}_${ti}"><rect x="${f1(x - (txt.length > 1 ? .85 : .5) * sp)}" y="${f1(yy - .62 * tabGap)}" width="${f1((txt.length > 1 ? 1.7 : 1) * sp)}" height="${f1(1.24 * tabGap)}" class="tabbg"/><text x="${f1(x)}" y="${f1(yy + .38 * tabGap)}" font-size="${f1(1.2 * sp * 1.05)}" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" class="tabn">${txt}</text></g>`);
        });
        // ritmo sob a tablatura
        if (tabOnly) {
          const inf = DH.mxl.meterInfo(m.beatsEff, m.beatTypeEff); const cs = ms.cols;
          const evs = cs.map((c, i) => ({ t: c.t, d: Math.min(((i + 1 < cs.length) ? cs[i + 1].t : ms.len) - c.t, 4), x: colX[i], i }));
          let grp = null; const groups = [];
          evs.forEach(e => { const dd = decompose(e.d)[0]; e.dd = dd; if (dd <= .5 + EPS) { const gi = Math.floor((e.t + 1e-6) / inf.pulse); if (grp && grp.gi === gi) grp.list.push(e); else { grp = { gi, list: [e] }; groups.push(grp); } } else grp = null; });
          const yTop = tabBot + .9 * sp, yBot = tabBot + 3.6 * sp; const inB = new Set(); groups.filter(gp => gp.list.length >= 2).forEach(gp => gp.list.forEach(e => inB.add(e)));
          evs.forEach(e => { g.push(`<g class="n c${ms.mi}_${e.i}"><line x1="${f1(e.x)}" x2="${f1(e.x)}" y1="${f1(yTop)}" y2="${f1(yBot)}" stroke="currentColor" stroke-width="${f1(.12 * sp)}"/>${e.dd >= 2 ? `<circle cx="${f1(e.x)}" cy="${f1(yTop - .1 * sp)}" r="${f1(.28 * sp)}" fill="var(--paper)" stroke="currentColor" stroke-width="${f1(.12 * sp)}"/>` : ''}${e.dd <= .5 + EPS && !inB.has(e) ? `<path d="M${f1(e.x)} ${f1(yBot)}l${f1(.9 * sp)} ${f1(-1.1 * sp)}" stroke="currentColor" stroke-width="${f1(.25 * sp)}"/>` : ''}</g>`); });
          groups.filter(gp => gp.list.length >= 2).forEach(gp => { const a = gp.list[0], z = gp.list[gp.list.length - 1]; g.push(`<path d="M${f1(a.x)} ${f1(yBot)}H${f1(z.x)}" stroke="currentColor" stroke-width="${f1(.4 * sp)}"/>`); });
        }
        cx = mEnd;
      });
      sysMap.push({ top: staffTop - 4.6 * sp, bottom: sysBottom, y: staffTop, tabTop, tabBot, xEnd });
      out.push(g.join(''));
      y = sysBottom + 1.6 * sp;
    });
    const H = y + sp;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" class="scoresvg" width="${W}" height="${f1(H)}" viewBox="0 0 ${W} ${f1(H)}"><g id="cursorG"><rect id="cursor" x="0" y="0" width="0" height="0" rx="3"/></g>${out.join('')}</svg>`, cols: colMap, meas: measMap, systems: sysMap, height: H };
  }
  function isDotted(d) { return [3, 1.5, .75, .375, 6].some(x => Math.abs(x - d) < EPS); }

  function render(sc, arr, o) { const L = layout(sc, arr, o); return draw(sc, arr, L, o); }

  /** Diagrama de acorde (SVG/HTML). */
  function chordDiagram(c) {
    const sh = c.shape; const W = 66, H = 84, x0 = 14, dx = 8.6, y0 = 22, dy = 11.5; const start = sh.start;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="cd" role="img" aria-label="Acorde ${esc(c.name)}"><text x="${W / 2}" y="12" text-anchor="middle" class="cdn">${esc(c.name)}</text>`;
    for (let i = 0; i < 6; i++) s += `<line x1="${x0 + i * dx}" x2="${x0 + i * dx}" y1="${y0}" y2="${y0 + 5 * dy}" class="cl"/>`;
    for (let j = 0; j <= 5; j++) s += `<line x1="${x0}" x2="${x0 + 5 * dx}" y1="${y0 + j * dy}" y2="${y0 + j * dy}" class="${j === 0 && start === 1 ? 'cl nut' : 'cl'}"/>`;
    if (start > 1) s += `<text x="${x0 - 4}" y="${y0 + dy * .75}" text-anchor="end" class="cdf">${start}ª</text>`;
    if (sh.barre) { const bf = sh.barre.fret - start + 1; if (bf >= 1 && bf <= 5) s += `<rect x="${x0 + sh.barre.from * dx - 3.5}" y="${y0 + (bf - .5) * dy - 3.5}" width="${(sh.barre.to - sh.barre.from) * dx + 7}" height="7" rx="3.5" class="cdot"/>`; }
    sh.frets.forEach((f, i) => {
      const x = x0 + i * dx;
      if (f < 0) s += `<text x="${x}" y="${y0 - 5}" text-anchor="middle" class="cdx">×</text>`;
      else if (f === 0) s += `<circle cx="${x}" cy="${y0 - 7}" r="2.6" class="cdo"/>`;
      else { const r = f - start + 1; if (r >= 1 && r <= 5) s += `<circle cx="${x}" cy="${y0 + (r - .5) * dy}" r="4" class="cdot"/>` + (sh.fingers[i] ? `<text x="${x}" y="${y0 + (r - .5) * dy + 2.8}" text-anchor="middle" class="cdt">${sh.fingers[i]}</text>` : ''); }
    });
    s += '</svg>';
    return s;
  }

  DH.render = { render, layout, chordDiagram, spell };
})(typeof window !== 'undefined' ? window : globalThis);
