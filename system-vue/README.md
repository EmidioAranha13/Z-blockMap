# Z-blockMap

Editor de mapas em **blocos** (tiles). Você informa a escala **X × Y**, pinta bloco a bloco ou arrasta formas (linha e círculo) até soltar o mouse.

Feito com **Vue 3**, **Vite**, **Canvas 2D** e a roda de cores **iro.js**.

---

## O que o editor faz

- Cria um mapa de `X` colunas por `Y` linhas (**1 a 500**), sempre com essa quantidade exata de blocos. Em escalas grandes a malha permanece visível (bloco mínimo de 6 px) sem esticar o plano: o que não cabe na tela move-se com o botão direito.
- Eixos cartesianos no centro, separando **Q1–Q4**.
- **Pincel:** clique ou arraste — cada bloco alterna de cor uma vez por traço.
- **Linha / círculo:** a forma acompanha o mouse e só grava ao soltar.
- Paleta: **7 cores fixas** + **7 slots** das cores da roda + collapse com o restante. Cada cor tem **nome** e **hex** editáveis.
- Cadeado na escala para forçar **X = Y**. Pincel/linha/círculo com espessura **1×1, 2×2 ou 3×3**.
- **Camadas e grupos** (olho para visibilidade; movimento com a ferramenta Mover / `V`).
- Nome do mapa no topo: usado na tela e no nome dos arquivos salvos.
- **Undo / Redo** (fila de até 50 ações; a mais antiga sai quando enche).
- **Modo dia** (fundo branco) e **modo noite** (fundo preto).
- Zoom com **+ / −** (canto inferior direito) e com o **scroll** (centro no cursor).
- Mover o mapa com o **botão direito** pressionado.
- **Salvar / carregar** arquivo `.zblockmap.json` (mapa + histórico de cores).
- **Salvar PNG** da imagem do mapa com a grade, margem e tags das cores em uso (`[hex] Nome`).

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) **18 ou superior** (inclui o `npm`)
- Navegador atual (Chrome, Edge, Firefox)

No Windows, se `node` / `npm` não forem reconhecidos, abra um **terminal novo** (ou reinicie o Cursor) depois de instalar o Node.

---

## Como executar

Nesta pasta:

```bash
npm install
npm run dev
```

O app abre em:

```
http://localhost:5173
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento, com recarregamento automático |
| `npm run build` | Gera `dist/` |
| `npm run preview` | Serve o build |

---

## Como usar

1. Informe X e Y (até 500) e clique em **Criar mapa**.
2. Ferramentas: **Pincel (B)**, **Linha (L)**, **Círculo (C)**.
3. Escolha uma cor fixa ou abra **Roda de cores**, solte o clique (ou **Adicionar esta cor**) para gravar no histórico.
4. Edite **Nome** e **Hex** da cor selecionada.
5. **Undo / Redo** desfazem e refazem traços. **Salvar mapa** baixa o arquivo; **Carregar mapa** reabre. **Salvar PNG** exporta só a imagem (com grade e eixos).
6. Scroll ou **+ / −** para zoom. Botão direito arrasta o mapa.

### Atalhos

| Tecla | Ação |
|---|---|
| `B` | Pincel |
| `L` | Linha |
| `V` | Mover camada |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` ou `Ctrl+Shift+Z` | Redo |
| Scroll | Zoom na posição do cursor |
| Botão direito + arrastar | Mover o mapa |

---

## Organização do código

```
src/
├── main.js
├── App.vue
├── styles/main.css              # Temas dia / noite
├── pages/MapEditorPage.vue      # Layout da tela
├── components/
│   ├── ScalePanel.vue           # Escala X × Y
│   ├── EditorToolbar.vue        # Ferramentas, paleta, arquivo
│   ├── ColorPalette.vue         # Fixas, slots da roda, collapse
│   ├── ColorWheel.vue           # Roda iro.js
│   ├── MapCanvas.vue            # Canvas, zoom, pan, eixos
│   └── StatusBar.vue
├── composables/
│   ├── useMapEditor.js          # Grade, cores, undo/redo, save
│   └── useTheme.js              # Dia / noite
├── constants/
│   ├── limits.js                # 500×500, histórico 50, zoom
│   ├── tools.js
│   └── palette.js               # Cores fixas e aparência do canvas
└── utils/
    ├── grid.js
    ├── shapes.js
    ├── coords.js                # Tela → bloco, zoom âncora
    ├── drawMap.js               # Desenho compartilhado (tela e PNG)
    ├── legend.js                # Tags de cor do PNG
    ├── history.js               # Fila FIFO de 50
    ├── fileFormat.js            # .zblockmap.json
    └── download.js
```

A grade é `grid[y][x]` (Y = linha, X = coluna). `0` = vazio (branco de dia, preto de noite). Os demais valores são ids de cor da paleta combinada.

---

## Formato do arquivo salvo

Extensão: `*.zblockmap.json`

```json
{
  "format": "z-blockmap",
  "version": 2,
  "width": 24,
  "height": 16,
  "selectedColor": 1,
  "colors": {
    "fixed": [{ "id": 0, "name": "Vazio", "hex": "#808080" }],
    "custom": [{ "id": 100, "name": "Cor 1", "hex": "#ff8800" }]
  },
  "cells": [[0, 1], [3, 100]]
}
```

O JSON antigo (só `width`, `height`, `cells`) ainda carrega; as cores da roda vêm vazias.

---

## Limites

- Escala máxima: **500 × 500**. O plano tem exatamente X × Y blocos; a página não cresce para “esticar” o cartesiano. Mapas grandes transbordam a área (botão direito move; afastar o zoom mostra o mapa inteiro). Os eixos passam numa linha da grade (`floor(n/2)`), não no meio de um bloco.
- Histórico: **50** snapshots. Chegou no limite, o mais antigo é descartado (FIFO).
- PNG: mapa com grade e eixos, margem em todos os lados e, abaixo, a legenda das cores pintadas.

---

## Stack

- Vue 3 (Composition API, `<script setup>`)
- Vite 6
- Canvas 2D
- [@jaames/iro](https://iro.js.org/) (roda de cores)
