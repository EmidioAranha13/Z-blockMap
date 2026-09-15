/**
 * Constantes do editor voxel.
 * Limites só existem por memória/GPU, não por regra de jogo.
 */
export const VOXEL_TOOLS = {
  SELECT: 'select',
  ADD: 'add',
  REMOVE: 'remove',
}

export const VOXEL_TOOL_META = [
  {
    id: VOXEL_TOOLS.SELECT,
    label: 'Selecionar',
    shortcut: 'V',
    hint: 'Clique num bloco para marcá-lo. Arraste para orbitar a câmera.',
  },
  {
    id: VOXEL_TOOLS.ADD,
    label: 'Adicionar',
    shortcut: 'A',
    hint: 'Clique numa face (ou no chão) para criar um cubo da cor selecionada.',
  },
  {
    id: VOXEL_TOOLS.REMOVE,
    label: 'Remover',
    shortcut: 'R',
    hint: 'Clique num bloco para apagá-lo. Blocos acima permanecem no lugar.',
  },
]

export const WORLD_OPS = {
  ADD_BLOCK: 'ADD_BLOCK',
  REMOVE_BLOCK: 'REMOVE_BLOCK',
  RESET: 'RESET',
}

/** Direções do empilhamento experimental (um passo por clique). */
export const STACK_DIRS = {
  left: { id: 'left', x: -1, y: 0, z: 0, label: 'Esquerda', axis: '−X' },
  right: { id: 'right', x: 1, y: 0, z: 0, label: 'Direita', axis: '+X' },
  up: { id: 'up', x: 0, y: 1, z: 0, label: 'Cima', axis: '+Y altura' },
  down: { id: 'down', x: 0, y: -1, z: 0, label: 'Baixo', axis: '−Y' },
}

/** Altura máxima de segurança (índice y). */
export const MAX_VOXEL_Y = 512

/** Teto de cubos no mundo para não estourar memória. */
export const MAX_VOXEL_BLOCKS = 400000

/** Pixels de arrasto para não confundir clique com órbita. */
export const CLICK_DRAG_PX = 6

export const BLOCK_SOURCE = {
  BASE: 'base',
  BUILD: 'build',
}
