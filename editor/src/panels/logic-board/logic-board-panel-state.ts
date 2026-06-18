import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { AuthoringMode } from '../../types/authoring-mode'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import type { LogicBoardCompile } from './useLogicBoardCompile'
import type { LogicBoardEventClipboard } from './useLogicBoardEventClipboard'
import type { LogicBoardRulesheetActions } from './useLogicBoardRulesheetActions'
import type { LogicBoardSelection } from './useLogicBoardSelection'

export type LogicBoardPanelState = Readonly<{
  project: ProjectDoc | null
  panelMode: 'visual' | 'lua'
  setPanelMode: (mode: 'visual' | 'lua') => void
  boards: LogicBoard[]
  dispatch: Dispatch<Action>
  selection: LogicBoardSelection
  compile: LogicBoardCompile
  events: LogicBoardEventClipboard
  rulesheet: LogicBoardRulesheetActions
  authoringMode: AuthoringMode
}>
