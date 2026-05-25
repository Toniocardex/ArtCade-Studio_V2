import type { LogicBoard } from '../../types/logic-board'

export function logicBoardGeneratedLabel(boardId: string): string {
  return boardId.trim() || 'board'
}

export function logicBoardCompilerLabel(board: LogicBoard): string {
  return board.name?.trim() || logicBoardGeneratedLabel(board.boardId)
}

export function logicBoardLuaCommentLabel(board: LogicBoard): string {
  return logicBoardCompilerLabel(board)
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    .trim() || logicBoardGeneratedLabel(board.boardId)
}
