// ---------------------------------------------------------------------------
// Per-board configuration warnings (trigger/target, clickToDestroy placement).
// Does not replace compile-time errors — surfaces issues visible before emit.
// ---------------------------------------------------------------------------

import type { LogicBoard } from '../../types/logic-board'
import { findClickToDestroyErrors } from './click-to-destroy'
import { findBoardCompatibilityErrors } from './trigger-compatibility'

export function boardConfigurationWarnings(board: LogicBoard): string[] {
  const lines: string[] = []
  for (const err of findBoardCompatibilityErrors(board)) {
    lines.push(err.message)
  }
  for (const err of findClickToDestroyErrors(board)) {
    lines.push(err.message)
  }
  return lines
}

export function boardConfigurationSummary(board: LogicBoard): string | null {
  const lines = boardConfigurationWarnings(board)
  return lines.length > 0 ? lines.join('\n') : null
}
