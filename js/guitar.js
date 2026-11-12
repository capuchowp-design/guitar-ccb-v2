/* DigitaHinos — dados do violão: afinação, formas de acordes (diagramas) */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const OPEN = [64, 59, 55, 50, 45, 40];          // índice 0 = 1ª corda (mi agudo) … 5 = 6ª corda (mi grave)
  const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];
  const MAXFRET = 19;
  const mod = (a, n) => ((a % n) + n) % n;

  // Formas abertas. frets/fingers na ordem 6ª→1ª corda (como nos diagramas). -1 = não tocar
  const OPENSHAPES = {
    '0|maj': [[-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]],
    '2|maj': [[-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]],
    '4|maj': [[0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]],
    '7|maj': [[3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]],
    '9|maj': [[-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]],
    '5|maj': [[-1, -1, 3, 2, 1, 1], [0, 0, 3, 2, 1, 1]],
    '9|min': [[-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]],
    '4|min': [[0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]],
    '2|min': [[-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]],
    '0|7': [[-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]],
    '2|7': [[-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]],
    '4|7': [[0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]],
    '7|7': [[3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]],
    '9|7': [[-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]],
    '11|7': [[-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]],
    '4|min7': [[0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]],
    '9|min7': [[-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]],
    '2|min7': [[-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1]],
    '0|maj7': [[-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]],
    '5|maj7': [[-1, -1, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0]],
    '7|maj7': [[3, 2, 0, 0, 0, 2], [3, 2, 0, 0, 0, 1]],
    '9|maj7': [[-1, 0, 2, 1, 2, 0], [0, 0, 2, 1, 3, 0]],
    '2|maj7': [[-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1]],
    '4|maj7': [[0, 2, 1, 1, 0, 0], [0, 3, 2, 1, 0, 0]]
  };
  // Formas móveis (pestana). base = casa da pestana; frets relativos
  const E_FORM = {
    maj: [[0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1]],
    min: [[0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1]],
    '7': [[0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1]],
    min7: [[0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1]],
    maj7: [[0, 2, 1, 1, 0, 0], [1, 4, 2, 3, 1, 1]],
    dim: [[0, 1, 2, 0, -1, -1], [1, 2, 3, 0, 0, 0]]
  };
  const A_FORM = {
    maj: [[-1, 0, 2, 2, 2, 0], [0, 1, 2, 3, 4, 1]],
    min: [[-1, 0, 2, 2, 1, 0], [0, 1, 3, 4, 2, 1]],
    '7': [[-1, 0, 2, 0, 2, 0], [0, 1, 3, 1, 4, 1]],
    min7: [[-1, 0, 2, 0, 1, 0], [0, 1, 3, 1, 2, 1]],
    maj7: [[-1, 0, 2, 1, 2, 0], [0, 1, 3, 2, 4, 1]],
    dim: [[-1, 0, 1, 2, 1, -1], [0, 1, 2, 4, 3, 0]]
  };
  /** Forma de acordes para diagrama. root = classe de altura (0..11) no domínio do violão (sem capo). */
  function chordShape(root, type) {
    const k = root + '|' + type; let frets, fingers, base = 1, barre = null;
    if (OPENSHAPES[k]) { [frets, fingers] = OPENSHAPES[k]; frets = frets.slice(); fingers = fingers.slice(); }
    else {
      const eF = mod(root - 4, 12) || 12, aF = mod(root - 9, 12) || 12;
      const useA = A_FORM[type] && (aF < eF || !E_FORM[type]) ; const F = useA ? A_FORM[type] : E_FORM[type];
      const fr = useA ? aF : eF; const tf = F || E_FORM.maj;
      frets = tf[0].map(x => x < 0 ? -1 : x + fr); fingers = tf[1].slice(); base = fr;
      // pestana: cordas com dedo 1 na casa base
      const idx = frets.map((f, i) => (f === fr && fingers[i] === 1) ? i : -1).filter(i => i >= 0);
      if (idx.length >= 2) barre = { fret: fr, from: Math.min(...idx), to: Math.max(...idx) };
    }
    const played = frets.filter(f => f > 0); const minF = played.length ? Math.min(...played) : 1;
    const maxF = played.length ? Math.max(...played) : 1;
    const start = maxF <= 5 ? 1 : minF; // casa inicial do diagrama
    return { root, type, frets, fingers, barre, start };
  }

  /** Posições (corda, casa) possíveis para um tom MIDI. */
  const posCache = new Map();
  function positions(p) {
    let r = posCache.get(p); if (r) return r; r = [];
    for (let s = 0; s < 6; s++) { const f = p - OPEN[s]; if (f >= 0 && f <= MAXFRET) r.push({ s, f }); }
    posCache.set(p, r); return r;
  }
  DH.guitar = { OPEN, STRING_NAMES, MAXFRET, chordShape, positions, mod, LOW: 40, HIGH: 64 + MAXFRET };
})(typeof window !== 'undefined' ? window : globalThis);
