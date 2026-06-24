import { BookOpen, ExternalLink, Pencil, Plus, X } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { EditorSelect } from '../../components/ui/EditorSelect'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { DialogComponent, EntityDef } from '../../types'
import { compileDialogScript, emptyDialogScript, type DialogScript } from '../../utils/dialog/dialog-script'
import { alertDialog, promptTextInput } from '../../utils/native-dialog'
import { openDialogEditorForId, openDialogLibraryModal } from '../dialog/dialog-modal-api'

export type DialogInspectorActionsProps = Readonly<{
  entity: EntityDef
}>

type DialogNodeOption = Readonly<{
  value: string
  label: string
}>

function sanitizeDialogId(raw: string): string {
  return raw.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
}

function defaultDialogId(entity: EntityDef): string {
  return sanitizeDialogId(`${entity.name || entity.className || 'dialog'}_dialog`) || 'new_dialog'
}

function nodeLabel(nodeId: string, node: Record<string, unknown> | undefined): string {
  const type = typeof node?.type === 'string' ? node.type : 'node'
  if (type === 'say') {
    const text = typeof node?.text === 'string' ? node.text.trim() : ''
    return text ? `${nodeId} - "${text.slice(0, 28)}"` : `${nodeId} - Show text`
  }
  if (type === 'choice') return `${nodeId} - Choice`
  if (type === 'condition') return `${nodeId} - Condition`
  if (type === 'setVariable') return `${nodeId} - Set variable`
  if (type === 'emitEvent') return `${nodeId} - Emit event`
  if (type === 'end') return `${nodeId} - End`
  return `${nodeId} - ${type}`
}

function dialogNodeOptions(script: DialogScript | undefined): DialogNodeOption[] {
  if (!script) return []
  const graph = compileDialogScript(script)
  return Object.keys(graph.nodes)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((nodeId) => ({
      value: nodeId,
      label: nodeLabel(nodeId, graph.nodes[nodeId]),
    }))
}

function IconButton({
  title,
  onClick,
  children,
  disabled = false,
}: Readonly<{
  title: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-bd)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function DialogInspectorActions({ entity }: DialogInspectorActionsProps) {
  const dispatch = useEditorDispatch()
  const dialogs = useEditorSelector((state) => state.dialogs)
  const data: DialogComponent = {
    dialogId: entity.dialog?.dialogId ?? '',
    startNode: entity.dialog?.startNode ?? '',
    textSpeed: entity.dialog?.textSpeed ?? 40,
    triggerMessage: entity.dialog?.triggerMessage ?? '',
  }
  const dialogIds = useMemo(
    () => Object.keys(dialogs).sort((a, b) => a.localeCompare(b)),
    [dialogs],
  )
  const selectedScript = data.dialogId ? dialogs[data.dialogId] : undefined
  const selectedMissing = data.dialogId.length > 0 && !selectedScript
  const nodeOptions = useMemo(() => dialogNodeOptions(selectedScript), [selectedScript])

  function commit(patch: Partial<DialogComponent>) {
    dispatch({
      type: 'ENTITY_SET_COMPONENT',
      entityId: entity.id,
      key: 'dialog',
      value: { ...data, ...patch },
    })
  }

  function createAndAssign(defaultValue = defaultDialogId(entity)) {
    void promptTextInput({
      title: 'New dialog',
      message: 'Dialog ID:',
      defaultValue,
    }).then((rawId) => {
      if (!rawId) return
      const dialogId = sanitizeDialogId(rawId)
      if (!dialogId) {
        void alertDialog('Use letters, numbers, dashes, or underscores for dialog IDs.', {
          title: 'Dialog component',
          kind: 'warning',
        })
        return
      }
      if (!dialogs[dialogId]) {
        dispatch({ type: 'DIALOG_UPSERT', script: emptyDialogScript(dialogId) })
      }
      commit({ dialogId, startNode: '' })
      dispatch({ type: 'DIALOG_SELECT', dialogId })
      dispatch({ type: 'DIALOG_OPEN_MODAL', dialogId })
    })
  }

  function editSelected() {
    if (!data.dialogId) {
      createAndAssign()
      return
    }
    if (!dialogs[data.dialogId]) {
      dispatch({ type: 'DIALOG_UPSERT', script: emptyDialogScript(data.dialogId) })
    }
    openDialogEditorForId(dispatch, dialogs, data.dialogId)
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[9px] text-[var(--muted)] uppercase">Conversation</label>
        <div className="mt-1 flex items-center gap-1.5">
          <EditorSelect
            value={data.dialogId}
            placeholder={dialogIds.length > 0 ? 'Choose conversation' : 'No dialogs yet'}
            onChange={(dialogId) => commit({ dialogId, startNode: '' })}
            options={dialogIds.map((dialogId) => ({ value: dialogId, label: dialogId }))}
            aria-label="Dialog conversation"
          />
          <IconButton title="Create dialog" onClick={() => createAndAssign()}>
            <Plus size={13} />
          </IconButton>
          <IconButton title="Edit dialog" onClick={editSelected}>
            <Pencil size={13} />
          </IconButton>
          <IconButton title="Open dialog library" onClick={() => openDialogLibraryModal(dispatch)}>
            <BookOpen size={13} />
          </IconButton>
        </div>
      </div>

      {!data.dialogId && (
        <div className="rounded border border-[var(--border)] bg-[rgb(var(--border-rgb)/0.12)] p-2 text-[10px] text-[var(--muted)]">
          No conversation assigned.
        </div>
      )}

      {selectedMissing && (
        <div className="rounded border border-[var(--warn)]/60 bg-[rgb(var(--warn-rgb)/0.1)] p-2 text-[10px] text-[var(--warn)]">
          <div className="mb-2">Missing dialog "{data.dialogId}".</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'DIALOG_UPSERT', script: emptyDialogScript(data.dialogId) })
                dispatch({ type: 'DIALOG_OPEN_MODAL', dialogId: data.dialogId })
              }}
              className="inline-flex items-center gap-1 rounded border border-[var(--warn)]/60 px-2 py-1 text-[10px] hover:bg-[rgb(var(--border-rgb)/0.2)]"
            >
              <ExternalLink size={11} />
              Create missing
            </button>
            <button
              type="button"
              onClick={() => commit({ dialogId: '', startNode: '' })}
              className="inline-flex items-center gap-1 rounded border border-[var(--warn)]/60 px-2 py-1 text-[10px] hover:bg-[rgb(var(--border-rgb)/0.2)]"
            >
              <X size={11} />
              Clear
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="text-[9px] text-[var(--muted)] uppercase">Start node</label>
        <EditorSelect
          value={data.startNode ?? ''}
          placeholder="Dialog default"
          disabled={!selectedScript}
          onChange={(startNode) => commit({ startNode })}
          options={[
            { value: '', label: 'Dialog default' },
            ...nodeOptions,
          ]}
          aria-label="Dialog start node"
          triggerClassName="mt-1"
        />
      </div>

      <div>
        <label className="text-[9px] text-[var(--muted)] uppercase">Text speed</label>
        <input
          type="number"
          min={1}
          step={5}
          value={Number.isFinite(data.textSpeed) ? data.textSpeed : 40}
          onChange={(e) => commit({ textSpeed: Math.max(1, Number(e.target.value) || 40) })}
          className="editor-input mt-1"
        />
      </div>
    </div>
  )
}
