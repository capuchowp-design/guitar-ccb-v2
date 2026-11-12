/* DigitaHinos — XML mínimo + descompactação ZIP/MXL (sem dependências, roda no navegador e no Node) */
(function (G) {
  'use strict';
  const DH = (G.DH = G.DH || {});

  /* ---------- parser XML simples (suficiente para MusicXML) ---------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function decode(s) {
    return s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENT[e] !== undefined ? ENT[e] : m;
    });
  }
  class El {
    constructor(name, attrs) { this.name = name; this.attrs = attrs; this.kids = []; this.text = ''; }
    get(n) { for (const k of this.kids) if (k.name === n) return k; return null; }
    all(n) { return this.kids.filter(k => k.name === n); }
    txt(n, d = '') { const k = this.get(n); return k ? k.text.trim() : d; }
    num(n, d = 0) { const k = this.get(n); if (!k) return d; const v = parseFloat(k.text); return isNaN(v) ? d : v; }
    attr(a, d = null) { return this.attrs[a] !== undefined ? this.attrs[a] : d; }
    path(p) { let e = this; for (const s of p.split('/')) { e = e && e.get(s); if (!e) return null; } return e; }
  }
  function parseXML(src) {
    let i = 0; const n = src.length; const root = new El('#root', {}); const stack = [root];
    while (i < n) {
      const lt = src.indexOf('<', i);
      if (lt < 0) break;
      if (lt > i) { const t = src.slice(i, lt); if (t.trim()) stack[stack.length - 1].text += decode(t); }
      if (src.startsWith('<!--', lt)) { i = src.indexOf('-->', lt) + 3; continue; }
      if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt); stack[stack.length - 1].text += src.slice(lt + 9, e); i = e + 3; continue; }
      if (src.startsWith('<?', lt)) { i = src.indexOf('?>', lt) + 2; continue; }
      if (src.startsWith('<!', lt)) { // DOCTYPE (pode ter [ ... ])
        let depth = 0, j = lt + 2;
        for (; j < n; j++) { const c = src[j]; if (c === '[') depth++; else if (c === ']') depth--; else if (c === '>' && depth <= 0) break; }
        i = j + 1; continue;
      }
      let j = lt + 1, q = 0;
      for (; j < n; j++) { const c = src[j]; if (q) { if (c === q) q = 0; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
      let tag = src.slice(lt + 1, j); i = j + 1;
      if (tag[0] === '/') { stack.pop(); continue; }
      const selfClose = tag.endsWith('/'); if (selfClose) tag = tag.slice(0, -1);
      const m = /^([^\s/>]+)/.exec(tag); const name = m[1]; const attrs = {};
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let a; const rest = tag.slice(name.length);
      while ((a = re.exec(rest))) attrs[a[1]] = decode(a[3] !== undefined ? a[3] : a[4]);
      const el = new El(name, attrs); stack[stack.length - 1].kids.push(el);
      if (!selfClose) stack.push(el);
    }
    return root.kids[0] || null;
  }

  /* ---------- inflate (RFC1951) ---------- */
  const LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEXT = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DEXT = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CLORD = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  function buildTree(lens) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lens.length);
    for (const l of lens) count[l]++;
    count[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let s = 0; s < lens.length; s++) if (lens[s]) sym[offs[lens[s]]++] = s;
    return { count, sym };
  }
  function inflateRaw(src, outSize) {
    let pos = 0, bitBuf = 0, bitCnt = 0;
    let out = new Uint8Array(outSize || src.length * 4), op = 0;
    const need = k => { if (op + k > out.length) { const o = new Uint8Array(Math.max(out.length * 2, op + k)); o.set(out); out = o; } };
    const bits = n => { while (bitCnt < n) { bitBuf |= (src[pos++] || 0) << bitCnt; bitCnt += 8; } const v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCnt -= n; return v; };
    const decodeSym = t => { let code = 0, first = 0, index = 0; for (let len = 1; len < 16; len++) { code |= bits(1); const c = t.count[len]; if (code - c < first) return t.sym[index + (code - first)]; index += c; first += c; first <<= 1; code <<= 1; } throw new Error('inflate: código inválido'); };
    let fixedL = null, fixedD = null;
    let final = 0;
    while (!final) {
      final = bits(1); const type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0; const len = src[pos] | (src[pos + 1] << 8); pos += 4; need(len);
        out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
      } else if (type === 1 || type === 2) {
        let lt, dt;
        if (type === 1) {
          if (!fixedL) { const l = new Uint8Array(288); for (let i = 0; i < 144; i++) l[i] = 8; for (let i = 144; i < 256; i++) l[i] = 9; for (let i = 256; i < 280; i++) l[i] = 7; for (let i = 280; i < 288; i++) l[i] = 8; fixedL = buildTree(l); fixedD = buildTree(new Uint8Array(30).fill(5)); }
          lt = fixedL; dt = fixedD;
        } else {
          const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4; const lens = new Uint8Array(320);
          for (let i = 0; i < ncode; i++) lens[CLORD[i]] = bits(3);
          const ct = buildTree(lens.subarray(0, 19)); let idx = 0; const ll = new Uint8Array(nlen + ndist);
          while (idx < nlen + ndist) {
            const s = decodeSym(ct);
            if (s < 16) ll[idx++] = s;
            else { let prev = 0, rep; if (s === 16) { prev = ll[idx - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7); while (rep--) ll[idx++] = prev; }
          }
          lt = buildTree(ll.subarray(0, nlen)); dt = buildTree(ll.subarray(nlen));
        }
        for (;;) {
          let s = decodeSym(lt);
          if (s < 256) { need(1); out[op++] = s; }
          else if (s === 256) break;
          else {
            s -= 257; const len = LBASE[s] + bits(LEXT[s]); const ds = decodeSym(dt); const dist = DBASE[ds] + bits(DEXT[ds]);
            need(len); for (let k = 0; k < len; k++) { out[op] = out[op - dist]; op++; }
          }
        }
      } else throw new Error('inflate: bloco inválido');
    }
    return out.subarray(0, op);
  }

  /* ---------- ZIP (diretório central) ---------- */
  function readZip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Arquivo ZIP/MXL inválido');
    const cnt = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
    const td = new TextDecoder();
    for (let i = 0; i < cnt; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
      const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true); const ds = lo + 30 + lnl + lxl;
      files[name] = { method, get: () => { const raw = u8.subarray(ds, ds + csize); return method === 0 ? raw : inflateRaw(raw, usize); } };
      p += 46 + nl + xl + cl;
    }
    return files;
  }
  /** Recebe ArrayBuffer de .mxl/.musicxml/.xml e devolve o elemento raiz do MusicXML. */
  function loadMusicXML(buf) {
    const u8 = new Uint8Array(buf); const td = new TextDecoder('utf-8');
    if (u8[0] === 0x50 && u8[1] === 0x4b) {
      const z = readZip(u8); let main = null;
      if (z['META-INF/container.xml']) {
        const c = parseXML(td.decode(z['META-INF/container.xml'].get()));
        const rf = c && (function f(e) { if (e.name === 'rootfile') return e; for (const k of e.kids) { const r = f(k); if (r) return r; } return null; })(c);
        if (rf && z[rf.attr('full-path')]) main = rf.attr('full-path');
      }
      if (!main) main = Object.keys(z).find(n => !n.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(n));
      if (!main) throw new Error('Nenhuma partitura encontrada dentro do arquivo .mxl');
      return parseXML(td.decode(z[main].get()));
    }
    return parseXML(td.decode(u8));
  }
  DH.xml = { parseXML, readZip, inflateRaw, loadMusicXML };
})(typeof window !== 'undefined' ? window : globalThis);
