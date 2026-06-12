import type { LogicBoard } from '../../types/logic-board'

export function logicBoardGeneratedLabel(boardId: string): string {
  return boardId.trim() || 'board'
}

/**
 * Human default name for a new (or blank-renamed) rulesheet, derived from the
 * target object type ("Player" → "Player rules"). Falls back to the generated
 * boardId label when the target carries no type. The Script editor keeps
 * recognizing the board because the compiler `-- board:` marker and the Lua
 * slice extraction both go through logicBoardCompilerLabel.
 */
export function logicBoardDefaultName(
  board: Pick<LogicBoard, 'boardId' | 'target'>,
): string {
  const typeId =
    board.target.type === 'object_type' ? board.target.objectTypeId?.trim() : ''
  return typeId ? `${typeId} rules` : logicBoardGeneratedLabel(board.boardId)
}

export function logicBoardCompilerLabel(board: LogicBoard): string {
  return board.name?.trim() || logicBoardGeneratedLabel(board.boardId)
}

export function logicBoardLuaCommentLabel(board: LogicBoard): string {
  return logicBoardCompilerLabel(board)
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    .trim() || logicBoardGeneratedLabel(board.boardId)
}
