import { useMemo, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Film, RotateCcw, Upload } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { PivotPresetFields } from '../../components/pivot/PivotPresetFields'
import { resolveClipForEntity } from '../../utils/entity-clip-resolve'
import { openSpritesheetStudio } from '../spritesheet-studio/openSpritesheetStudio'
import {
  findImageAssetByPath,
  resolveEffectivePivot,
  spriteAssignedFromAsset,
  spriteInheritingAssetPivot,
  spriteWithPivotOverride,
  usesAssetPivot,
} from '../../utils/sprite-pivot-resolve'
import { formatPivotLabel } from '../../utils/sprite-pivot'
import {
  isGeneratedPrototypeAsset,
  promotePrototypeAssetToImported,
  prototypeHasUserEdits,
} from '../../utils/prototype-sprite'
import { findSceneInstance } from '../../utils/project-object-types'
import { imageAssetForRef } from '../../utils/sprite-asset-ref'
import { confirmDialog, alertDialog } from '../../utils/native-dialog'
import { editorInvalidateAsset } from '../../utils/wasm-bridge'
import { InspectorSection, NumberField } from './inspector-fields'
import { InspectorClipPreview } from './InspectorClipPreview'
import { SpriteFillColorField } from './SpriteFillColorField'
import { EditorSelect } from '../../components/ui/EditorSelect'

export type SpriteSectionProps = Readonly<{
  entity: EntityDef
}>

export function SpriteSection({ entity }: SpriteSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const images = Object.values(project?.assets ?? {}).filter((asset) => asset.usage === 'sprite')
  const assetSelectId = `${entity.id}-sprite-asset`
  const [overrideOpen, setOverrideOpen] = useState(false)

  const clip = useMemo(
    () => resolveClipForEntity(project, entity.id, entity),
    [project, entity],
  )
  const spriteRef = clip?.spritePath ?? entity.sprite.spriteAssetId ?? ''
  const linkedAsset = project
    ? (imageAssetForRef(project, spriteRef) ?? findImageAssetByPath(project.assets, spriteRef))
    : undefined
  const isPrototype = isGeneratedPrototypeAsset(linkedAsset)
  const ownerTypeId =
    (project ? findSceneInstance(project, entity.id)?.instance.objectTypeId : undefined)
    ?? entity.className
  const objectType = project?.objectTypes?.[ownerTypeId]
  const typeId = ownerTypeId
  const typeName = objectType?.displayName ?? entity.name
  const sheetClips = clip?.clips ?? []
  const activeDefaultClip = sheetClips.find((c) => c.name === clip?.defaultClip)
  const effectivePivot = resolveEffectivePivot(entity.sprite, project?.assets)
  const fromAsset = usesAssetPivot(entity.sprite)
  const defaultClipId = `${entity.id}-default-clip`
  const playOnSpawnId = `${entity.id}-play-clip-on-spawn`

  function commitSprite(patch: Partial<EntityDef['sprite']>) {
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: entity.id,
      sprite: { ...entity.sprite, ...patch },
    })
  }

  const pivotSummary = fromAsset
    ? `From sheet — ${formatPivotLabel(effectivePivot)}`
    : `Override — ${formatPivotLabel(entity.sprite.pivot)}`

  const onPromotePrototype = useCallback(async () => {
    if (!linkedAsset || !isPrototype || !project) return
    const ok = await confirmDialog(
      'Promote writes this prototype to the project as a real PNG sprite file.\n\n'
      + 'Animation clips and collision shapes on this sheet are kept.',
      { title: 'Promote prototype sprite', kind: 'info' },
    )
    if (!ok) return
    try {
      const oldPath = linkedAsset.path
      const promoted = await promotePrototypeAssetToImported({
        asset: linkedAsset,
        projectRoot: projectPath,
        displayName: typeName,
      })
      dispatch({ type: 'ASSET_ADD', asset: promoted })
      if (oldPath !== promoted.path) {
        editorInvalidateAsset(oldPath, 'image')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Promote failed.'
      await alertDialog(message, { title: 'Promote prototype sprite', kind: 'error' })
    }
  }, [dispatch, isPrototype, linkedAsset, project, projectPath, typeName])

  const onResetPrototype = useCallback(async () => {
    if (!linkedAsset || !isPrototype || !project) return
    if (prototypeHasUserEdits(project, linkedAsset)) {
      const ok = await confirmDialog(
        'Reset restores the default colored rectangle and removes clips, '
        + 'collision shapes, and color edits on this prototype.',
        { title: 'Reset prototype sprite', kind: 'warning' },
      )
      if (!ok) return
    }
    dispatch({
      type: 'IMAGE_ASSET_RESET_PROTOTYPE',
      assetId: linkedAsset.id,
      typeId,
      typeName,
    })
    editorInvalidateAsset(linkedAsset.path, 'image')
  }, [dispatch, isPrototype, linkedAsset, project, typeId, typeName])

  return (
    <InspectorSection label="Sprite">
      <div className="mb-2">
        <label htmlFor={assetSelectId} className="text-[9px] text-[var(--muted)] uppercase">
          Asset
        </label>
        <EditorSelect
          id={assetSelectId}
          value={entity.sprite.spriteAssetId ?? ''}
          onChange={(assetId) => {
            const img = assetId
              ? (project?.assets?.[assetId]
                ?? images.find((a) => a.id === assetId))
              : undefined
            commitSprite(
              assetId
                ? spriteAssignedFromAsset(entity.sprite, img, project)
                : { ...entity.sprite, spriteAssetId: null, defaultClip: undefined, playClipOnSpawn: false },
            )
          }}
          triggerClassName="py-1"
          options={[
            { value: '', label: '(none)' },
            ...(entity.sprite.spriteAssetId &&
            !images.some((a) => a.id === entity.sprite.spriteAssetId)
              ? [{
                  value: entity.sprite.spriteAssetId,
                  label: `${entity.sprite.spriteAssetId} (missing)`,
                }]
              : []),
            ...images.map((a) => ({
              value: a.id,
              label: a.name,
            })),
          ]}
        />
        {isPrototype ? (
          <div className="mt-1.5 space-y-1">
            <p className="text-[8px] text-[var(--accent)] leading-snug">
              Prototype sprite — edit color below, open Studio for clips, or promote to a real file.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-2 py-1 text-[9px] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
                onClick={() => void onPromotePrototype()}
                title="Write prototype pixels to assets/images/ as an imported sprite"
              >
                <Upload size={11} />
                Promote
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[9px] text-[var(--text)] hover:border-[var(--border-2)]"
                onClick={() => void onResetPrototype()}
                title="Restore factory rectangle and clear Studio edits"
              >
                <RotateCcw size={11} />
                Reset prototype
              </button>
            </div>
          </div>
        ) : null}
        {images.length === 0 && (
          <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
            Import images in the ASSETS panel, then pick one here.
          </p>
        )}
      </div>

      <div className="mb-2">
        <label htmlFor={defaultClipId} className="text-[9px] text-[var(--muted)] uppercase">
          Default clip
        </label>
        <EditorSelect
          id={defaultClipId}
          disabled={!spriteRef || sheetClips.length === 0}
          value={clip?.defaultClip ?? entity.sprite.defaultClip ?? ''}
          onChange={(name) => {
            const defaultClip = name || undefined
            commitSprite({
              defaultClip,
              playClipOnSpawn: defaultClip ? entity.sprite.playClipOnSpawn === true : false,
            })
          }}
          className="mt-1 w-full"
          triggerClassName="py-1"
          options={[
            { value: '', label: '(none)' },
            ...sheetClips.map((c) => ({ value: c.name, label: c.name })),
          ]}
        />
        {!spriteRef ? (
          <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
            Assign a sprite sheet first.
          </p>
        ) : sheetClips.length === 0 ? (
          <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
            Open Sprite Studio on this sheet to add clips.
          </p>
        ) : null}
        {linkedAsset && clip?.defaultClip ? (
          <InspectorClipPreview asset={linkedAsset} clipName={clip.defaultClip} />
        ) : null}
        {linkedAsset ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {sheetClips.length > 0 ? (
              <span className="text-[8px] text-[var(--muted)] leading-tight">
                {activeDefaultClip
                  ? `${activeDefaultClip.frames.length} frames / ${activeDefaultClip.fps} FPS`
                  : `${sheetClips.length} clips`}
              </span>
            ) : null}
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-2 py-1 text-[9px] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
              onClick={() => openSpritesheetStudio(dispatch, project, linkedAsset.id)}
              title="Open Sprite Studio for this sheet"
            >
              <Film size={12} />
              Studio
            </button>
            {entity.collisionBody ? (
              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[9px] text-[var(--text)] hover:border-[var(--border-2)]"
                onClick={() => openSpritesheetStudio(dispatch, project, linkedAsset.id, 'collision')}
              >
                Collision
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <label
        htmlFor={playOnSpawnId}
        className={`flex items-center gap-2 text-[10px] mb-2 ${
          clip?.defaultClip ? 'text-[var(--text)]' : 'text-[var(--muted)]'
        }`}
      >
        <input
          id={playOnSpawnId}
          type="checkbox"
          disabled={!clip?.defaultClip}
          checked={entity.sprite.playClipOnSpawn === true}
          onChange={(e) => commitSprite({ playClipOnSpawn: e.target.checked })}
        />
        Play on spawn
      </label>
      {entity.sprite.playClipOnSpawn && clip?.defaultClip ? (
        <p className="text-[8px] text-[var(--muted)] mb-2 leading-snug -mt-1">
          Starts this clip when the entity enters play without a Logic Board rule. Logic Board can still call Play animation.
        </p>
      ) : null}

      <SpriteFillColorField
        entity={entity}
        linkedAsset={linkedAsset}
        isPrototype={isPrototype}
      />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <NumberField
          label="Alpha"
          value={entity.sprite.alpha}
          onCommit={(v) => commitSprite({ alpha: Math.min(1, Math.max(0, v)) })}
        />
        <NumberField
          label="Render Order"
          value={entity.sprite.renderOrder}
          onCommit={(v) => commitSprite({ renderOrder: Math.round(v) })}
        />
      </div>

      <div className="mb-2 rounded border border-[var(--border)] bg-[var(--panel-3)] p-2">
        <p className="text-[9px] text-[var(--muted)] uppercase mb-1">Pivot</p>
        <p className="text-[10px] text-[var(--text)] mb-2">{pivotSummary}</p>
        {fromAsset && linkedAsset ? (
          <p className="text-[8px] text-[var(--muted)] mb-2 leading-snug">
            Edit the default on this sheet in Sprite Studio.
          </p>
        ) : null}
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--text)] w-full text-left"
          aria-expanded={overrideOpen}
          onClick={() => setOverrideOpen((o) => !o)}
        >
          {overrideOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Override pivot (advanced)
        </button>
        {overrideOpen ? (
          <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-2">
            <PivotPresetFields
              pivot={fromAsset ? effectivePivot : entity.sprite.pivot}
              onChange={(pivot) => commitSprite(spriteWithPivotOverride(entity.sprite, pivot))}
              compact
            />
            {!fromAsset ? (
              <button
                type="button"
                className="text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => commitSprite(spriteInheritingAssetPivot(entity.sprite))}
              >
                Reset to sheet default
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </InspectorSection>
  )
}
