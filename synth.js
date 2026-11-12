/* DigitaHinos — síntese de violão por modelagem física (guia de onda digital)
 * Cada nota é renderizada offline (uma vez) e guardada em cache:
 *  - corda com duas polarizações (batimento e decaimento em dois estágios)
 *  - perda dependente da frequência (harmônicos agudos morrem mais rápido), calibrada por corda
 *  - forma e posição da palhetada (dedo/unha no nylon, palheta no aço) → espectro de pente realista
 *  - saída tomada como força na ponte (derivada) + ressonâncias do corpo (ar, tampo, fundo)
 *  - transiente (unha/palheta + "toc" da caixa) e filtro de irradiação
 */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});
  const OPEN = [64, 59, 55, 50, 45, 40];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  const PROFILE = {
    nylon: {
      t60: [1.7, 1.9, 2.3, 3.0, 3.5, 3.9], bRef: 0.46, pluckPos: 0.19, pluckSoft: 0.55, polSplit: [1, .42], detune: 0.00035,
      click: { amp: 0.05, fc: 2400, len: 0.004 }, thump: 0.55, out: 4800,
      body: [[96, 7, 1.0], [199, 9, .75], [286, 10, .5], [405, 11, .38], [520, 12, .3], [690, 12, .22], [980, 12, .16], [1450, 14, .1]], bodyMix: 1.0
    },
    steel: {
      t60: [2.8, 3.2, 3.9, 5.2, 6.0, 6.6], bRef: 0.17, pluckPos: 0.135, pluckSoft: 0.12, polSplit: [1, .5], detune: 0.0003,
      click: { amp: 0.11, fc: 5200, len: 0.0035 }, thump: 0.42, out: 8800,
      body: [[102, 7, 1.0], [188, 9, .8], [222, 9, .55], [380, 11, .42], [512, 12, .36], [700, 12, .3], [1100, 13, .25], [2200, 14, .12], [3300, 14, .1]], bodyMix: 1.0
    }
  };

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /** Uma polarização da corda (KS estendido). Retorna Float32Array de bridge-force. */
  function stringPol(fs, f0, n, g, b, beta, soft, amp, rand) {
    const N = fs / f0;                                  // atraso total (amostras)
    const L = Math.max(2, Math.floor(N - b - 0.5)); const frac = N - b - L;
    const eta = (1 - frac) / (1 + frac);
    const d = new Float32Array(L);
    // palhetada: deslocamento triangular, pico em beta*L
    const pk = Math.max(1, Math.min(L - 2, Math.round(beta * L)));
    for (let i = 0; i < L; i++) d[i] = i <= pk ? i / pk : (L - 1 - i) / (L - 1 - pk);
    let mean = 0; for (let i = 0; i < L; i++) mean += d[i]; mean /= L; for (let i = 0; i < L; i++) d[i] -= mean;
    // suavização (maciez do dedo / unha) e um pouco de ruído de contato
    const passes = 1 + Math.round(soft * 4);
    for (let k = 0; k < passes; k++) { let prev = d[L - 1]; for (let i = 0; i < L; i++) { const c = d[i]; d[i] = (1 - soft * .5) * c + soft * .5 * prev; prev = c; } }
    for (let i = 0; i < L; i++) d[i] = d[i] * amp + (rand() * 2 - 1) * 0.012 * amp;
    const out = new Float32Array(n); let wp = 0, ax = 0, ay = 0, lp = 0; let prevOut = 0;
    const a0 = g * (1 - b), a1 = g * b;
    for (let i = 0; i < n; i++) {
      const x = d[wp];                                   // saída do atraso
      // allpass fracionário
      const y = eta * x + ax - eta * ay; ax = x; ay = y;
      // filtro de perda
      const fb = a0 * y + a1 * lp; lp = y;
      d[wp] = fb; wp++; if (wp >= L) wp = 0;
      out[i] = x - prevOut * 0.985; prevOut = x;        // força na ponte ~ derivada
    }
    return out;
  }

  function biquadBP(x, fs, f, Q, gain) {
    const w0 = 2 * Math.PI * f / fs, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0);
    const b0 = al / (1 + al), b2 = -al / (1 + al), a1 = -2 * c / (1 + al), a2 = (1 - al) / (1 + al);
    const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const xi = x[i]; const yi = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi * gain; }
    return y;
  }
  function lowpass1(x, fs, fc, times) {
    const a = 1 - Math.exp(-2 * Math.PI * fc / fs);
    for (let k = 0; k < times; k++) { let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } }
  }

  /** Renderiza uma nota. opts: {fs, midi, string(0..5), type, vel(0..1), seed} → Float32Array (mono, pico ≈ 0.9) */
  function renderNote(opts) {
    const fs = opts.fs || 44100; const P = PROFILE[opts.type] || PROFILE.nylon; const vel = opts.vel === undefined ? .7 : opts.vel;
    const f0 = hz(opts.midi); const si = Math.max(0, Math.min(5, opts.string === undefined ? 3 : opts.string));
    const open = hz(OPEN[si] || opts.midi);
    let t60 = P.t60[si] * Math.pow(Math.min(1.2, open / f0), 0.45);
    t60 = Math.max(1.0, t60);
    const dur = Math.min(6.5, t60 * 1.05 + 0.25);
    const n = Math.floor(fs * dur); const rand = rng((opts.seed || 1) * 2654435761 + opts.midi * 97 + si);
    const g = Math.pow(10, -3 / (f0 * t60));
    const b = Math.max(0.012, Math.min(0.48, P.bRef * (110 / f0) * (0.8 + 0.5 * (1 - vel) + 0.0)));
    const beta = P.pluckPos * (0.9 + rand() * 0.2);
    const soft = Math.max(0.03, P.pluckSoft * (1.25 - vel * 0.7));
    const A = stringPol(fs, f0 * (1 + P.detune), n, g, b, beta, soft, P.polSplit[0], rand);
    const B = stringPol(fs, f0 * (1 - P.detune * 1.3), n, Math.pow(g, 0.82), b * 1.1, beta * 1.12, soft, P.polSplit[1], rand);
    const dry = new Float32Array(n); for (let i = 0; i < n; i++) dry[i] = A[i] + B[i];
    // transiente de ataque (ruído filtrado) e "toc" do corpo
    const cl = Math.floor(P.click.len * fs); const click = new Float32Array(cl);
    for (let i = 0; i < cl; i++) click[i] = (rand() * 2 - 1) * Math.exp(-i / (cl * 0.35));
    lowpass1(click, fs, P.click.fc, 1);
    let pk0 = 0; for (let i = 0; i < Math.min(n, 4000); i++) pk0 = Math.max(pk0, Math.abs(dry[i]));
    for (let i = 0; i < cl && i < n; i++) dry[i] += click[i] * P.click.amp * pk0 * (0.5 + vel);
    // ressonâncias da caixa
    const y = new Float32Array(dry); const tl = Math.floor(0.09 * fs);
    for (const [f, q, gn] of P.body) { const r = biquadBP(dry, fs, f, q, gn * 0.9 * P.bodyMix); for (let i = 0; i < n; i++) y[i] += r[i]; }
    // "toc" grave de caixa quando a corda é batida
    for (let i = 0; i < tl && i < n; i++) y[i] += Math.sin(2 * Math.PI * 135 * i / fs) * Math.exp(-i / (fs * 0.016)) * P.thump * pk0 * 0.5 * vel;
    lowpass1(y, fs, P.out * (0.7 + 0.5 * vel), 2);
    // equaliza energia grave/aguda e normaliza
    let peak = 0; for (let i = 0; i < n; i++) if (Math.abs(y[i]) > peak) peak = Math.abs(y[i]);
    const norm = peak > 0 ? 0.9 / peak : 1; const fade = Math.floor(0.12 * fs);
    for (let i = 0; i < n; i++) { let v = y[i] * norm; if (i > n - fade) v *= (n - i) / fade; y[i] = v; }
    // ataque inicial (evita estalo)
    for (let i = 0; i < 24 && i < n; i++) y[i] *= i / 24;
    return y;
  }

  /** Resposta de impulso de sala (reverb suave) — estéreo. */
  function makeIR(fs, secs, seed) {
    const n = Math.floor(fs * secs); const r = rng(seed || 7); const L = new Float32Array(n), R = new Float32Array(n);
    const early = [[.011, .5], [.019, .38], [.027, .3], [.041, .24], [.058, .18]];
    for (const [t, a] of early) { const i = Math.floor(t * fs); L[i] += a * (r() < .5 ? 1 : -1); R[Math.floor((t + .003) * fs)] += a * .9 * (r() < .5 ? 1 : -1); }
    let l1 = 0, l2 = 0; const lpA = 0.12;
    for (let i = Math.floor(.02 * fs); i < n; i++) {
      const env = Math.exp(-3 * i / n * 2.4) * Math.min(1, (i - .02 * fs) / (.02 * fs));
      l1 += lpA * ((r() * 2 - 1) - l1); l2 += lpA * ((r() * 2 - 1) - l2);
      L[i] += l1 * env * .5; R[i] += l2 * env * .5;
    }
    return [L, R];
  }

  DH.synth = { renderNote, makeIR, PROFILE, hz };
})(typeof window !== 'undefined' ? window : globalThis);
