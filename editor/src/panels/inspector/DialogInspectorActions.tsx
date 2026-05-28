import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { openDialogEditorForId } from '../dialog/DialogEditorModal'

export type DialogInspectorActionsProps = Readonly<{
  entity: EntityDef
}>

export function DialogInspectorActions({ entity }: DialogInspectorActionsProps) {
  const { state, dispatch } = useEditor()
  const dialogId = entity.dialog?.dialogId ?? ''

  return (
    <button
      type="button"
      onClick={() => openDialogEditorForId(dispatch, state.dialogs, dialogId)}
      className="w-full mb-2 px-3 py-1.5 rounded text-xs font-semibold border border-[var(--purple)]/50
                 bg-[rgb(128,0,255,0.08)] text-[var(--purple)] hover:bg-[rgb(128,0,255,0.15)]"
    >
      Edit dialog…
    </button>
  )
}
