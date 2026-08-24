/**
 * Ferramentas de desenho disponíveis no editor.
 *
 * Cada constante é o identificador interno usado pelo estado do editor
 * e pelos componentes da barra de ferramentas.
 */
export const TOOLS = {
  /** Pincel: clica ou arrasta bloco a bloco invertendo a cor (switch). */
  PENCIL: 'pencil',
  /** Linha: origina no clique e acompanha o cursor até soltar o mouse. */
  LINE: 'line',
  /** Círculo / elipse: o clique é um canto; o arrasto define o oposto. */
  CIRCLE: 'circle',
  /** Tinta: preenche a região conectada da mesma cor. */
  FILL: 'fill',
  /** Move a camada (ou o grupo) pelo cartesiano. */
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
    hint: 'Clique ou arraste para ligar/desligar cada bloco uma vez por traço.',
  },
  {
    id: TOOLS.FILL,
    label: 'Tinta',
    shortcut: 'T',
    hint: 'Clique numa região fechada (ou num desenho da mesma cor) para pintá-la por completo.',
    icon: 'tinta',
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
    label: 'Mover camada',
    shortcut: 'V',
    hint: 'Arraste no mapa para reposicionar a camada (ou o grupo) no cartesiano.',
  },
]

/**
 * Devolve os metadados de uma ferramenta pelo id.
 * @param {string} toolId
 */
export function getToolMeta(toolId) {
  return TOOL_META.find((tool) => tool.id === toolId) ?? TOOL_META[0]
}
