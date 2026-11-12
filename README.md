# DigitaHinos FingerStyle (v2)

PWA estático (sem backend) com os 480 hinos (`hinos/001.mxl … 480.mxl` + `hinos/index.json`).

## O que há de novo
- **Som de violão real** (nylon e aço): amostras gravadas em `sounds/nylon` e `sounds/steel` (uma por semitom, E2–G5, nomeadas pelo número MIDI), com volume nivelado, EQ por tipo de violão, compressor/limitador e reverb suave. Se as amostras não carregarem, o app cai automaticamente para a síntese física antiga (`js/synth.js`). Créditos em `CREDITS.md`.
- **Violão folk animado** (`js/fretboard.js`): violão cutaway visto de frente para quem toca (braço à direita, Mi grave em cima), cordas que vibram, dedos 1–4 da mão esquerda, dedos p-i-m-a da mão direita, capotraste e câmera (violão inteiro ou seguindo a mão).
- **Baixar áudio (.wav)**: botão “⬇ WAV” renderiza a partitura inteira offline, exatamente como ouvida (tom/transposição, capo, modo, andamento, violão e volume), em WAV estéreo 16 bits/44,1 kHz.
- **Sem bloqueios Pro**: transposição e todos os recursos são livres.
- **Partitura + tablatura** reais (SVG): pauta com armadura, compasso, ligaduras, pontos, repetições/casas, letra, cifras acima, **diagramas dos acordes usados**, cursor que acompanha o áudio. Modo "só tablatura" com ritmo.
- **Modos**: Fingerstyle completo (solo + baixo + dedilhado), Fingerstyle simples (solo + tônica no baixo), Soprano / Contralto / Tenor / Baixo (uma voz por vez), 4 vozes juntas (SATB adaptado).
- **Alcance da mão**: máx. 4 dedos, abertura de 3 casas (4 esticada), pestana só com indicador, notas seguradas ocupam dedos; notas fora da faixa mudam de oitava; notas impossíveis de alcançar são omitidas (aviso na tela).
- **Harmonia automática** a partir das 4 vozes (acordes simples, pouca troca, preferência por diatônicos) e **capotraste automático** (o tom não muda).
- **Enviar MXL**: botão no topo (aceita .mxl, .musicxml, .xml).
- **Braço realista**: escala real das casas, cordas que vibram, dedos animados, janela que acompanha a mão, capotraste.

## Estrutura
`js/xml.js` (ZIP/MXL), `mxl.js` (partitura, vozes, repetições), `harmony.js`, `guitar.js` (acordes), `fingering.js` (digitação), `arrange.js`, `synth.js`, `player.js`, `render.js`, `fretboard.js`, `app.js`. Testes em Node: `node test/t_arr.js` (todos os hinos × modos).

## Publicar
Rode `python -m http.server 8000` (não abra via file://) ou publique no GitHub Pages. Ao atualizar, mude `CACHE_NAME` em `sw.js`. Em Opções há "Baixar os 480 hinos" para uso offline.
