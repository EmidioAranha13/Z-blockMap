/**
 * Identificadores e metadados das ferramentas.
 *
 * Módulo compartilhado entre system-vue e system-react-native.
 * A geometria das formas vive em shared/shapes.js; aqui só há catálogo e UI.
 */

export const TOOLS = {
  /** Pincel: clica ou arrasta e só pinta (não apaga o que já está preenchido). */
  PENCIL: 'pencil',
  /** Borracha: clica ou arrasta e só apaga (volta o bloco para vazio). */
  ERASER: 'eraser',
  /** Linha: origina no clique e acompanha o cursor até soltar o mouse. */
  LINE: 'line',
  /** Círculo / elipse: o clique é um canto; o arrasto define o oposto. */
  CIRCLE: 'circle',
  /** Quadrado / retângulo: o clique é um canto; o arrasto define o oposto. */
  SQUARE: 'square',
  /** Pentágono regular (ou esticado) inscrito na caixa do arrasto. */
  PENTAGON: 'pentagon',
  /** Estrela de 5 pontas inscrita na caixa do arrasto. */
  STAR: 'star',
  /** Tinta: preenche a região conectada da mesma cor. */
  FILL: 'fill',
  /** Move o desenho da camada dentro da grade (o que sair do mapa some). */
  MOVE: 'move',
  /** Gira o desenho da camada em torno da origem, de 1 em 1 grau. */
  ROTATE: 'rotate',
}

/** Formas desenhadas por arrasto (preview até soltar o ponteiro). */
export const SHAPE_TOOL_IDS = [TOOLS.LINE, TOOLS.CIRCLE, TOOLS.SQUARE, TOOLS.PENTAGON, TOOLS.STAR]

export const THICKNESS = {
  CENTERED: 'centered',
  INWARD: 'inward',
  OUTWARD: 'outward',
}

export const THICKNESS_ORIENTATIONS = [
  {
    id: THICKNESS.CENTERED,
    label: 'Centralizada',
    hint: 'A espessura cresce para os dois lados do contorno. O pixel extra de uma espessura par vai para fora.',
  },
  {
    id: THICKNESS.INWARD,
    label: 'Para dentro',
    hint: 'Toda a espessura cresce em direção ao interior da forma, incluindo o contorno original.',
  },
  {
    id: THICKNESS.OUTWARD,
    label: 'Para fora',
    hint: 'Toda a espessura cresce em direção ao exterior da forma, incluindo o contorno original.',
  },
]

export const ACTION_TOOL_META = [
  {
    id: TOOLS.PENCIL,
    label: 'Pincel',
    shortcut: 'B',
    hint: 'Clique ou arraste para pintar. Passar por cima de outro desenho só troca a cor, não apaga.',
    blurb: 'Pinta blocos na grade sem apagar o que já está preenchido.',
  },
  {
    id: TOOLS.ERASER,
    label: 'Borracha',
    shortcut: 'R',
    hint: 'Clique ou arraste para apagar blocos. O tamanho segue o pincel (1×1, 2×2 ou 3×3).',
    blurb: 'Apaga blocos da grade. O tamanho segue o pincel.',
  },
  {
    id: TOOLS.FILL,
    label: 'Tinta',
    shortcut: 'T',
    hint: 'Clique numa região fechada (ou num desenho da mesma cor) para pintá-la por completo.',
    blurb: 'Preenche uma região fechada da mesma cor.',
  },
]

export const PERFECT_TOOL_META = {
  id: 'perfect',
  label: 'Forma perfeita',
  shortcut: '',
  hint: 'Forma geométrica centrada na origem, com escala, espessura e orientação.',
  blurb: 'Gera uma forma geométrica centrada na origem.',
}

export const SHAPE_TOOL_META = [
  {
    id: TOOLS.LINE,
    label: 'Linha',
    shortcut: 'L',
    glyph: '─',
    hint: 'Clique, arraste para definir o destino e solte para gravar a linha.',
    blurb: 'Desenha uma linha reta entre dois pontos da grade.',
  },
  {
    id: TOOLS.CIRCLE,
    label: 'Círculo',
    shortcut: 'C',
    glyph: '○',
    hint: 'Clique num bloco, arraste até o canto oposto e solte. Distâncias iguais viram círculo; desiguais, elipse.',
    blurb: 'Desenha círculos livremente na grade.',
  },
  {
    id: TOOLS.SQUARE,
    label: 'Quadrado',
    shortcut: 'Q',
    glyph: '□',
    hint: 'Clique num bloco, arraste até o canto oposto e solte. Distâncias iguais viram quadrado; desiguais, retângulo.',
    blurb: 'Desenha quadrados e retângulos na grade.',
  },
  {
    id: TOOLS.PENTAGON,
    label: 'Pentágono',
    shortcut: 'P',
    glyph: '⬠',
    hint: 'Clique, arraste a caixa e solte. O pentágono fica inscrito nessa caixa.',
    blurb: 'Desenha pentágonos inscritos na caixa do arrasto.',
  },
  {
    id: TOOLS.STAR,
    label: 'Estrela',
    shortcut: 'E',
    glyph: '☆',
    hint: 'Clique, arraste a caixa e solte. A estrela de cinco pontas fica inscrita nessa caixa.',
    blurb: 'Desenha estrelas de cinco pontas na grade.',
  },
]

export const MOVE_TOOL_META = [
  {
    id: TOOLS.MOVE,
    label: 'Mover desenho',
    shortcut: 'V',
    hint: 'Arraste para deslocar o desenho da camada (ou do grupo) dentro do mapa. O que sair da grade desaparece.',
    blurb: 'Desloca o desenho da camada dentro do mapa.',
  },
  {
    id: TOOLS.ROTATE,
    label: 'Girar desenho',
    shortcut: 'G',
    glyph: '↻',
    hint: 'Clique e segure o desenho, depois arraste para a esquerda ou direita. O giro é de 1° em 1° em torno da origem.',
    blurb: 'Gira o desenho da camada em torno da origem, de 1° em 1°.',
  },
]

/** Primeira linha da grade compacta: pincel, borracha, tinta, forma perfeita, mover. */
export const COMPACT_ACTION_META = [...ACTION_TOOL_META, PERFECT_TOOL_META, ...MOVE_TOOL_META]

export const TOOL_META = [...ACTION_TOOL_META, ...SHAPE_TOOL_META, ...MOVE_TOOL_META]

/**
 * @param {string} toolId
 */
export function getToolMeta(toolId) {
  return TOOL_META.find((tool) => tool.id === toolId) ?? TOOL_META[0]
}

/**
 * Pincel e borracha gravam no clique/arrasto, sem preview de forma.
 * @param {string} toolId
 */
export function isStampTool(toolId) {
  return toolId === TOOLS.PENCIL || toolId === TOOLS.ERASER
}

/**
 * Linha, círculo, quadrado, pentágono e estrela.
 * @param {string} toolId
 */
export function isShapeTool(toolId) {
  return SHAPE_TOOL_IDS.includes(toolId)
}

/**
 * Ferramentas que prendem o ponteiro até o mouseup (formas + mover).
 * @param {string} toolId
 */
export function isStrokeTool(toolId) {
  return isShapeTool(toolId) || toolId === TOOLS.MOVE || toolId === TOOLS.ROTATE
}
