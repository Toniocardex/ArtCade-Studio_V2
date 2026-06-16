import { useEffect, useRef } from 'react'
import { useDraggablePanel, TILESET_STORAGE_KEY } from '../spritesheet-studio/useDraggablePanel'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { TilePalettePanel } from './TilePalettePanel'
import { editorSetTilePaintMode, editorSetSelectedTile } from '../../utils/wasm-bridge'

// ---------------------------------------------------------------------------
// TilesetEditorModal — palette picker for the tilemap paint mode.
//
// Opens when store.editingTilesetId is set (via TILESET_EDIT_OPEN).
// While open, the WASM canvas becomes the active painting surface:
//   • editorSetTilePaintMode(true) activates tile paint mode in C++
//   • The React TilePaintOverlay (in PreviewPanel) intercepts pointer events
//     on the WASM canvas and fans-out to both Redux and editorPaintTile()
//
// The dialog uses pointer-events:none so clicks pass through to the WASM
// canvas behind it. The panel itself restores pointer-events:auto so it
// remains interactive.
//
//  ┌──────────────────────────────────────────┐
//  │  Tileset Studio — <name>  [Reset] [Close] │ ← draggable
//  ├──────────────────────────────────────────┤
//  │  TilePalettePanel (tile grid picker)      │
//  │  LMB draw · RMB erase · drag on canvas   │
//  └──────────────────────────────────────────┘
// ---------------------------------------------------------------------------

export function TilesetEditorModal() {
  const dispatch         = useEditorDispatch()
  const editingTilesetId = useEditorSelector((s) => s.editingTilesetId)
  const project          = useEditorSelector((s) => s.project)
  const selectedTileCell = useEditorSelector((s) => s.selectedTileCell)

  const tileset   = editingTilesetId ? project?.tilesets?.[editingTilesetId] : undefined
  const visible   = Boolean(editingTilesetId && tileset)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef  = useRef<HTMLDivElement>(null)
  const { panelStyle, resetPosition, headerPointerProps } = useDraggablePanel(
    panelRef,
    visible,
    TILESET_STORAGE_KEY,
  )

  // Show / hide the <dialog>
  useEffect(() => {
    if (!visible) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    return () => { if (el.open) el.close() }
  }, [visible])

  // Handle ESC / native close
  useEffect(() => {
    if (!visible) return
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      dispatch({ type: 'TILESET_EDIT_CLOSE' })
    }
    const onClose = () => dispatch({ type: 'TILESET_EDIT_CLOSE' })
    el.addEventListener('cancel', onCancel)
    el.addEventListener('close',  onClose)
    return () => {
      el.removeEventListener('cancel', onCancel)
      el.removeEventListener('close',  onClose)
    }
  }, [visible, dispatch])

  // Activate tile paint mode in WASM when modal is open.
  useEffect(() => {
    if (!visible) return
    editorSetTilePaintMode(true)
    return () => editorSetTilePaintMode(false)
  }, [visible])

  // Keep C++ brush in sync with the palette selection.
  useEffect(() => {
    if (!visible) return
    editorSetSelectedTile(selectedTileCell)
  }, [visible, selectedTileCell])

  function closeModal() {
    dialogRef.current?.close()
    dispatch({ type: 'TILESET_EDIT_CLOSE' })
  }

  if (!visible || !tileset) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="tileset-studio-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[200] m-0 h-full max-h-full w-full max-w-full border-0 bg-transparent p-0 pointer-events-none backdrop:bg-black/30 backdrop:pointer-events-none"
    >
      <div
        ref={panelRef}
        className="fixed flex flex-col w-[min(96vw,1400px)] h-[min(90vh,820px)] rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] shadow-2xl overflow-hidden pointer-events-auto"
        style={panelStyle}
        data-testid="tileset-studio-panel"
      >
        {/* Draggable header */}
        <header
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] cursor-grab active:cursor-grabbing select-none touch-none"
          {...headerPointerProps}
        >
          <div className="flex-1 min-w-0">
            <h2 id="tileset-studio-title" className="text-sm font-semibold text-[var(--text)] truncate">
              Tileset Studio — {tileset.name}
            </h2>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              Pick a tile, then paint directly on the canvas.
              LMB draw · RMB erase · drag this bar to move.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={resetPosition}
              title="Move the window back to the center of the screen"
              className="text-xs px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)] hover:text-[var(--text)]"
            >
              Reset position
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="text-xs px-3 py-1 rounded border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-2)]"
            >
              Close
            </button>
          </div>
        </header>

        {/* Palette only — painting happens on the WASM canvas behind the dialog */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <TilePalettePanel
            tileset={tileset}
            onRemove={() => {
              dispatch({ type: 'TILESET_ASSET_REMOVE', assetId: tileset.assetId })
              closeModal()
            }}
          />
        </div>
      </div>
    </dialog>
  )
}
