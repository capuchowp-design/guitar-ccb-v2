/* DigitaHinos — MusicXML → modelo de partitura (partes, compassos, repetições, vozes SATB) */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const EPS = 1e-6;

  /** Informações de métrica: comprimento do compasso, pulso, grupo forte (em semínimas). */
  function meterInfo(beats, type) {
    const bar = beats * 4 / type;
    let pulse, group;
    if (type === 8 && beats % 3 === 0) { pulse = 1.5; group = beats === 6 ? 3 : (beats === 9 ? 4.5 : (beats === 12 ? 3 : 1.5)); if (beats === 3) group = 1.5; }
    else if (type === 2) { pulse = 1; group = 2; }
    else if (type === 4) { pulse = 1; group = beats === 4 ? 2 : (beats === 6 ? 3 : (beats === 9 ? 3 : (beats === 12 ? 3 : (beats % 3 === 0 ? 3 : 2)))); if (beats === 3) group = 3; if (beats === 2) group = 2; }
    else { pulse = 4 / type; group = bar; }
    return { bar, pulse, group, beats, type };
  }

  function parseScore(root) {
    if (!root || root.name !== 'score-partwise') throw new Error('Formato não suportado: use MusicXML "partwise" (.mxl, .musicxml ou .xml).');
    const sc = { title: '', composer: '', tempo: 0, measures: [], parts: [], fifths: 0, beats: 4, beatType: 4, totalLen: 0, warnings: [] };
    // título/compositor
    for (const c of root.all('credit')) {
      const ct = c.txt('credit-type'); const w = c.get('credit-words');
      if (w && ct === 'title' && !sc.title) sc.title = w.text.trim();
      if (w && ct === 'composer' && !sc.composer) sc.composer = w.text.trim();
    }
    if (!sc.title) sc.title = (root.path('work/work-title') || root.get('movement-title') || { text: '' }).text.trim();
    if (!sc.composer) { const cr = root.path('identification'); if (cr) { const k = cr.all('creator').find(x => x.attr('type') === 'composer'); if (k) sc.composer = k.text.trim(); } }

    const partEls = root.all('part');
    if (!partEls.length) throw new Error('A partitura não possui partes.');
    let nMeasures = 0; partEls.forEach(p => nMeasures = Math.max(nMeasures, p.all('measure').length));
    const lenByMeasure = new Array(nMeasures).fill(0);
    const meas = new Array(nMeasures).fill(null).map((_, i) => ({ i, number: String(i + 1), start: 0, len: 0, fifths: null, beats: null, beatType: null, repeatFwd: false, repeatBack: false, times: 2, endStart: null, endStop: false, fermata: false, tempo: null, words: [] }));

    partEls.forEach((pe, pi) => {
      const notes = []; let div = 1; const open = new Map();
      let fifths = 0, curBeats = 4, curType = 4;
      pe.all('measure').forEach((me, mi) => {
        const M = meas[mi]; if (pi === 0) M.number = me.attr('number', String(mi + 1));
        let cur = 0, lastStart = 0, maxCur = 0;
        for (const ch of me.kids) {
          const nm = ch.name;
          if (nm === 'attributes') {
            const d = ch.num('divisions', 0); if (d) div = d;
            const k = ch.get('key'); if (k) { fifths = k.num('fifths', 0); if (M.fifths === null) M.fifths = fifths; }
            const t = ch.get('time'); if (t) { curBeats = parseInt(t.txt('beats', '4')) || 4; curType = parseInt(t.txt('beat-type', '4')) || 4; if (M.beats === null) { M.beats = curBeats; M.beatType = curType; } }
          } else if (nm === 'backup') { cur -= ch.num('duration') / div; }
          else if (nm === 'forward') { cur += ch.num('duration') / div; if (cur > maxCur) maxCur = cur; }
          else if (nm === 'direction') {
            for (const dt of ch.all('direction-type')) { const w = dt.get('words'); if (w && w.text.trim()) M.words.push(w.text.trim()); }
            const s = ch.get('sound'); if (s && s.attr('tempo') && !M.tempo) M.tempo = parseFloat(s.attr('tempo'));
            const mt = ch.path('direction-type/metronome');
            if (mt && !M.tempoMetro) { const bu = mt.txt('beat-unit'); const pm = parseFloat(mt.txt('per-minute')); if (pm) M.tempoMetro = { unit: bu, dot: !!mt.get('beat-unit-dot'), pm }; }
          } else if (nm === 'sound') { if (ch.attr('tempo') && !M.tempo) M.tempo = parseFloat(ch.attr('tempo')); }
          else if (nm === 'barline') {
            const rp = ch.get('repeat'); const loc = ch.attr('location', 'right');
            if (rp && pi === 0) { if (rp.attr('direction') === 'forward') M.repeatFwd = true; else { M.repeatBack = true; const tm = parseInt(rp.attr('times')); if (tm) M.times = tm; } }
            const en = ch.get('ending');
            if (en && pi === 0) {
              const nums = (en.attr('number', '1') + '').split(/[,\s]+/).map(x => parseInt(x)).filter(x => x > 0);
              if (en.attr('type') === 'start') M.endStart = nums; else M.endStop = true;
            }
          } else if (nm === 'note') {
            const dur = ch.num('duration') / div; const isChord = !!ch.get('chord'); const isGrace = !!ch.get('grace');
            if (!isChord) lastStart = cur;
            if (isGrace) continue;
            const start = isChord ? lastStart : cur;
            if (!ch.get('rest')) {
              const pt = ch.get('pitch');
              if (pt) {
                const p = STEP[pt.txt('step', 'C')] + pt.num('alter', 0) + 12 * (pt.num('octave', 4) + 1);
                const ties = ch.all('tie').map(x => x.attr('type'));
                const voice = parseInt(ch.txt('voice', '1')) || 1;
                const key = voice + '|' + p;
                const fm = !!(ch.path('notations/fermata'));
                let note = null;
                if (ties.includes('stop') && open.has(key)) { note = open.get(key); note.d += dur; if (fm) note.fm = true; if (!ties.includes('start')) open.delete(key); }
                else {
                  note = { t: M.start + start, ts: start, d: dur, p, v: voice, m: mi, fm, lyr: null, part: pi, st: pt.txt('step', 'C'), al: pt.num('alter', 0) };
                  notes.push(note); if (ties.includes('start')) open.set(key, note);
                }
                ch.all('lyric').forEach(ly => {   // todos os versos (number="1", "2", "3"…)
                  const vn = String(ly.attr('number', '1') + '').replace(/\D/g, '') || '1';
                  if (ly.get('text')) { const L = { text: ly.txt('text'), syl: ly.txt('syllabic', 'single') }; note.lyrs = note.lyrs || {}; if (!note.lyrs[vn]) note.lyrs[vn] = L; if (vn === '1' && !note.lyr) note.lyr = L; }
                });
              }
            }
            if (fm0(ch)) M.fermata = true;
            if (!isChord) { cur += dur; if (cur > maxCur) maxCur = cur; }
          }
          if (cur > maxCur) maxCur = cur;
        }
        if (maxCur > lenByMeasure[mi]) lenByMeasure[mi] = maxCur;
      });
      sc.parts.push({ id: pe.attr('id'), notes, fifths });
    });
    function fm0(ch) { return !!ch.path('notations/fermata'); }

    // comprimento/posição dos compassos
    let acc = 0; let curB = null, curT = null, curF = 0;
    meas.forEach((M, i) => {
      if (M.beats !== null) { curB = M.beats; curT = M.beatType; } else if (curB === null) { curB = 4; curT = 4; }
      if (M.fifths !== null) curF = M.fifths;
      M.beatsEff = curB; M.beatTypeEff = curT; M.fifthsEff = curF;
      const nominal = curB * 4 / curT;
      M.len = lenByMeasure[i] > EPS ? lenByMeasure[i] : nominal;
      M.start = acc; acc += M.len;
    });
    sc.totalLen = acc;
    // reposiciona notas (t absoluto) agora que os inícios dos compassos são conhecidos
    sc.parts.forEach(p => p.notes.forEach(n => { n.t = meas[n.m].start + n.ts; }));
    sc.measures = meas;
    sc.fifths = meas[0].fifthsEff; sc.beats = meas[0].beatsEff; sc.beatType = meas[0].beatTypeEff;
    // tempo (semínimas por minuto)
    let tempo = 0; for (const M of meas) if (M.tempo) { tempo = M.tempo; break; }
    if (!tempo) for (const M of meas) if (M.tempoMetro) { const u = { whole: 4, half: 2, quarter: 1, eighth: .5 }[M.tempoMetro.unit] || 1; tempo = M.tempoMetro.pm * u * (M.tempoMetro.dot ? 1.5 : 1); break; }
    sc.tempo = tempo || 72;
    sc.hasFermata = meas.some(m => m.fermata);
    if (!sc.parts.some(p => p.notes.length)) throw new Error('Nenhuma nota encontrada na partitura.');
    return sc;
  }

  /** Ordem de execução dos compassos considerando repetições e casas (voltas). */
  function unroll(sc) {
    const M = sc.measures, N = M.length, order = [];
    let i = 0, repStart = 0, pass = 1, back = false, guard = 0;
    while (i < N && guard++ < N * 12) {
      const m = M[i];
      if (m.endStart && !m.endStart.includes(pass)) {
        let j = i; while (j < N && !M[j].endStop) j++; i = j + 1; continue;
      }
      if (m.repeatFwd && !back) { repStart = i; pass = 1; }
      back = false;
      order.push(i);
      if (m.repeatBack) {
        if (pass < (m.times || 2)) { pass++; i = repStart; back = true; continue; }
        pass = 1;
      }
      i++;
    }
    return order;
  }

  /** Extrai as 4 vozes (S, A, T, B) + todas as notas por parte. */
  function extractVoices(sc) {
    const lines = { S: [], A: [], T: [], B: [] };
    const pairs = [['S', 'A'], ['T', 'B']];
    sc.parts.slice(0, 2).forEach((part, pi) => {
      const [upName, loName] = pairs[pi];
      const byT = new Map();
      part.notes.forEach(n => { const k = Math.round(n.t * 1000); if (!byT.has(k)) byT.set(k, []); byT.get(k).push(n); });
      const times = [...byT.keys()].sort((a, b) => a - b);
      // compassos com mais de uma voz?
      const hasV2 = new Map(); part.notes.forEach(n => { if (n.v > 1) hasV2.set(n.m, true); });
      const U = lines[upName], L = lines[loName];
      const put = (arr, n, p, d, t) => {
        const last = arr[arr.length - 1];
        if (last && last.t + last.d > t + EPS) last.d = Math.max(0.0625, t - last.t);
        const lyr = n.find(x => x.lyr); const lyrs = {}; n.forEach(x => x.lyrs && Object.keys(x.lyrs).forEach(k => { if (!lyrs[k]) lyrs[k] = x.lyrs[k]; })); const sp = n.find(x => x.p === p) || n[0]; arr.push({ t, d, p, m: n[0].m, fm: n.some(x => x.fm), lyr: lyr ? lyr.lyr : null, lyrs, st: sp.st, al: sp.al });
      };
      for (const k of times) {
        const g = byT.get(k); const t = g[0].t;
        const ps = [...new Set(g.map(x => x.p))].sort((a, b) => b - a);
        const dOf = p => Math.max(...g.filter(x => x.p === p).map(x => x.d));
        if (ps.length >= 2) {
          put(U, g, ps[0], dOf(ps[0]), t); put(L, g, ps[ps.length - 1], dOf(ps[ps.length - 1]), t);
        } else {
          const p = ps[0]; const v1 = g.some(x => x.v === 1), v2 = g.some(x => x.v > 1);
          if (v1 && v2) { put(U, g, p, dOf(p), t); put(L, g, p, dOf(p), t); }
          else if (v1) { put(U, g, p, dOf(p), t); if (!hasV2.get(g[0].m)) put(L, g, p, dOf(p), t); }
          else put(L, g, p, dOf(p), t);
        }
      }
    });
    return lines;
  }

  /** Todas as notas sonoras (para análise harmônica): {t,d,p,voice} */
  function allNotes(sc) {
    const r = []; sc.parts.forEach(p => p.notes.forEach(n => r.push({ t: n.t, d: n.d, p: n.p })));
    return r.sort((a, b) => a.t - b.t || a.p - b.p);
  }

  DH.mxl = { parseScore, unroll, extractVoices, allNotes, meterInfo };
})(typeof window !== 'undefined' ? window : globalThis);
