import { useEditorDispatch, useEditorStore } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { openDialogEditorForId } from '../dialog/dialog-modal-api'

export type DialogInspectorActionsProps = Readonly<{
  entity: EntityDef
}>

export function DialogInspectorActions({ entity }: DialogInspectorActionsProps) {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const dialogId = entity.dialog?.dialogId ?? ''

  return (
    <button
      type="button"
      onClick={() => openDialogEditorForId(dispatch, store.getState().dialogs, dialogId)}
      className="w-full mb-2 px-3 py-1.5 rounded text-xs font-semibold border border-[var(--purple)]/50
                 bg-[rgb(var(--accent-rgb)/0.08)] text-[var(--purple)] hover:bg-[rgb(var(--accent-rgb)/0.15)]"
    >
      Edit dialog...
    </button>
  )
}
