import { useMemo, useState } from 'react'
import { useEditor } from '../../store/editor-store'
import { importDialogCsv } from '../../utils/dialog/import-dialog-csv'
import { parseDialogGraph } from '../../utils/dialog/dialog-script'
import { confirmDialog, promptTextInput } from '../../utils/native-dialog'

export function DialogLibrarySidebar() {
  const { state, dispatch } = useEditor()
  const [filter, setFilter] = useState('')

  const ids = useMemo(() => {
    const all = Object.keys(state.dialogs).sort((a, b) => a.localeCompare(b))
    const q = filter.trim().toLowerCase()
    return q ? all.filter((id) => id.toLowerCase().includes(q)) : all
  }, [state.dialogs, filter])

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--panel)]">
      <div className="p-2 border-b border-[var(--border)] space-y-2">
        <input
          className="w-full text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg)]"
          placeholder="Search dialogs…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="w-full text-xs py-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]"
          onClick={() => {
            void promptTextInput({
              title: 'New dialog',
              message: 'Dialog ID (e.g. guard):',
              defaultValue: 'new_dialog',
            }).then((id) => {
              if (id) dispatch({ type: 'DIALOG_CREATE', dialogId: id })
            })
          }}
        >
          + New dialog
        </button>
        <label
          htmlFor="dialog-csv-import"
          className="block text-xs text-center cursor-pointer py-1 rounded border border-[var(--border)] hover:bg-[var(--bg)]"
        >
          <span>Import CSV</span>
          <input
            id="dialog-csv-import"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              void f.text().then((text) => {
                const { graphs, errors } = importDialogCsv(text)
                for (const g of graphs) {
                  const { script } = parseDialogGraph(g)
                  dispatch({ type: 'DIALOG_UPSERT', script })
                }
                if (errors.length) {
                  dispatch({
                    type: 'LOG',
                    entry: {
                      id: Date.now(),
                      time: new Date().toLocaleTimeString(),
                      message: `[Dialog] CSV import: ${errors.join('; ')}`,
                      level: 'warn',
                    },
                  })
                }
              })
            }}
          />
        </label>
      </div>

      <ul className="flex-1 overflow-auto p-1">
        {ids.length === 0 ? (
          <li className="text-xs text-[var(--muted)] p-2">No dialogs yet.</li>
        ) : (
          ids.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'DIALOG_SELECT', dialogId: id })}
                className={`w-full text-left text-xs px-2 py-1.5 rounded truncate ${
                  state.selectedDialogId === id
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'hover:bg-[rgb(var(--border-rgb)/0.35)]'
                }`}
              >
                {id}
              </button>
            </li>
          ))
        )}
      </ul>

      {state.selectedDialogId && (
        <div className="p-2 border-t border-[var(--border)] flex flex-col gap-1">
          <button
            type="button"
            className="text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => {
              const fromId = state.selectedDialogId
              if (!fromId) return
              void promptTextInput({
                title: 'Rename dialog',
                message: 'Dialog ID:',
                defaultValue: fromId,
              }).then((toId) => {
                if (!toId || toId === fromId) return
                dispatch({
                  type: 'DIALOG_RENAME',
                  fromId,
                  toId,
                })
              })
            }}
          >
            Rename…
          </button>
          <button
            type="button"
            className="text-[10px] text-[var(--danger)]"
            onClick={() => {
              const id = state.selectedDialogId
              if (!id) return
              void confirmDialog(`Delete dialog "${id}"?`, {
                title: 'Delete dialog',
                kind: 'warning',
              }).then((ok) => {
                if (ok) dispatch({ type: 'DIALOG_DELETE', dialogId: id })
              })
            }}
          >
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}
