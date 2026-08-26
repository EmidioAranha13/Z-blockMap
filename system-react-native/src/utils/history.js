/**
 * Histórico de Undo/Redo com teto FIFO.
 *
 * Undo/Redo em si é LIFO (a última ação é a primeira a desfazer),
 * mas a lista tem no máximo `limit` itens: ao passar do limite, o
 * registro mais antigo é descartado (fila FIFO).
 */

/**
 * Empilha um snapshot e descarta o mais antigo se a fila encheu.
 * @template T
 * @param {T[]} stack
 * @param {T} snapshot
 * @param {number} limit
 */
export function pushFifo(stack, snapshot, limit) {
  stack.push(snapshot)
  while (stack.length > limit) {
    stack.shift()
  }
}

/**
 * Cria o controlador de histórico. As pilhas ficam internas;
 * o editor só chama record / undo / redo.
 *
 * @param {number} limit
 * @param {() => unknown} cloneCurrent  Cópia do estado atual (grade)
 * @param {(snapshot: unknown) => void} restore  Aplica um snapshot
 */
export function createHistory(limit, cloneCurrent, restore) {
  const undoStack = []
  const redoStack = []

  /**
   * Grava o estado atual antes de uma mudança confirmada.
   * Qualquer Redo pendente é descartado (ramo novo da linha do tempo).
   */
  function record() {
    pushFifo(undoStack, cloneCurrent(), limit)
    redoStack.length = 0
  }

  /**
   * Volta um passo. O estado atual vai para a pilha de Redo.
   * @returns {boolean} true se havia algo para desfazer
   */
  function undo() {
    if (undoStack.length === 0) return false
    pushFifo(redoStack, cloneCurrent(), limit)
    restore(undoStack.pop())
    return true
  }

  /**
   * Refaz o passo desfeito. O estado atual volta para a pilha de Undo.
   * @returns {boolean}
   */
  function redo() {
    if (redoStack.length === 0) return false
    pushFifo(undoStack, cloneCurrent(), limit)
    restore(redoStack.pop())
    return true
  }

  /**
   * Esvazia as duas filas (usado ao carregar um arquivo).
   */
  function reset() {
    undoStack.length = 0
    redoStack.length = 0
  }

  return {
    record,
    undo,
    redo,
    reset,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    /** Quantidade atual na fila de undo (para a barra de status). */
    undoCount: () => undoStack.length,
    redoCount: () => redoStack.length,
  }
}
