// reducers/dialog-reducer — in-memory dialog script library

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { DialogScript } from '../../utils/dialog/dialog-script'
import { emptyDialogScript } from '../../utils/dialog/dialog-script'

function compareDialogId(a: string, b: string): number {
  return a.localeCompare(b)
}

function firstDialogId(dialogs: Record<string, DialogScript>): string | null {
  const ids = Object.keys(dialogs).sort(compareDialogId)
  return ids[0] ?? null
}

export const dialogReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'DIALOG_SET_LIBRARY': {
      const selectedDialogId =
        action.selectedDialogId ??
        state.selectedDialogId ??
        firstDialogId(action.dialogs)
      return {
        ...state,
        dialogs: action.dialogs,
        selectedDialogId,
        dialogModal: { open: false, dialogId: null },
      }
    }
    case 'DIALOG_SELECT':
      return { ...state, selectedDialogId: action.dialogId }
    case 'DIALOG_UPSERT':
      return {
        ...state,
        dialogs: { ...state.dialogs, [action.script.dialogId]: action.script },
        selectedDialogId: action.script.dialogId,
        projectDirty: true,
      }
    case 'DIALOG_CREATE': {
      const id = action.dialogId.trim()
      if (!id || state.dialogs[id]) return state
      return {
        ...state,
        dialogs: { ...state.dialogs, [id]: emptyDialogScript(id) },
        selectedDialogId: id,
        projectDirty: true,
      }
    }
    case 'DIALOG_DELETE': {
      if (!state.dialogs[action.dialogId]) return state
      const { [action.dialogId]: _removed, ...rest } = state.dialogs
      const ids = Object.keys(rest).sort(compareDialogId)
      const selectedDialogId =
        state.selectedDialogId === action.dialogId
          ? (ids[0] ?? null)
          : state.selectedDialogId
      return {
        ...state,
        dialogs: rest,
        selectedDialogId,
        projectDirty: true,
      }
    }
    case 'DIALOG_RENAME': {
      const from = action.fromId.trim()
      const to = action.toId.trim()
      if (!from || !to || from === to || !state.dialogs[from]) return state
      if (state.dialogs[to]) return state
      const script: DialogScript = {
        ...state.dialogs[from],
        dialogId: to,
      }
      const { [from]: _old, ...rest } = state.dialogs
      return {
        ...state,
        dialogs: { ...rest, [to]: script },
        selectedDialogId:
          state.selectedDialogId === from ? to : state.selectedDialogId,
        dialogModal:
          state.dialogModal.dialogId === from
            ? { ...state.dialogModal, dialogId: to }
            : state.dialogModal,
        projectDirty: true,
      }
    }
    case 'DIALOG_OPEN_MODAL':
      return {
        ...state,
        dialogModal: { open: true, dialogId: action.dialogId },
        selectedDialogId: action.dialogId,
      }
    case 'DIALOG_CLOSE_MODAL':
      return {
        ...state,
        dialogModal: { open: false, dialogId: null },
      }
    default:
      return state
  }
}
