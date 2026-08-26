/**
 * Ferramentas de desenho disponíveis no editor.
 *
 * Cada constante é o identificador interno usado pelo estado do editor
 * e pelos componentes da barra de ferramentas.
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
  /** Tinta: preenche a região conectada da mesma cor. */
  FILL: 'fill',
  /** Move o desenho da camada dentro da grade (o que sair do mapa some). */
  MOVE: 'move',
}

/**
 * Metadados de exibição de cada ferramenta (rótulo, atalho e dica).
 * Usado pela toolbar e pela barra de status.
 */
export const TOOL_META = [
  {
    id: TOOLS.PENCIL,
    label: 'Pincel',
    shortcut: 'B',
    hint: 'Clique ou arraste para pintar. Passar por cima de outro desenho só troca a cor, não apaga.',
  },
  {
    id: TOOLS.ERASER,
    label: 'Borracha',
    shortcut: 'E',
    hint: 'Clique ou arraste para apagar blocos. O tamanho segue o pincel (1×1, 2×2 ou 3×3).',
  },
  {
    id: TOOLS.FILL,
    label: 'Tinta',
    shortcut: 'T',
    hint: 'Clique numa região fechada (ou num desenho da mesma cor) para pintá-la por completo.',
  },
  {
    id: TOOLS.LINE,
    label: 'Linha',
    shortcut: 'L',
    hint: 'Clique, arraste para definir o destino e solte para gravar a linha.',
  },
  {
    id: TOOLS.CIRCLE,
    label: 'Círculo',
    shortcut: 'C',
    hint: 'Clique num bloco, arraste até o canto oposto e solte. Distâncias iguais viram círculo; desiguais, elipse.',
  },
  {
    id: TOOLS.MOVE,
    label: 'Mover desenho',
    shortcut: 'V',
    hint: 'Arraste para deslocar o desenho da camada (ou do grupo) dentro do mapa. O que sair da grade desaparece.',
  },
]

/**
 * Devolve os metadados de uma ferramenta pelo id.
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
