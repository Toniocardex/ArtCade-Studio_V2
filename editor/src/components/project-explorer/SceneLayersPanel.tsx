import { useState, useRef } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { DEFAULT_LAYERS } from '../../constants/scene-layers'
import { editorRowSelected } from '../ui/editor-ui-classes'

export function SceneLayersPanel() {
  const dispatch = useEditorDispatch()
  const layers = useEditorSelector((s) => s.project?.layers ?? DEFAULT_LAYERS)
  const selectedLayer = useEditorSelector((s) => s.inspectorLayerName)
  const [addingName, setAddingName] = useState('')
  const [renamingName, setRenamingName] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const name = addingName.trim()
    if (!name) return
    dispatch({ type: 'LAYER_ADD', name })
    setAddingName('')
  }

  function startRename(name: string) {
    setRenamingName(name)
    setRenameValue(name)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  function commitRename() {
    if (renamingName && renameValue.trim()) {
      dispatch({ type: 'LAYER_RENAME', oldName: renamingName, newName: renameValue.trim() })
    }
    setRenamingName(null)
  }

  return (
    <div className="h-full overflow-auto p-2 text-[10px] flex flex-col gap-2">
      <p className="text-[var(--muted)] px-1">
        Render layers — top row drawn last (highest priority).
        Assign entities via Inspector.
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[var(--muted)] uppercase tracking-wide text-[8px]">
            <th className="text-left py-1 pl-1">Layer</th>
            <th className="text-right py-1 pr-1">Order</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {layers.map((layer, idx) => {
            const active = selectedLayer === layer.name
            const renderOrder = (layers.length - idx) * 100
            const isRenaming = renamingName === layer.name

            return (
              <tr
                key={layer.name}
                className={`border-t border-[var(--outline-faint)] group ${
                  active ? editorRowSelected : 'hover:bg-[var(--surface-hover)] text-[var(--primary)]'
                }`}
              >
                <td
                  className="py-1.5 pl-1 cursor-pointer"
                  onClick={() => {
                    if (isRenaming) return
                    const selecting = !active
                    dispatch({
                      type: 'SELECT_INSPECTOR_LAYER',
                      layerName: selecting ? layer.name : null,
                    })
                    if (selecting) {
                      dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerName: layer.name })
                    }
                  }}
                  onDoubleClick={() => startRename(layer.name)}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="w-full bg-[var(--surface-3)] border border-[var(--outline)] text-[var(--text)] px-1 py-0.5 rounded text-[10px]"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                        if (e.key === 'Escape') { e.preventDefault(); setRenamingName(null) }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    layer.name
                  )}
                </td>
                <td className="py-1.5 text-right font-mono pr-1 text-[var(--muted)]">
                  {renderOrder}
                </td>
                <td className="py-1">
                  <span className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 pr-0.5">
                    <button
                      type="button"
                      title="Move up (higher priority)"
                      disabled={idx === 0}
                      onClick={() => dispatch({ type: 'LAYER_MOVE', name: layer.name, direction: 'up' })}
                      className="p-0.5 rounded hover:bg-[var(--surface-3)] text-[var(--muted)] disabled:opacity-30"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      type="button"
                      title="Move down (lower priority)"
                      disabled={idx === layers.length - 1}
                      onClick={() => dispatch({ type: 'LAYER_MOVE', name: layer.name, direction: 'down' })}
                      className="p-0.5 rounded hover:bg-[var(--surface-3)] text-[var(--muted)] disabled:opacity-30"
                    >
                      <ChevronDown size={11} />
                    </button>
                    <button
                      type="button"
                      title={layers.length <= 1 ? 'Cannot delete the last layer' : `Delete layer "${layer.name}"`}
                      disabled={layers.length <= 1}
                      onClick={() => dispatch({ type: 'LAYER_DELETE', name: layer.name })}
                      className="p-0.5 rounded hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-30"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-1 border-t border-[var(--outline-faint)] pt-2 mt-auto">
        <input
          ref={addInputRef}
          className="flex-1 min-w-0 bg-[var(--surface-3)] border border-[var(--outline)] text-[var(--text)] placeholder:text-[var(--muted)] px-2 py-1 rounded text-[10px]"
          placeholder="New layer name…"
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
          }}
        />
        <button
          type="button"
          title="Add layer"
          disabled={!addingName.trim()}
          onClick={handleAdd}
          className="p-1 rounded border border-[var(--outline)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--primary)] disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
