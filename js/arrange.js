/* DigitaHinos — arranjos para violão: 1 voz (S/A/T/B), 4 vozes adaptadas, fingerstyle simples e completo */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const EPS = 1e-6;
  const mod = (a, n) => ((a % n) + n) % n;

  /** Ajusta a faixa de uma linha ao alcance do violão (oitavas), preservando o contorno. */
  function fitLine(line, lo, hi) {
    const viol = sh => line.reduce((a, n) => a + ((n.p + sh < lo || n.p + sh > hi) ? 1 : 0), 0);
    let best = 0, bv = viol(0);
    for (const sh of [12, -12, 24, -24]) { const v = viol(sh); if (v < bv) { bv = v; best = sh; } }
    return line.map(n => {
      let p = n.p + best; let ad = false;
      while (p < lo) { p += 12; ad = true; } while (p > hi) { p -= 12; ad = true; }
      return Object.assign({}, n, { p, orig: n.p, adapted: ad || undefined });
    });
  }

  function patternFor(info, mode) {
    const bar = info.bar, pulse = info.pulse, g = info.group; const P = [];
    if (mode === 'simple') {
      const step = pulse === 1.5 ? 1.5 : g;
      for (let o = 0; o < bar - EPS; o += step) P.push({ o, k: 'B' });
      return P;
    }
    if (pulse === 1.5) { // compostos 6/8, 9/8, 12/8
      const ng = Math.round(bar / 1.5);
      for (let i = 0; i < ng; i++) { const o = i * 1.5; P.push({ o, k: i % 2 ? 'b' : 'B' }, { o: o + .5, k: 'i1' }, { o: o + 1, k: 'i2' }); }
      return P;
    }
    const key = info.beats + '/' + info.type;
    const arr = (list) => list.map(([o, k]) => ({ o, k }));
    if (key === '4/4' || key === '2/2') return arr([[0, 'B'], [.5, 'i1'], [1, 'i2'], [1.5, 'i1'], [2, 'b'], [2.5, 'i1'], [3, 'i2'], [3.5, 'i1']]);
    if (key === '2/4') return arr([[0, 'B'], [.5, 'i1'], [1, 'i2'], [1.5, 'i1']]);
    if (key === '3/4') return arr([[0, 'B'], [1, 'i1'], [1.5, 'i2'], [2, 'i1'], [2.5, 'i2']]);
    if (key === '6/4' || key === '3/2') return arr([[0, 'B'], [1, 'i1'], [2, 'i2'], [3, 'b'], [4, 'i1'], [5, 'i2']]);
    if (key === '9/4') return arr([[0, 'B'], [1, 'i1'], [2, 'i2'], [3, 'b'], [4, 'i1'], [5, 'i2'], [6, 'B'], [7, 'i1'], [8, 'i2']]);
    for (let o = 0; o < bar - EPS; o += 0.5) P.push({ o, k: o === 0 ? 'B' : (Math.abs(o % g) < EPS ? 'b' : (o % 1 === 0 ? 'i2' : 'i1')) });
    return P;
  }

  function build(sc, lines, har, opts) {
    const mode = opts.mode || 'full'; const capo = opts.capo || 0; const tr = opts.transpose || 0;
    const LO = DH.guitar.LOW + capo, HI = 81 + capo; // faixa SONORA
    const tp = n => Object.assign({}, n, { p: n.p + tr }, tr ? { st: undefined, al: undefined } : {});
    const L = {}; for (const v of ['S', 'A', 'T', 'B']) L[v] = lines[v].map(tp);
    const chords = har.chords.map(c => ({ t: c.t, d: c.d, m: c.m, root: mod(c.root + tr, 12), type: c.type }));
    const fifths = DH.harmony.normFifths(sc.fifths + 7 * tr);
    const items = []; let id = 0; const meta = new Map();
    const add = (o) => { o.id = id++; items.push(o); meta.set(o.id, o); return o; };
    const measureOf = t => { const M = sc.measures; let lo = 0, hi = M.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (M[mid].start <= t + EPS) lo = mid; else hi = mid - 1; } return lo; };
    const alts = c => [{ p: -12, cost: c }, { p: 12, cost: c }];
    const mk = (n, role, extra) => Object.assign({ t: n.t, d: n.d, hold: n.d, p: n.p, ring: n.d, role, voice: 1, pri: 0, drop: null, alts: [], orig: n.orig, lyr: n.lyr, fm: n.fm, adapted: n.adapted, rel: true, st: n.st, al: n.al }, extra || {});
    const info = { mode, capo, adapted: 0, dropped: 0, tr };

    if (['S', 'A', 'T', 'B'].includes(mode)) {
      fitLine(L[mode], LO, HI).forEach(n => add(mk(n, 'solo', { voice: 1 })));
    } else if (mode === 'satb') {
      const F = {}; for (const v of ['S', 'A', 'T', 'B']) F[v] = fitLine(L[v], LO, HI);
      F.S.forEach(n => add(mk(n, 'melody', { voice: 1, pri: 0, voiceName: 'S' })));
      F.B.forEach(n => { const o = mk(n, 'bass', { voice: 2, pri: 1, drop: 9, voiceName: 'B' }); o.alts = []; add(o); });
      F.A.forEach(n => add(mk(n, 'inner', { voice: 1, pri: 2, drop: 5, voiceName: 'A' })));
      F.T.forEach(n => add(mk(n, 'inner', { voice: 2, pri: 3, drop: 5, voiceName: 'T' })));
      // alternativas de oitava (somente se necessário): calculadas por nota, dentro da faixa
      items.forEach(o => { if (o.role === 'melody') return; o.alts = [{ p: o.p - 12, cost: 1.4 }, { p: o.p + 12, cost: 1.4 }].filter(a => a.p >= LO && a.p <= HI); });
      items.forEach(o => { o.alts.forEach(a => { a.p = a.p; }); });
    } else {
      const mel = fitLine(L.S, LO, HI);
      mel.forEach(n => add(mk(n, 'melody', { voice: 1, pri: 0 })));
      // melodia: faixa de referência para o acompanhamento
      const melAt = t => { let cur = null; for (const n of mel) { if (n.t <= t + EPS && n.t + n.d > t + EPS) { cur = n; break; } } if (cur) return cur.p; const nx = mel.find(n => n.t > t); return nx && nx.t - t < 1.01 ? nx.p : null; };
      const spans = chords.slice();
      const chordAt = t => { let lo = 0, hi = spans.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (spans[mid].t <= t + EPS) lo = mid; else hi = mid - 1; } return spans[lo]; };
      // registro do baixo (domínio sonoro: soma o capo)
      const rootP = r => 40 + mod(r - capo - 40, 12) + capo;      // E2..Eb3 (+capo)
      const fifthP = (r) => { const rp = rootP(r); let q = rp - 5; if (q < LO) q = rp + 7; return q; };
      // acompanhamento interno por trecho de acorde
      let prevPair = null;
      spans.forEach(sp => {
        const mpAll = mel.filter(n => n.t < sp.t + sp.d - EPS && n.t + n.d > sp.t + EPS).map(n => n.p);
        const ceil = (mpAll.length ? Math.min(...mpAll) : 76 + capo) - 3;
        const T = DH.harmony.TYPES[sp.type]; const pcs = T.iv.map(i => mod(sp.root + i, 12));
        const bp = rootP(sp.root); const lo = bp + 5; const hi = Math.min(ceil, 70 + capo);
        const pool = []; for (let p = lo; p <= hi; p++) if (pcs.includes(mod(p, 12))) pool.push(p);
        const third = pcs[1], fifth = pcs[2], sev = pcs[3];
        const sc2 = (a, b) => {
          const have = new Set([mod(bp, 12), mod(a, 12), b !== null ? mod(b, 12) : -1, ...mpAll.map(x => mod(x, 12))]);
          let s = Math.abs(a - (55 + capo)) * .08 + (b !== null ? Math.abs(b - (62 + capo)) * .08 : .6);
          if (have.has(third)) s -= 1.5; if (have.has(fifth)) s -= .7; if (sev !== undefined && have.has(sev)) s -= .6;
          if (a - bp < 7) s += .3; if (b !== null && b - a > 12) s += .5;
          if (prevPair) s += (Math.abs(a - prevPair[0]) + (b !== null && prevPair[1] !== null ? Math.abs(b - prevPair[1]) : 0)) * .03;
          return s;
        };
        let best = null;
        for (let i = 0; i < pool.length; i++) { for (let j = i + 1; j < pool.length; j++) { if (pool[j] - pool[i] < 3) continue; const s = sc2(pool[i], pool[j]); if (!best || s < best.s) best = { s, i1: pool[i], i2: pool[j] }; } }
        if (!best) for (const a of pool) { const s = sc2(a, null); if (!best || s < best.s) best = { s, i1: a, i2: null }; }
        sp.inner = best ? [best.i1, best.i2] : [null, null]; prevPair = sp.inner;
        sp.bass = bp; sp.alt = fifthP(sp.root);
      });
      // padrão de ataques por compasso
      const att = []; // {t,k}
      sc.measures.forEach((M, mi) => {
        const inf = DH.mxl.meterInfo(M.beatsEff, M.beatTypeEff);
        const P = patternFor(inf, mode);
        const shift = (mi === 0 && M.len < inf.bar - EPS) ? inf.bar - M.len : 0;
        for (const x of P) { const o = x.o - shift; if (o < -EPS || o >= M.len - EPS) continue; att.push({ t: M.start + Math.max(0, o), k: x.k }); }
      });
      // garante baixo no início de cada acorde
      spans.forEach(sp => { if (!att.some(a => Math.abs(a.t - sp.t) < 0.26 && (a.k === 'B' || a.k === 'b'))) att.push({ t: sp.t, k: 'B' }); else { /* ajusta ataque mais próximo para tônica */ const a = att.find(a => Math.abs(a.t - sp.t) < EPS && (a.k === 'b')); if (a) a.k = 'B'; } });
      att.sort((a, b) => a.t - b.t);
      const bassAtt = att.filter(a => a.k === 'B' || a.k === 'b'); const inAtt = att.filter(a => a.k === 'i1' || a.k === 'i2');
      const endOfSpan = sp => sp.t + sp.d;
      bassAtt.forEach((a, i) => {
        const sp = chordAt(a.t); const nxt = bassAtt[i + 1]; const iv = nxt ? nxt.t - a.t : Math.min(2, endOfSpan(sp) - a.t);
        let p = a.k === 'b' && sp.t < a.t - EPS ? sp.alt : sp.bass; if (a.k === 'b' && Math.abs(sp.t - a.t) < EPS) p = sp.bass;
        const e = add({ t: a.t, d: Math.min(iv, 4), hold: Math.min(iv, 2), ring: Math.min(iv * 1.0, 3), p, role: 'bass', voice: 2, pri: 1, drop: 8, alts: alts(1.6).map(x => ({ p: p + x.p, cost: x.cost })).filter(x => x.p >= LO && x.p <= HI), rel: false });
      });
      if (mode === 'full') {
        inAtt.forEach((a, i) => {
          const sp = chordAt(a.t); const p = sp.inner[a.k === 'i1' ? 0 : 1]; if (p === null || p === undefined) return;
          // não colide com a melodia: se a nota da melodia agora for menor que p+3, descarta
          const mp = melAt(a.t); if (mp !== null && p > mp - 2) return;
          const nxt = inAtt[i + 1]; const iv = nxt ? Math.min(nxt.t - a.t, 1.5) : 0.5; const rem = Math.max(.25, endOfSpan(sp) - a.t);
          add({ t: a.t, d: Math.min(iv, rem), hold: Math.min(iv, rem), ring: Math.min(2, rem), p, role: 'inner', voice: 2, pri: 2, drop: 5, alts: [], rel: false });
        });
      }
    }
    // --- digitação ---
    const res = DH.fingering.solve(items, { capo, roleWeight: (mode === 'S' || mode === 'A' || mode === 'T' || mode === 'B') ? 0 : 1 });
    const notes = [];
    items.forEach(o => {
      const r = res.get(o.id); if (!r || r.dropped) { if (r && r.dropped) info.dropped++; return; }
      const sp = r.p; if (sp !== o.p) info.adapted++;
      notes.push({ id: o.id, t: o.t, d: o.d, hold: o.hold, ring: o.ring, p: sp, sp: sp - capo, role: o.role, voice: o.voice, s: r.s, f: r.f, fin: r.fin, pos: r.pos, m: measureOf(o.t), lyr: o.lyr, fm: o.fm, rel: o.rel, adapted: o.adapted || r.adapted, voiceName: o.voiceName, st: (o.st && r.p === o.p) ? o.st : undefined, al: (o.st && r.p === o.p) ? o.al : undefined });
    });
    notes.sort((a, b) => a.t - b.t || b.p - a.p);
    info.adapted += notes.filter(n => n.adapted).length * 0; // (contagem via notas marcadas)
    info.adaptedNotes = notes.filter(n => n.adapted).length;
    // acordes com formas (domínio do violão com capo)
    const spans = chords.map(c => { const sr = mod(c.root - capo, 12); return Object.assign({}, c, { name: DH.harmony.chordName(sr, c.type, DH.harmony.normFifths(fifths - 7 * capo)), sound: DH.harmony.chordName(c.root, c.type, fifths), shapeRoot: sr, shape: DH.guitar.chordShape(sr, c.type) }); });
    const used = new Map(); spans.forEach(s => { const k = s.shapeRoot + '|' + s.type; if (!used.has(k)) used.set(k, { name: s.name, sound: s.sound, shape: s.shape, count: 0 }); used.get(k).count++; });
    return { notes, chords: spans, shapes: [...used.values()], capo, fifths, info, stats: res.stats };
  }

  DH.arrange = { build, fitLine, patternFor };
})(typeof window !== 'undefined' ? window : globalThis);
