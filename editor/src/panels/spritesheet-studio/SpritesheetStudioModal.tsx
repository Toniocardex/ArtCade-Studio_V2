import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useDraggablePanel } from './useDraggablePanel'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { AnimationClipDef, CollisionProfileDef, ImageAsset } from '../../types'
import { dirName } from '../../utils/project'
import { importImageAssetFromFile } from '../../utils/image-asset-import'
import { DuplicateAssetImportError } from '../../utils/asset-file-api'
import { contentHashesForAssetKind } from '../../utils/asset-duplicate-detect'
import { alertDialog } from '../../utils/native-dialog'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import {
  getCollisionProfile,
  getOrCreateCollisionProfile,
  inferProfileRoleForAsset,
} from '../../utils/collision-profile'
import { SpritesheetStudioLayout, type SpritesheetStudioMode } from './SpritesheetStudioLayout'
import { useSpritesheetStudioSession } from './useSpritesheetStudioSession'
import { useSpritesheetWasmSync } from './useSpritesheetWasmSync'
import { useAuthoringCommands } from '../../authoring/useAuthoringCommands'

type SpritesheetStudioBodyProps = Readonly<{
  asset: ImageAsset
  imageAssetId: string
  initialMode?: SpritesheetStudioMode
  autoCreateDraft: boolean
  onAutoCreateDraftConsumed: () => void
  onNewAnimation: () => void
}>

function SpritesheetStudioBody({
  asset,
  imageAssetId,
  initialMode = 'animations',
  autoCreateDraft,
  onAutoCreateDraftConsumed,
  onNewAnimation,
}: SpritesheetStudioBodyProps) {
  const dispatch = useEditorDispatch()
  const authoring = useAuthoringCommands()
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const [mode, setMode] = useState<SpritesheetStudioMode>(initialMode)
  const [activeShapeIndex, setActiveShapeIndex] = useState(0)
  useSpritesheetWasmSync(asset, true)
  const session = useSpritesheetStudioSession(
    asset,
    projectPath,
    (clips: AnimationClipDef[], coalesceKey?: string) => {
      authoring.setImageAssetClips(imageAssetId, clips, coalesceKey)
    },
  )
  const patchAsset = (patch: Partial<ImageAsset>) => {
    authoring.patchImageAsset(imageAssetId, patch)
  }

  const profile = project
    ? getCollisionProfile(project, imageAssetId)
      ?? getOrCreateCollisionProfile(
        project,
        imageAssetId,
        asset.name,
        inferProfileRoleForAsset(project, imageAssetId),
      )
    : getOrCreateCollisionProfile(
      { projectName: '', version: '1', targetFPS: 60, activeSceneId: '', mainScriptPath: '', entities: {}, scenes: {} },
      imageAssetId,
      asset.name,
    )

  const commitProfile = (next: CollisionProfileDef, coalesceKey?: string) => {
    dispatch({
      type: 'COLLISION_PROFILE_SET',
      assetId: imageAssetId,
      profile: next,
      coalesceKey,
    })
  }

  useEffect(() => {
    setMode(initialMode)
  }, [imageAssetId, initialMode])

  useEffect(() => {
    if (mode !== 'collision' || !project) return
    if (getCollisionProfile(project, imageAssetId)) return
    commitProfile(
      getOrCreateCollisionProfile(
        project,
        imageAssetId,
        asset.name,
        inferProfileRoleForAsset(project, imageAssetId),
      ),
    )
  }, [mode, project, imageAssetId, asset.name])

  useEffect(() => {
    if (!autoCreateDraft) return
    if (session.grid.totalFrames <= 0 || session.clips.length > 0 || session.draftClip) return
    session.selectAllFrames()
    onAutoCreateDraftConsumed()
  }, [
    autoCreateDraft,
    session.grid.totalFrames,
    session.clips.length,
    session.draftClip,
    session.selectAllFrames,
    onAutoCreateDraftConsumed,
  ])

  return (
    <>
      <div className="shrink-0 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel-2)]">
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as SpritesheetStudioMode)}
          aria-label="Sprite Studio mode"
          options={[
            { value: 'animations', label: 'Animations' },
            { value: 'collision', label: 'Collision' },
          ]}
        />
      </div>
      <SpritesheetStudioLayout
        asset={asset}
        assetId={imageAssetId}
        project={project}
        mode={mode}
        session={session}
        profile={profile}
        activeShapeIndex={activeShapeIndex}
        onSelectShape={setActiveShapeIndex}
        onPatchDefaultPivot={(defaultPivot) => patchAsset({ defaultPivot })}
        onPatchProfile={(next) => commitProfile(next, `collision:${imageAssetId}`)}
        onNewAnimation={onNewAnimation}
      />
    </>
  )
}

export function SpritesheetStudioModal() {
  const dispatch = useEditorDispatch()
  const open = useEditorSelector((s) => s.spritesheetStudio.open)
  const imageAssetId = useEditorSelector((s) => s.spritesheetStudio.imageAssetId)
  const initialMode = useEditorSelector((s) => s.spritesheetStudio.initialMode)
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const animationAssetInputRef = useRef<HTMLInputElement>(null)
  const [autoDraftAssetId, setAutoDraftAssetId] = useState<string | null>(null)
  const asset = imageAssetId ? project?.assets?.[imageAssetId] : undefined
  const visible = open && imageAssetId != null && imageAssetId.length > 0 && asset != null
  const { panelStyle, resetPosition, headerPointerProps } = useDraggablePanel(panelRef, visible)

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

  const openAnimationAssetPicker = () => {
    animationAssetInputRef.current?.click()
  }

  const onPickAnimationAsset = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !project) return

    void (async () => {
      try {
        const { asset: importedAsset } = await importImageAssetFromFile({
          file,
          usage: 'sprite',
          projectRoot: projectPath ? dirName(projectPath) : null,
          rejectContentHashes: contentHashesForAssetKind(project, 'image'),
        })
        dispatch({ type: 'ASSET_ADD', asset: importedAsset })
        dispatch({
          type: 'SELECT_INSPECTOR_ASSET',
          asset: { type: 'image', id: importedAsset.id },
        })
        setAutoDraftAssetId(importedAsset.id)
        dispatch({ type: 'SPRITESHEET_STUDIO_OPEN', imageAssetId: importedAsset.id })
      } catch (err) {
        if (err instanceof DuplicateAssetImportError) {
          await alertDialog(`"${file.name}" has already been imported.`, {
            title: 'Asset already imported',
            kind: 'warning',
          })
          return
        }
        console.error('[Sprite Studio] Animation image import failed:', err)
      }
    })()
  }

  if (!visible || !asset) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="spritesheet-studio-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[200] m-0 h-full max-h-full w-full max-w-full border-0 bg-transparent p-0 backdrop:bg-black/60"
    >
      <input
        ref={animationAssetInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickAnimationAsset}
      />
      <div
        ref={panelRef}
        className="fixed flex flex-col w-[min(96vw,1400px)] h-[min(90vh,820px)] max-h-[calc(100vh-16px)] rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] shadow-2xl overflow-hidden"
        style={panelStyle}
        data-testid="spritesheet-studio-panel"
      >
        <header
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] cursor-grab active:cursor-grabbing select-none touch-none"
          {...headerPointerProps}
        >
          <div className="flex-1 min-w-0">
            <h2 id="spritesheet-studio-title" className="text-sm font-semibold text-[var(--text)] truncate">
              Sprite Studio — {asset.name}
            </h2>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              Drag this bar to move the window. Clips are saved on this image asset and used by the
              game runtime on play.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="text-xs px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)] hover:text-[var(--text)]"
              onClick={resetPosition}
              title="Move the window back to the center of the screen"
            >
              Reset position
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1 rounded border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-2)]"
              onClick={closeModal}
            >
              Close
            </button>
          </div>
        </header>
        <SpritesheetStudioBody
          asset={asset}
          imageAssetId={imageAssetId}
          initialMode={initialMode ?? 'animations'}
          autoCreateDraft={autoDraftAssetId === imageAssetId}
          onAutoCreateDraftConsumed={() => setAutoDraftAssetId(null)}
          onNewAnimation={openAnimationAssetPicker}
        />
      </div>
    </dialog>
  )
}
