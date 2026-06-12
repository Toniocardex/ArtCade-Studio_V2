import { useEditorDispatch, useEditorStore } from '../../store/editor-store'
import { openDialogEditorForId } from '../../panels/dialog/dialog-modal-api'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import type { ParamFieldMeta } from '../../utils/logic-board/schema-registry'

const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] text-[var(--muted)]'

function asParamString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  return fallback
}

export type DialogIdFieldProps = Readonly<{
  kind: ComponentKind
  type: string
  name: string
  meta: ParamFieldMeta
  value: unknown
  onPatch: (key: string, val: unknown) => void
  label: string
}>

/** startDialog dialogId — opens modal editor (must be a React component for hooks). */
export function DialogIdField({
  meta,
  value,
  onPatch,
  label,
}: DialogIdFieldProps) {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const dialogId = asParamString(value)

  return (
    <span className="flex items-center gap-2 flex-wrap">
      <span className={lbl}>{label}</span>
      <input
        className={`${inp} w-40`}
        value={dialogId}
        placeholder={meta.placeholder ?? 'innkeeper'}
        onChange={(e) => onPatch('dialogId', e.target.value)}
      />
      <button
        type="button"
        className="text-[10px] px-2 py-1 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
        onClick={() => openDialogEditorForId(dispatch, store.getState().dialogs, dialogId)}
      >
        Edit dialog…
      </button>
    </span>
  )
}
