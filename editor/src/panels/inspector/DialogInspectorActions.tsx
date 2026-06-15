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
      className="w-full mb-2 inline-flex items-center justify-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]"
    >
      Edit dialog...
    </button>
  )
}
