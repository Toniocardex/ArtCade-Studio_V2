import { useLayoutEffect, useState, useRef } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { DEFAULT_LAYERS } from '../../constants/scene-layers'
import { editorRowSelected } from '../ui/editor-ui-classes'
import { handleControlledInputKeyDown } from '../../utils/keyboard'

export function SceneLayersPanel() {
  const dispatch = useEditorDispatch()
  const layers = useEditorSelector((s) => s.project?.layers ?? DEFAULT_LAYERS)
  const selectedLayer = useEditorSelector((s) => s.inspectorLayerName)
  const [addingName, setAddingName] = useState('')
  const [renamingName, setRenamingName] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (renamingName) renameInputRef.current?.select()
  }, [renamingName])

  function handleAdd() {
    const name = addingName.trim()
    if (!name) return
    dispatch({ type: 'LAYER_ADD', name })
    setAddingName('')
    addInputRef.current?.focus()
  }

  function startRename(name: string) {
    setRenamingName(name)
    setRenameValue(name)
  }

  function commitRename() {
    if (renamingName && renameValue.trim()) {
      dispatch({ type: 'LAYER_RENAME', oldName: renamingName, newName: renameValue.trim() })
    }
    setRenamingName(null)
  }

  return (
    <div className="h-full flex flex-col text-[10px] overflow-hidden">

      {/* CTA — sempre in alto, come gli altri moduli */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--outline-faint)] shrink-0">
        <input
          ref={addInputRef}
          className="flex-1 min-w-0 bg-[var(--surface-3)] border border-[var(--outline)] text-[var(--text)] placeholder:text-[var(--muted)] px-2 py-1 rounded text-[10px]"
          placeholder="New layer name…"
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
            handleControlledInputKeyDown(e, setAddingName)
          }}
        />
        <button
          type="button"
          title="Add layer (Enter)"
          disabled={!addingName.trim()}
          onClick={handleAdd}
          className="shrink-0 p-1 rounded border border-[var(--outline)] bg-[var(--surface-2)] text-[var(--primary-soft)] hover:text-[var(--primary)] hover:border-[var(--outline-strong)] disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[var(--muted)] uppercase tracking-wide text-[8px]">
              <th className="text-left py-1 pl-2">Layer</th>
              <th className="text-right py-1 pr-1 w-12">Order</th>
              <th className="w-20" />
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
                    className="py-1.5 pl-2 cursor-pointer"
                    onClick={() => {
                      if (isRenaming) return
                      const selecting = !active
                      dispatch({ type: 'SELECT_INSPECTOR_LAYER', layerName: selecting ? layer.name : null })
                      if (selecting) dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerName: layer.name })
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
                          handleControlledInputKeyDown(e, setRenameValue)
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
                  <td className="py-1 pr-1">
                    <span className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        title="Move up (higher priority)"
                        disabled={idx === 0}
                        onClick={() => dispatch({ type: 'LAYER_MOVE', name: layer.name, direction: 'up' })}
                        className="p-0.5 rounded hover:bg-[var(--surface-3)] text-[var(--primary-soft)] hover:text-[var(--primary)] disabled:opacity-20"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        title="Move down (lower priority)"
                        disabled={idx === layers.length - 1}
                        onClick={() => dispatch({ type: 'LAYER_MOVE', name: layer.name, direction: 'down' })}
                        className="p-0.5 rounded hover:bg-[var(--surface-3)] text-[var(--primary-soft)] hover:text-[var(--primary)] disabled:opacity-20"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        type="button"
                        title={layers.length <= 1 ? 'Cannot delete the last layer' : `Delete "${layer.name}"`}
                        disabled={layers.length <= 1}
                        onClick={() => dispatch({ type: 'LAYER_DELETE', name: layer.name })}
                        className="p-0.5 rounded hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-20"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="px-2 pt-2 pb-1 text-[9px] text-[var(--muted)] leading-relaxed">
          Top row = highest render priority. Double-click a name to rename.
        </p>
      </div>
    </div>
  )
}
