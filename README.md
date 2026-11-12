# DigitaHinos FingerStyle (v2)

PWA estático (sem backend) com os 480 hinos (`hinos/001.mxl … 480.mxl` + `hinos/index.json`).

## O que há de novo
- **Som de violão** (nylon e aço) por modelagem física de corda (guia de onda digital, 2 polarizações, perdas por frequência, ressonâncias da caixa, palhetada/unha, reverb suave). Gerado no aparelho — nenhum arquivo de áudio. Para som por amostras gravadas seria preciso adicionar um banco de amostras.
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
