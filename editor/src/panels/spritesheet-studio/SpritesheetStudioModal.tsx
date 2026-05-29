import { useEffect, useRef } from 'react'
import { useEditor } from '../../store/editor-store'
import type { AnimationClipDef, ImageAsset } from '../../types'
import { SpritesheetStudioLayout } from './SpritesheetStudioLayout'
import { useSpritesheetStudioSession } from './useSpritesheetStudioSession'

type SpritesheetStudioBodyProps = Readonly<{
  asset: ImageAsset
  imageAssetId: string
}>

function SpritesheetStudioBody({ asset, imageAssetId }: SpritesheetStudioBodyProps) {
  const { dispatch } = useEditor()
  const session = useSpritesheetStudioSession(asset, (clips: AnimationClipDef[]) => {
    dispatch({ type: 'ASSET_ADD', asset: { ...asset, id: imageAssetId, clips } })
  })
  return <SpritesheetStudioLayout asset={asset} session={session} />
}

export function SpritesheetStudioModal() {
  const { state, dispatch } = useEditor()
  const { open, imageAssetId } = state.spritesheetStudio
  const dialogRef = useRef<HTMLDialogElement>(null)
  const asset = imageAssetId ? state.project?.assets?.[imageAssetId] : undefined
  const visible = open && imageAssetId != null && imageAssetId.length > 0 && asset != null

  useEffect(() => {
    if (!visible) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    return () => {
      if (el.open) el.close()
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      dispatch({ type: 'SPRITESHEET_STUDIO_CLOSE' })
    }
    const onClose = () => dispatch({ type: 'SPRITESHEET_STUDIO_CLOSE' })
    el.addEventListener('cancel', onCancel)
    el.addEventListener('close', onClose)
    return () => {
      el.removeEventListener('cancel', onCancel)
      el.removeEventListener('close', onClose)
    }
  }, [visible, dispatch])

  const closeModal = () => {
    dialogRef.current?.close()
    dispatch({ type: 'SPRITESHEET_STUDIO_CLOSE' })
  }

  if (!visible || !asset) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="spritesheet-studio-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[200] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-4 backdrop:bg-black/60"
    >
      <div className="flex flex-col w-full max-w-[min(96vw,1400px)] h-[min(90vh,820px)] max-h-full rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] shadow-2xl overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0">
            <h2 id="spritesheet-studio-title" className="text-sm font-semibold text-[var(--text)] truncate">
              Spritesheet Studio — {asset.name}
            </h2>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              Clips are saved on this image asset and used by the game runtime on play.
            </p>
          </div>
          <button
            type="button"
            className="text-xs px-3 py-1 rounded border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-2)] shrink-0"
            onClick={closeModal}
          >
            Close
          </button>
        </header>
        <SpritesheetStudioBody asset={asset} imageAssetId={imageAssetId} />
      </div>
    </dialog>
  )
}
