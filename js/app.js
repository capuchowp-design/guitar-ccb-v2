/* DigitaHinos — aplicação (interface) */
(function () {
  'use strict';
  const PIX_KEY = 'SUA-CHAVE-PIX-AQUI';
  const $ = s => document.querySelector(s);
  const DH = window.DH; const mod = (a, n) => ((a % n) + n) % n;
  const st = { catalog: [], cur: null, sc: null, lines: null, har: null, arr: null, order: [], capoAuto: 0, lay: null, prevCol: -1, onEls: [], raf: 0, lastFrame: 0, busy: false };
  const player = new DH.Player(); const fb = new DH.Fretboard($('#fretboard'));
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('dh_prefs') || '{}'); } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('dh_prefs', JSON.stringify(prefs)); } catch (e) { } };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const status = (m) => { $('#status').textContent = m || ''; };
  const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const KEYNAMES = { major: ['Dó', 'Réb', 'Ré', 'Mib', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Láb', 'Lá', 'Sib', 'Si'], minor: ['Dó', 'Dó♯', 'Ré', 'Mib', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Sib', 'Si'] };

  /* ---------- carregamento ---------- */
  async function loadCatalog() {
    try { const r = await fetch('hinos/index.json'); st.catalog = await r.json(); } catch (e) { st.catalog = Array.from({ length: 480 }, (_, i) => ({ n: i + 1, file: String(i + 1).padStart(3, '0') + '.mxl', title: 'Hino ' + (i + 1), author: '' })); }
    renderCatalog('');
  }
  function renderCatalog(q) {
    const el = $('#hymnList'); el.innerHTML = ''; const nq = norm(q); const frag = document.createDocumentFragment();
    st.catalog.filter(h => !nq || String(h.n).includes(nq) || norm(h.title).includes(nq) || norm(h.author).includes(nq)).forEach(h => {
      const b = document.createElement('button'); b.className = 'hymnrow'; b.innerHTML = '<b>' + String(h.n).padStart(3, '0') + '</b><span>' + esc(h.title) + '</span><span class="a">' + esc(h.author || '') + '</span>'; b.onclick = () => { $('#hymnModal').classList.remove('show'); openHymn(h.n); }; frag.append(b);
    });
    el.append(frag);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function openHymn(n) {
    const h = st.catalog.find(x => x.n === n) || { n, file: String(n).padStart(3, '0') + '.mxl', title: 'Hino ' + n };
    status('Carregando hino ' + n + '…');
    try { const r = await fetch('hinos/' + h.file); if (!r.ok) throw new Error('arquivo não encontrado (' + h.file + ')'); const buf = await r.arrayBuffer(); loadScore(buf, { n, title: h.title, author: h.author }); prefs.last = n; savePrefs(); }
    catch (e) { status('Não foi possível abrir o hino: ' + e.message); }
  }
  function loadScore(buf, meta) {
    pause(); let sc;
    try { sc = DH.mxl.parseScore(DH.xml.loadMusicXML(buf)); } catch (e) { status('Arquivo inválido: ' + e.message); return; }
    st.sc = sc; st.lines = DH.mxl.extractVoices(sc); st.order = DH.mxl.unroll(sc);
    const title = meta.title || sc.title || 'Sem título'; const author = meta.author || sc.composer || '';
    st.cur = { n: meta.n, title, author, user: !!meta.user };
    $('#hymnTitle').textContent = (meta.n ? 'Hino ' + meta.n + ' — ' : '') + title; $('#hymnMeta').textContent = author || (meta.user ? 'Arquivo enviado por você' : '');
    document.title = title + ' • DigitaHinos';
    st.har = DH.harmony.analyze(sc, st.lines);
    rebuild(true);
  }

  /* ---------- arranjo ---------- */
  function currentOpts() {
    const tr = Number($('#transpose').value); const mode = $('#mode').value;
    let capo = $('#capoSel').value; const chords = st.har.chords.map(c => Object.assign({}, c, { root: mod(c.root + tr, 12) }));
    const mel = st.lines.S.map(x => x.p + tr);
    const auto = DH.harmony.chooseCapo(chords, Math.min(...mel), Math.max(...mel)).capo; st.capoAuto = auto;
    capo = capo === 'auto' ? auto : Number(capo);
    return { mode, capo, transpose: tr };
  }
  async function rebuild(reset) {
    if (!st.sc || st.busy) return; st.busy = true; const wasPlaying = player.playing; const keepT = reset ? 0 : (player.entries.length ? player.writtenT(player.beat) : 0);
    pause();
    try {
      const o = currentOpts(); status('Calculando digitação…'); await new Promise(r => setTimeout(r, 10));
      const arr = DH.arrange.build(st.sc, st.lines, st.har, o); st.arr = arr; st.opts = o;
      const single = ['S', 'A', 'T', 'B'].includes(o.mode); if (single) { arr.chords = []; arr.shapes = []; }
      updateBadges(arr, o); drawScoreAndChords(); fb.setNotes(arr.notes, { type: $('#guitar').value, capo: arr.capo });
      player.setType($('#guitar').value); player.build(st.sc, arr.notes, st.order, st.sc.tempo, Number($('#speed').value) / 100);
      status('Preparando o som do violão…'); await player.prepare(arr.notes, p => status('Preparando o som do violão… ' + Math.round(p * 100) + '%')); status(info(arr, o));
      const beat = keepT ? player.entries.find(e => st.sc.measures[e.mi].start + st.sc.measures[e.mi].len > keepT) : null; player.seek(beat ? beat.tl0 + (keepT - st.sc.measures[beat.mi].start) : 0);
      frame(true); if (wasPlaying) play();
    } catch (e) { console.error(e); status('Erro ao montar o arranjo: ' + e.message); }
    st.busy = false;
  }
  function info(arr, o) {
    const p = []; if (arr.info.adaptedNotes) p.push(arr.info.adaptedNotes + ' nota(s) mudaram de oitava para caber no violão'); if (arr.info.dropped) p.push(arr.info.dropped + ' nota(s) omitida(s) por exigirem abertura de mão impossível');
    return p.length ? 'Adaptação: ' + p.join('; ') + '.' : 'Pronto. Todas as notas cabem no violão e na mão.';
  }
  function updateBadges(arr, o) {
    const k = st.har.key; const t = mod(k.tonic + o.transpose, 12); $('#keyBadge').textContent = 'Tom: ' + KEYNAMES[k.mode][t] + (k.mode === 'minor' ? ' menor' : ' maior');
    $('#capoBadge').textContent = arr.capo ? 'Capo: casa ' + arr.capo : 'Sem capo';
  }
  function drawScoreAndChords() {
    const arr = st.arr, sc = st.sc; const host = $('#scoreHost'); const wrap = $('#scoreWrap'); const W = Math.max(380, wrap.clientWidth - 2);
    const sp = Math.max(5.6, Math.min(9, W / 112)); const tabOnly = $('#notationMode').value === 'tab';
    const r = DH.render.render(sc, arr, { W, sp, tabOnly, lyrics: $('#lyrics').value === 'on' });
    host.innerHTML = r.svg; st.lay = r; st.prevCol = -1; st.prevSys = -1; st.onEls = []; st.sp = sp;
    const ls = r.systems[r.systems.length - 1]; host.style.paddingBottom = Math.max(0, wrap.clientHeight - (ls.bottom - ls.top) - 24) + 'px';
    host.querySelector('svg').addEventListener('click', ev => {
      const svg = host.querySelector('svg'); const b = svg.getBoundingClientRect(); const x = (ev.clientX - b.left) * (W / b.width), y = (ev.clientY - b.top) * (W / b.width);
      const m = r.meas.find(m => x >= m.x0 && x <= m.x1 && y >= m.y0 - 40 && y <= m.y1 + 20); if (m) { player.seek(player.beatForMeasure(m.mi)); frame(true); }
    });
    const bar = $('#chordBar'); const modeChords = arr.shapes && arr.shapes.length;
    if (modeChords) { bar.classList.add('show'); bar.innerHTML = '<div class="t">Acordes usados' + (arr.capo ? ' — capotraste na casa ' + arr.capo + ' (formas abaixo; o som sobe ' + arr.capo + ' semiton' + (arr.capo > 1 ? 's' : '') + ')' : '') + '</div><div class="row">' + arr.shapes.map(s => DH.render.chordDiagram(s)).join('') + '</div>'; } else { bar.classList.remove('show'); bar.innerHTML = ''; }
    $('#scoreHeading').textContent = tabOnly ? 'Tablatura' : 'Partitura e tablatura';
    $('#scoreInfo').textContent = 'Violão escrito uma oitava acima do som real (convenção). Toque na partitura para ir a um compasso.';
  }

  /* ---------- reprodução / animação ---------- */
  function play() { if (!st.arr) return; player.setVolume(Number($('#volume').value) / 100); player.play(); $('#playBtn').textContent = $('#fsPlay').textContent = 'Ⅱ'; loop(); }
  function pause() { if (player.playing) player.pause(); $('#playBtn').textContent = $('#fsPlay').textContent = '▶'; cancelAnimationFrame(st.raf); }
  player.onEnd = () => { $('#playBtn').textContent = $('#fsPlay').textContent = '▶'; frame(true); };
  function loop() { cancelAnimationFrame(st.raf); const t = performance.now(); const dt = Math.min(.1, (t - st.lastFrame) / 1000 || .016); st.lastFrame = t; frame(false, dt); if (player.playing) st.raf = requestAnimationFrame(loop); }
  function frame(force, dt) {
    if (!st.arr) return; const beat = player.beat; const tw = player.writtenT(beat);
    const pv = player.total ? Math.round(beat / player.total * 1000) : 0; const ck = fmt(beat * player.spb) + ' / ' + fmt(player.total * player.spb);
    $('#progress').value = pv; $('#clock').textContent = ck; $('#fsProg').value = pv; $('#fsClock').textContent = ck;
    // cursor na partitura
    const cols = st.lay.cols; let lo = 0, hi = cols.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cols[mid].t <= tw + 1e-6) lo = mid; else hi = mid - 1; }
    const c = cols[lo]; if (c && (lo !== st.prevCol || force)) {
      st.prevCol = lo; const sy = st.lay.systems[c.sys]; const cur = $('#cursor'); const sp = st.sp;
      cur.setAttribute('x', c.x - 1.2 * sp); cur.setAttribute('width', 2.4 * sp); cur.setAttribute('y', sy.top + 0.8 * sp); cur.setAttribute('height', sy.bottom - sy.top - 1.6 * sp);
      st.onEls.forEach(e => e.classList.remove('on')); st.onEls = [...document.querySelectorAll('.c' + c.mi + '_' + c.i)]; st.onEls.forEach(e => e.classList.add('on'));
      if (c.sys !== st.prevSys || force) { st.prevSys = c.sys; const wrap = $('#scoreWrap'); const want = Math.max(0, sy.top - 1.2 * sp); if (Math.abs(wrap.scrollTop - want) > 2) wrap.scrollTop = want; }
    }
    fb.update(tw, dt || .016, player.spb);
  }
  fb.draw = (function (orig) { return function (n) { if ($('#leftHand').value === 'off') { const keep = this.fing.map(f => f.a); this.fing.forEach(f => f.a = 0); orig.call(this, n); this.fing.forEach((f, i) => f.a = keep[i]); } else orig.call(this, n); }; })(fb.draw);

  /* ---------- eventos de UI ---------- */
  $('#playBtn').onclick = () => { if (player.playing) pause(); else play(); };
  $('#stopBtn').onclick = () => { pause(); player.seek(0); fb.reset(); frame(true); };
  $('#restartBtn').onclick = () => { const was = player.playing; player.seek(0); fb.reset(); frame(true); if (was) { /* continua */ } };
  $('#progress').oninput = e => { player.seek(player.total * Number(e.target.value) / 1000); fb.reset(); fb.idx = 0; frame(true); };
  $('#speed').oninput = e => { $('#speedVal').textContent = e.target.value + '%'; };
  $('#speed').onchange = () => rebuild(false);
  $('#volume').oninput = e => player.setVolume(Number(e.target.value) / 100);
  ['mode', 'guitar', 'capoSel'].forEach(id => $('#' + id).addEventListener('change', () => { prefs[id] = $('#' + id).value; savePrefs(); rebuild(false); }));
  $('#transpose').addEventListener('change', () => rebuild(false));
  ['notationMode', 'lyrics'].forEach(id => $('#' + id).addEventListener('change', () => { prefs[id] = $('#' + id).value; savePrefs(); if (st.arr) { drawScoreAndChords(); frame(true); } }));
  $('#leftHand').addEventListener('change', () => frame(true));
  $('#camMode').addEventListener('change', () => { prefs.camMode = $('#camMode').value; savePrefs(); fb.setCamMode($('#camMode').value); frame(true); });
  $('#screenMode').addEventListener('change', () => { const v = $('#screenMode').value; $('#guitarStage').classList.toggle('hidden', v === 'score'); $('#scoreStage').classList.toggle('hidden', v === 'guitar'); $('#chordBar').style.display = v === 'guitar' ? 'none' : ''; fb.resize(); if (st.arr) frame(true); });
  /* modo 16:9 em tela cheia (útil no celular deitado) */
  function setPresent(on) {
    const s = $('#scoreStage'); s.classList.toggle('present', on); document.body.style.overflow = on ? 'hidden' : '';
    try {
      if (on) { const rq = s.requestFullscreen || s.webkitRequestFullscreen; if (rq) Promise.resolve(rq.call(s)).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => { }); }
      else { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { }); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }
    } catch (e) { }
    setTimeout(() => { if (st.arr) { drawScoreAndChords(); frame(true); } }, 160);
  }
  $('#presentBtn').onclick = () => setPresent(true); $('#fsExit').onclick = () => setPresent(false);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && $('#scoreStage').classList.contains('present')) setPresent(false); });
  $('#fsPlay').onclick = () => $('#playBtn').click();
  $('#fsProg').oninput = e => { player.seek(player.total * Number(e.target.value) / 1000); fb.reset(); fb.idx = 0; frame(true); };
  $('#openHymns').onclick = () => { $('#hymnModal').classList.add('show'); setTimeout(() => $('#hymnSearch').focus(), 50); };
  $('#hymnSearch').oninput = e => renderCatalog(e.target.value.trim());
  $('#settingsBtn').onclick = () => $('#options').classList.toggle('open');
  $('#uploadBtn').onclick = () => $('#fileIn').click();
  $('#fileIn').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { loadScore(await f.arrayBuffer(), { title: f.name.replace(/\.(mxl|musicxml|xml)$/i, ''), user: true }); } catch (err) { status('Não foi possível ler o arquivo: ' + err.message); } e.target.value = ''; };
  $('#pdfBtn').onclick = () => window.print();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $('#' + b.dataset.close).classList.remove('show'));
  $('#pixBtn').onclick = () => { $('#pixKey').textContent = PIX_KEY; $('#pixModal').classList.add('show'); }; $('#copyPix').onclick = () => navigator.clipboard && navigator.clipboard.writeText(PIX_KEY);
  /* ---------- exportar áudio (.wav) ---------- */
  let wavUrl = null;
  $('#wavBtn').onclick = async () => {
    if (!st.arr || st.busy) return; const b = $('#wavBtn'); const old = b.textContent; b.disabled = true; pause();
    try {
      player.init(); player.setVolume(Number($('#volume').value) / 100); b.textContent = 'Gerando…'; status('Gerando o áudio WAV (mesmo tom, andamento, violão e volume que você ouve)…'); await new Promise(r => setTimeout(r, 40));
      const buf = await player.renderOffline(); const blob = DH.Player.toWav(buf);
      const slug = norm(st.cur ? st.cur.title : 'partitura').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      const name = (st.cur && st.cur.n ? 'hino-' + String(st.cur.n).padStart(3, '0') + '-' : '') + slug + '.wav';
      if (wavUrl) URL.revokeObjectURL(wavUrl); wavUrl = URL.createObjectURL(blob);
      const a = $('#wavLink'); a.href = wavUrl; a.download = name; $('#wavAudio').src = wavUrl;
      $('#wavInfo').textContent = name + ' • ' + fmt(blob.size / (44100 * 4)) + ' • ' + (blob.size / 1048576).toFixed(1) + ' MB • ' + ($('#guitar').value === 'steel' ? 'aço' : 'nylon') + (st.arr.capo ? ' • capo ' + st.arr.capo : '');
      $('#wavModal').classList.add('show'); status('Áudio WAV gerado.');
      const cap = window.Capacitor, nat = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins;
      if (nat && nat.Filesystem) {   // app Android (APK): salva no cache e abre o menu de compartilhar/salvar
        try {
          const data = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = no; fr.readAsDataURL(blob); });
          const r = await nat.Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
          if (nat.Share) await nat.Share.share({ title: name, url: r.uri, dialogTitle: 'Salvar ou compartilhar o áudio' });
        } catch (e) { console.warn(e); a.click(); }
      } else a.click();
    } catch (e) { console.error(e); status('Não foi possível gerar o WAV: ' + e.message); }
    b.textContent = old; b.disabled = false;
  };
  $('#wavModal').addEventListener('click', e => { if (e.target.id === 'wavModal') { $('#wavAudio').pause(); } });
  document.querySelectorAll('[data-close="wavModal"]').forEach(x => x.addEventListener('click', () => $('#wavAudio').pause()));
  let deferred = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  $('#installBtn').onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; } else alert('Use o menu do navegador “Instalar aplicativo” ou “Adicionar à tela inicial”.'); };
  let mr = null, chunks = [];
  $('#recordBtn').onclick = async () => {
    if (mr && mr.state === 'recording') { mr.stop(); return; }
    if (!window.MediaRecorder) { alert('Gravação não suportada neste navegador.'); return; }
    player.init(); try {
      let stream = player.rec.stream; if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) { try { const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); stream = new MediaStream([...ds.getVideoTracks(), ...player.rec.stream.getAudioTracks()]); } catch (e) { stream = player.rec.stream; } }
      mr = new MediaRecorder(stream); chunks = []; mr.ondataavailable = e => e.data.size && chunks.push(e.data);
      mr.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType })); a.download = 'digitahinos-gravacao.' + (mr.mimeType.includes('video') ? 'webm' : 'webm'); a.click(); $('#recordBtn').textContent = '● Gravar'; };
      mr.start(); $('#recordBtn').textContent = '■ Encerrar';
    } catch (e) { alert('Não foi possível gravar: ' + e.message); }
  };
  $('#offlineBtn').onclick = async () => { const b = $('#offlineBtn'); b.disabled = true; let ok = 0; for (const h of st.catalog) { try { const r = await fetch('hinos/' + h.file); if (r.ok) ok++; } catch (e) { } if (ok % 10 === 0) $('#offlineMsg').textContent = ok + ' / ' + st.catalog.length; } $('#offlineMsg').textContent = ok + ' de ' + st.catalog.length + ' hinos salvos para uso offline.'; b.disabled = false; };
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { fb.resize(); if (st.arr) { drawScoreAndChords(); frame(true); } }, 200); });
  fb.last = 0;

  // restaura preferências
  ['mode', 'guitar', 'capoSel', 'notationMode', 'lyrics'].forEach(id => { if (prefs[id]) $('#' + id).value = prefs[id]; });
  $('#camMode').value = prefs.camMode || (window.innerWidth < 700 ? 'follow' : 'full'); fb.setCamMode($('#camMode').value);
  window.__dh = { st, player, fb, openHymn, rebuild };
  loadCatalog().then(() => openHymn(prefs.last || 1));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.warn));
})();
