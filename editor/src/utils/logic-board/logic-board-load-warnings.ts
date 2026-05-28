import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store-state'
import type { ConsoleEntry } from '../../types'
import type { LogicBoardLoadIssue } from '../../types/logic-board'
import { formatLogicBoardLoadIssuesMessage } from './factory'

/** Surface parse-time Logic Board issues in the editor console after project open. */
export function dispatchLogicBoardLoadWarnings(
  dispatch: Dispatch<Action>,
  issues: LogicBoardLoadIssue[] | undefined,
  makeEntry: (message: string, level: ConsoleEntry['level']) => ConsoleEntry,
): void {
  if (!issues?.length) return
  for (const issue of issues) {
    dispatch({
      type: 'LOG',
      entry: makeEntry(
        `[Logic Board] Board "${issue.boardId}" event #${issue.eventIndex + 1}: ${issue.errors.join('; ')}`,
        'warn',
      ),
    })
  }
  const summary = formatLogicBoardLoadIssuesMessage(issues)
  if (summary) {
    dispatch({ type: 'LOG', entry: makeEntry(`[Logic Board] ${summary}`, 'warn') })
  }
}
