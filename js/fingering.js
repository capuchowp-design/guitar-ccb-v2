/* DigitaHinos — digitação do violão: escolhe corda/casa/dedo respeitando o alcance da mão humana
 * - no máximo 4 dedos; abertura máxima de 4 casas entre o 1º e o 4º dedo (esticada) — normal: 3
 * - pestana só com o indicador, sem corda solta no meio
 * - notas sustentadas (seguradas) continuam ocupando os dedos
 * - busca em feixe (beam search) minimizando o movimento da mão
 */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const EPS = 1e-4;
  const BEAM = 14, MAXC = 70;

  function neededFingers(pressed, openStrs, pos) {
    // pressed: [{s,f}] (f>0). Retorna nº de dedos; Infinity se impossível
    if (!pressed.length) return 0;
    const by = new Map(); let minF = 99;
    for (const x of pressed) { by.set(x.f, (by.get(x.f) || []).concat(x)); if (x.f < minF) minF = x.f; }
    let total = 0;
    for (const [f, arr] of by) {
      if (arr.length >= 2 && f === minF && pos === minF) {
        const lo = Math.min(...arr.map(a => a.s)), hi = Math.max(...arr.map(a => a.s));
        const blocked = openStrs.some(s => s > lo && s < hi);
        total += blocked ? arr.length : 1;
      } else total += arr.length;
    }
    return total;
  }
  /** Escolhe a posição da mão (casa do indicador) mais próxima da anterior. */
  function choosePos(pressed, openStrs, prevPos) {
    if (!pressed.length) return { pos: prevPos, stretch: 0 };
    let minF = 99, maxF = 0; for (const x of pressed) { if (x.f < minF) minF = x.f; if (x.f > maxF) maxF = x.f; }
    const span = maxF - minF;
    if (span > 4) return null;
    if (span === 4) { if (minF > 9) return null; return neededFingers(pressed, openStrs, minF) <= 4 ? { pos: minF, stretch: 1 } : null; }
    const lo = Math.max(1, maxF - 3), hi = minF; const cands = [];
    for (let p = lo; p <= hi; p++) cands.push(p);
    cands.sort((a, b) => Math.abs(a - prevPos) - Math.abs(b - prevPos) || b - a);
    for (const p of cands) if (neededFingers(pressed, openStrs, p) <= 4) return { pos: p, stretch: 0 };
    return null;
  }

  function roleCost(role, s) {
    if (role === 'melody') return s <= 2 ? 0 : (s === 3 ? 0.7 : 1.4);
    if (role === 'bass') return s >= 3 ? 0 : 1.2;
    if (role === 'inner') return (s >= 1 && s <= 4) ? 0 : 0.5;
    return 0;
  }

  function genCandidates(sl, o) {
    // agrupa notas com o mesmo tom
    const groups = [];
    for (const it of sl.items) {
      const g = groups.find(x => x.p === it.p);
      if (g) { g.members.push(it); if (it.pri < g.pri) { g.pri = it.pri; g.role = it.role; g.drop = it.drop; g.alts = it.alts; } }
      else groups.push({ p: it.p, members: [it], pri: it.pri, role: it.role, drop: it.drop, alts: it.alts || [] });
    }
    groups.sort((a, b) => b.p - a.p);
    groups.forEach(g => {
      g.opts = [];
      const pitches = [{ p: g.p, cost: 0 }].concat(g.alts || []);
      for (const pc of pitches) for (const ps of DH.guitar.positions(pc.p - (o.capo || 0))) {
        let c = pc.cost + roleCost(g.role, ps.s) * (o.roleWeight === undefined ? 1 : o.roleWeight);
        c += ps.f === 0 ? -0.45 : 0.06 * ps.f + (ps.f > 7 ? 0.08 * (ps.f - 7) : 0) + (ps.f > 12 ? 0.35 * (ps.f - 12) : 0);
        g.opts.push({ p: pc.p, s: ps.s, f: ps.f, c });
      }
      if (g.drop !== null && g.drop !== undefined) g.opts.push({ p: g.p, s: -1, f: -1, c: g.drop, drop: true });
    });
    const out = []; const chosen = [];
    (function dfs(k, mask, cost, minF, maxF) {
      if (k === groups.length) {
        if (chosen.every(c => c.drop) && !groups.every(g => g.drop !== null && g.drop !== undefined)) return;
        const pressed = chosen.filter(c => !c.drop && c.f > 0).map(c => ({ s: c.s, f: c.f }));
        const openS = chosen.filter(c => !c.drop && c.f === 0).map(c => c.s);
        const cp = choosePos(pressed, openS, pressed.length ? Math.min(...pressed.map(x => x.f)) : 1); if (!cp) return;
        out.push({ ch: chosen.map(c => c), cost: cost + cp.stretch * 1.8, minF, maxF, pressed, openS });
        return;
      }
      for (const op of groups[k].opts) {
        if (op.drop) { chosen.push({ g: k, p: op.p, s: -1, f: -1, drop: true }); dfs(k + 1, mask, cost + op.c, minF, maxF); chosen.pop(); continue; }
        if (mask & (1 << op.s)) continue;
        let ok = true;
        for (const c of chosen) { if (c.drop) continue; if (op.p > c.p ? !(op.s < c.s) : (op.p < c.p ? !(op.s > c.s) : true)) { ok = false; break; } }
        if (!ok) continue;
        let mn = minF, mx = maxF;
        if (op.f > 0) { mn = Math.min(mn, op.f); mx = Math.max(mx, op.f); if (mx - mn > 4) continue; }
        chosen.push({ g: k, p: op.p, s: op.s, f: op.f }); dfs(k + 1, mask | (1 << op.s), cost + op.c, mn, mx); chosen.pop();
      }
    })(0, 0, 0, 99, 0);
    out.sort((a, b) => a.cost - b.cost);
    sl.groups = groups;
    return out.slice(0, MAXC);
  }

  function solve(items, o) {
    o = o || {};
    items = items.slice().sort((a, b) => a.t - b.t || a.pri - b.pri);
    const slices = [];
    for (const it of items) { const l = slices[slices.length - 1]; if (l && Math.abs(l.t - it.t) < EPS) l.items.push(it); else slices.push({ t: it.t, items: [it] }); }
    slices.forEach(sl => { sl.cands = genCandidates(sl, o); });
    let beam = [{ cost: 0, pos: 1, held: [], lastS: 2, prev: null, cand: null }];
    const allowed = (state, c, t, ignoreHeld) => {
      const newS = new Set(c.ch.filter(x => !x.drop).map(x => x.s));
      const alive = state.held.filter(h => h.end > t + EPS);
      const held = ignoreHeld ? [] : alive.filter(h => !newS.has(h.s));
      const pressed = held.filter(h => h.f > 0).map(h => ({ s: h.s, f: h.f })).concat(c.pressed);
      const cp = choosePos(pressed, c.openS, state.pos);
      if (!cp) return null;
      let pen = 0;
      for (const x of c.ch) { if (x.drop) continue; for (const h of alive) { if (h.s === x.s) pen += h.pri === 0 ? 9 : 1.6; else if ((x.p > h.p && x.s > h.s) || (x.p < h.p && x.s < h.s)) pen += 0.8; } }
      return { cp, held, pen };
    };
    for (let si = 0; si < slices.length; si++) {
      const sl = slices[si]; const t = sl.t; let next = [];
      const run = ignoreHeld => {
        for (const st of beam) for (const c of sl.cands) {
          const a = allowed(st, c, t, ignoreHeld); if (!a) continue;
          let cost = st.cost + c.cost + a.pen + (ignoreHeld ? 6 : 0);
          const dp = Math.abs(a.cp.pos - st.pos); cost += 0.5 * dp + (dp >= 4 ? 0.8 : 0) + (dp >= 7 ? 1.2 : 0);
          // continuidade da corda da voz principal
          const top = c.ch.find(x => !x.drop); let lastS = st.lastS;
          if (top) { cost += 0.1 * Math.abs(top.s - st.lastS); lastS = top.s; }
          const nh = a.held.slice();
          c.ch.forEach(x => { if (x.drop) return; const mem = sl.groups[x.g]; const hold = Math.max(...mem.members.map(m => m.hold || 0)); if (hold > 0.2) nh.push({ s: x.s, f: x.f, p: x.p, pri: mem.pri, end: t + hold }); });
          next.push({ cost, pos: a.cp.pos, held: nh, lastS, prev: st, cand: c });
        }
      };
      run(false); if (!next.length) run(true);
      if (!next.length) throw new Error('digitação impossível');
      next.sort((a, b) => a.cost - b.cost);
      const seen = new Set(); beam = [];
      for (const n of next) { const key = n.pos + '|' + n.held.filter(h => h.end > t + EPS).map(h => h.s + ':' + h.f).sort().join(','); if (seen.has(key)) continue; seen.add(key); beam.push(n); if (beam.length >= BEAM) break; }
    }
    // reconstrução
    let st = beam[0]; const path = [];
    while (st && st.cand) { path.push(st); st = st.prev; } path.reverse();
    const res = new Map(); let held = []; let adapted = 0, dropped = 0;
    path.forEach((stt, i) => {
      const sl = slices[i]; const t = sl.t; const c = stt.cand;
      const newS = new Set(c.ch.filter(x => !x.drop).map(x => x.s));
      held = held.filter(h => h.end > t + EPS && !newS.has(h.s));
      const pos = stt.pos; const usedF = new Set(held.filter(h => h.f > 0).map(h => h.fin));
      const fretted = c.ch.filter(x => !x.drop && x.f > 0).sort((a, b) => a.f - b.f || b.s - a.s);
      let minF = 99, maxF = 0; held.filter(h => h.f > 0).concat(fretted).forEach(x => { if (x.f < minF) minF = x.f; if (x.f > maxF) maxF = x.f; });
      const fingOf = new Map();
      for (const x of fretted) {
        let fin;
        if (maxF - minF === 4) fin = x.f === minF ? 1 : (x.f === maxF ? 4 : (x.f === minF + 1 ? 2 : 3));
        else fin = Math.max(1, Math.min(4, x.f - pos + 1));
        // barre (mesma casa do indicador) → dedo 1
        const sameHeld = held.find(h => h.f > 0 && h.f === x.f && h.fin === fin);
        if (usedF.has(fin) && !(fin === 1 && x.f === pos && (sameHeld || fretted.some(y => y !== x && fingOf.get(y) === 1 && y.f === x.f)))) {
          let alt = null; for (let d = 1; d <= 3 && alt === null; d++) for (const cand of [fin + d, fin - d]) if (cand >= 1 && cand <= 4 && !usedF.has(cand)) { alt = cand; break; }
          if (alt !== null) fin = alt;
        }
        usedF.add(fin); fingOf.set(x, fin);
      }
      c.ch.forEach(x => {
        const mem = sl.groups[x.g];
        mem.members.forEach(m => {
          const r = { s: x.s, f: x.f, p: x.p, fin: x.f > 0 ? fingOf.get(x) : 0, pos, dropped: !!x.drop };
          if (x.p !== m.p) { r.adapted = true; adapted++; }
          if (x.drop) dropped++;
          res.set(m.id, r);
        });
        if (!x.drop) { const hold = Math.max(...mem.members.map(m => m.hold || 0)); if (hold > 0.2) held.push({ s: x.s, f: x.f, fin: x.f > 0 ? fingOf.get(x) : 0, end: t + hold }); }
      });
    });
    res.stats = { adapted, dropped, cost: beam[0].cost };
    return res;
  }
  DH.fingering = { solve, choosePos, neededFingers };
})(typeof window !== 'undefined' ? window : globalThis);
