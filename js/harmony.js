/* DigitaHinos — análise harmônica (acordes simples e bons a partir das 4 vozes) e escolha de capotraste */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const EPS = 1e-6;
  const TYPES = {
    maj: { iv: [0, 4, 7], cx: 0, suf: '' },
    min: { iv: [0, 3, 7], cx: 0.05, suf: 'm' },
    '7': { iv: [0, 4, 7, 10], cx: 0.2, suf: '7' },
    min7: { iv: [0, 3, 7, 10], cx: 0.5, suf: 'm7' },
    maj7: { iv: [0, 4, 7, 11], cx: 0.55, suf: 'maj7' },
    dim: { iv: [0, 3, 6], cx: 0.9, suf: 'dim' }
  };
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const mod = (a, n) => ((a % n) + n) % n;
  const normFifths = f => { f = mod(f + 6, 12) - 6; return f; };
  function useFlats(fifths) { return fifths < 0 || fifths === 0; }
  function pcName(pc, fifths) {
    const f = normFifths(fifths);
    if (f === 0) return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc];
    return (f < 0 ? FLAT : SHARP)[pc];
  }
  function chordName(root, type, fifths) { return pcName(root, fifths) + TYPES[type].suf; }

  /** Facilidade (custo) de um acorde em formato aberto — 0 = muito fácil. */
  const EASY = {
    maj: { 0: .15, 2: .15, 4: .3, 7: .15, 9: .2, 5: 1.1, 11: 1.9, 10: 2, 1: 2.5, 3: 2.5, 6: 2.5, 8: 2.5 },
    min: { 9: .15, 4: .15, 2: .3, 11: 1.4, 6: 1.6, 1: 1.8, 7: 1.6, 0: 1.8, 5: 2, 8: 2.2, 3: 2.4, 10: 2.2 },
    '7': { 4: .3, 9: .3, 2: .3, 7: .3, 0: .6, 11: .5, 5: 1.5, 10: 2, 1: 2.4, 3: 2.4, 6: 2.4, 8: 2.4 },
    min7: { 9: .3, 4: .3, 2: .5, 11: 1.5 },
    maj7: { 0: .4, 5: .8, 7: .5, 9: .6, 2: .5, 4: .8 },
    dim: {}
  };
  function ease(root, type) { const t = EASY[type] || {}; return t[root] !== undefined ? t[root] : 2.4; }

  function keyInfo(sc, lines) {
    const fifths = sc.fifths; const maj = mod(fifths * 7, 12); const min = mod(maj + 9, 12);
    const B = lines.B; const last = B.length ? mod(B[B.length - 1].p, 12) : maj;
    let mode = 'major';
    if (last === min) mode = 'minor'; else if (last === maj) mode = 'major';
    else {
      let lt = 0; sc.parts.forEach(p => p.notes.forEach(n => { if (mod(n.p, 12) === mod(min + 11, 12)) lt += n.d; }));
      let tot = 0; sc.parts.forEach(p => p.notes.forEach(n => tot += n.d));
      if (lt / tot > .02) mode = 'minor';
    }
    return { fifths, tonic: mode === 'major' ? maj : min, mode, majTonic: maj };
  }

  /** Segmenta os compassos em pulsos. */
  function segments(sc) {
    const segs = []; const mi = DH.mxl.meterInfo;
    sc.measures.forEach((M, i) => {
      const info = mi(M.beatsEff, M.beatTypeEff);
      const unit = info.bar > 4.01 && info.pulse === 1 && info.group === 3 ? 1 : (info.pulse < 1.2 ? 1 : info.pulse);
      let o = 0;
      while (o < M.len - EPS) {
        const len = Math.min(unit, M.len - o);
        const strong = Math.abs(o % info.group) < EPS || Math.abs((o % info.group) - info.group) < EPS;
        segs.push({ t: M.start + o, d: len, m: i, off: o, strong, bar0: o < EPS });
        o += unit;
      }
    });
    return segs;
  }

  function analyze(sc, lines) {
    const key = keyInfo(sc, lines);
    const segs = segments(sc);
    const diat = new Set(); const sc7 = key.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10, 11];
    sc7.forEach(i => diat.add(mod(key.tonic + i, 12)));
    const notes = [];
    const wv = { S: 1.25, A: 1, T: 1, B: 1.6 };
    for (const v of ['S', 'A', 'T', 'B']) for (const n of lines[v]) notes.push({ t: n.t, e: n.t + n.d, p: n.p, w: wv[v], v });
    // candidatos por segmento
    const cands = segs.map(sg => {
      const w = new Float64Array(12); let tot = 0; let bassPc = -1, bassW = 0;
      for (const n of notes) {
        const ov = Math.min(n.e, sg.t + sg.d) - Math.max(n.t, sg.t);
        if (ov <= EPS) continue;
        let x = ov * n.w; if (n.t >= sg.t - EPS) x *= 1.35; // ataque dentro do segmento pesa mais
        const pc = mod(n.p, 12); w[pc] += x; tot += x;
        if (n.v === 'B' && x > bassW) { bassW = x; bassPc = pc; }
      }
      if (tot < EPS) return [{ root: -1, type: 'maj', sc: 0, rest: true }];
      const list = [];
      for (let r = 0; r < 12; r++) for (const type in TYPES) {
        const T = TYPES[type]; const set = new Set(T.iv.map(i => mod(r + i, 12)));
        let s = 0;
        for (let pc = 0; pc < 12; pc++) {
          if (w[pc] === 0) continue;
          if (set.has(pc)) s += w[pc] * (pc === r ? 1.15 : 1); else s -= w[pc] * 0.95;
        }
        if (T.iv.length === 4) { const sev = mod(r + T.iv[3], 12); if (w[sev] === 0) s -= tot * 0.25; }
        if (type === 'dim' && w[r] === 0) s -= tot * .1;
        s /= tot;
        if (bassPc >= 0) { if (bassPc === r) s += 0.45; else if (set.has(bassPc)) s += 0.12; else s -= 0.3; }
        list.push({ root: r, type, sc: s - T.cx * 0.35 });
      }
      list.sort((a, b) => b.sc - a.sc); return list.slice(0, 7);
    });
    // Viterbi
    const n = segs.length; const best = []; const back = [];
    for (let i = 0; i < n; i++) {
      const cur = cands[i]; best.push(new Array(cur.length).fill(-1e9)); back.push(new Array(cur.length).fill(-1));
      for (let c = 0; c < cur.length; c++) {
        const cc = cur[c]; let emit = cc.sc * 1.0;
        if (cc.root >= 0) {
          const dia = diat.has(cc.root) || (cc.type === '7' && diat.has(mod(cc.root + 5, 12))) ;
          if (!dia) emit -= 0.75;
          if (cc.type === '7' && !(diat.has(mod(cc.root + 5, 12)))) emit -= 0.5;
          emit -= TYPES[cc.type].cx * 0.2;
        }
        if (i === 0) { best[i][c] = emit; continue; }
        const sg = segs[i];
        for (let p = 0; p < cands[i - 1].length; p++) {
          const pp = cands[i - 1][p]; if (best[i - 1][p] < -1e8) continue;
          let tr = 0;
          const same = pp.root === cc.root && pp.type === cc.type;
          if (!same) {
            tr += 0.6; if (sg.bar0) tr -= 0.2; else if (!sg.strong) tr += 0.4; else tr += 0.05;
            if (pp.root >= 0 && cc.root >= 0) { const iv = mod(cc.root - pp.root, 12); if (iv === 5) tr -= 0.12; else if (iv === 7) tr -= 0.02; }
          }
          const v = best[i - 1][p] + emit - tr;
          if (v > best[i][c]) { best[i][c] = v; back[i][c] = p; }
        }
      }
    }
    // caminho
    let bi = 0; for (let c = 1; c < best[n - 1].length; c++) if (best[n - 1][c] > best[n - 1][bi]) bi = c;
    const path = new Array(n);
    for (let i = n - 1; i >= 0; i--) { path[i] = cands[i][bi]; bi = back[i][bi]; if (bi < 0 && i > 0) bi = 0; }
    // compõe os blocos de acordes
    const chords = [];
    for (let i = 0; i < n; i++) {
      let c = path[i]; if (c.rest) c = chords.length ? chords[chords.length - 1] : { root: key.tonic, type: key.mode === 'major' ? 'maj' : 'min' };
      const last = chords[chords.length - 1];
      if (last && last.root === c.root && last.type === c.type && Math.abs(last.t + last.d - segs[i].t) < EPS && last.m === segs[i].m) last.d += segs[i].d;
      else chords.push({ t: segs[i].t, d: segs[i].d, root: c.root, type: c.type, m: segs[i].m });
    }
    // dim → simplifica para dominante com sétima (mais simples/idiomático no violão)
    chords.forEach(c => { if (c.type === 'dim') { c.root = mod(c.root - 4, 12); c.type = '7'; } });
    return { key, chords, segs };
  }

  /** Escolhe capotraste (0–7) para facilitar os acordes (afinação igual, tom soando igual). */
  function chooseCapo(chords, minMelody, maxMelody) {
    const res = [];
    for (let c = 0; c <= 7; c++) {
      let cost = 0;
      for (const ch of chords) cost += ease(mod(ch.root - c, 12), ch.type);
      cost = cost / Math.max(1, chords.length);
      let pen = c ? 0.25 + 0.04 * c : 0;
      if (minMelody - c < 40) pen += 5; // sobe nota pro grave fora do violão
      res.push({ capo: c, cost, total: cost + pen });
    }
    res.sort((a, b) => a.total - b.total);
    const zero = res.find(r => r.capo === 0);
    const best = res[0];
    if (best.capo !== 0 && best.total > zero.total - 0.12) return { capo: 0, table: res };
    return { capo: best.capo, table: res };
  }

  DH.harmony = { TYPES, pcName, chordName, normFifths, analyze, chooseCapo, ease, mod };
})(typeof window !== 'undefined' ? window : globalThis);
