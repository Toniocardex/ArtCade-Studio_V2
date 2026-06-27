import { useEffect, useState } from 'react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { sourcesUsedOnLayer } from '../../utils/tilemap-layer-sources'
import {
  DEFAULT_LAYERS,
  layerLocked,
  layerOpacity,
  layerParallax,
  layerVisible,
  sceneLayerSettings,
} from '../../constants/scene-layers'
import { EditorSelect, type EditorSelectOption } from '../../components/ui/EditorSelect'
import type { LayerBackground, LayerId, LayerParallax } from '../../types'

export type LayerSettingsSectionProps = Readonly<{
  layerId: LayerId
  sceneName: string | undefined
}>

const inputClass =
  'w-16 bg-[var(--surface-3)] border border-[var(--outline)] text-[var(--text)] px-1.5 py-0.5 rounded text-[10px]'
const labelClass = 'text-[11px] text-[var(--muted)]'

/** Number input with a local buffer so partial edits ('-', '1.') don't snap. */
function NumField({
  label, value, step = 0.1, onCommit,
}: Readonly<{ label: string; value: number; step?: number; onCommit: (n: number) => void }>) {
  const [buf, setBuf] = useState(String(value))
  useEffect(() => { setBuf(String(value)) }, [value])
  return (
    <label className="flex flex-col gap-0.5">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        step={step}
        value={buf}
        onChange={(e) => {
          setBuf(e.target.value)
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onCommit(n)
        }}
        className={inputClass}
      />
    </label>
  )
}

const NO_BACKGROUND: LayerBackground = {
  imageId: '', tileX: true, tileY: true, scrollX: 0, scrollY: 0,
}

export function LayerSettingsSection({ layerId, sceneName }: LayerSettingsSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const sceneId = useEditorSelector((s) => s.selection.sceneId ?? s.project?.activeSceneId)
  const scene = sceneId ? project?.scenes?.[sceneId] : undefined
  const tilemapLayer = scene?.tilemapLayers?.[layerId]
  const usedIds = tilemapLayer ? sourcesUsedOnLayer(tilemapLayer) : []

  const renderLayer =
    (project?.layers ?? DEFAULT_LAYERS).find((l) => l.id === layerId)
  const layerName = renderLayer?.name ?? layerId
  const settings = sceneLayerSettings(scene, layerId)
  const parallax = layerParallax(settings)
  const visible = layerVisible(settings)
  const locked = layerLocked(renderLayer ?? {})
  const opacity = layerOpacity(settings)
  const bg = settings.background ?? NO_BACKGROUND

  const updateSettings = (patch: Partial<import('../../types').SceneLayerSettings>) => {
    if (!sceneId) return
    dispatch({ type: 'SCENE_LAYER_SETTINGS_UPDATE', sceneId, layerId, patch })
  }
  const updateParallax = (patch: Partial<LayerParallax>) =>
    updateSettings({ parallax: { ...parallax, ...patch } })
  const updateBg = (patch: Partial<LayerBackground>) =>
    updateSettings({ background: { ...bg, ...patch } })

  const imageOptions: EditorSelectOption[] = [
    { value: '', label: 'None' },
    ...Object.values(project?.assets ?? {}).map((a) => ({ value: a.id, label: a.name })),
  ]
  const hasBackground = bg.imageId.trim().length > 0

  return (
    <div className="space-y-3 text-[10px] text-[var(--primary-soft)]">
      <p>
        Layer <strong className="text-[var(--primary)]">{layerName}</strong>
        {sceneName ? (
          <> in <strong className="text-[var(--primary)]">{sceneName}</strong></>
        ) : null}
      </p>

      <div className="space-y-1">
        <span className={labelClass}>Layer state</span>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => updateSettings({ visible: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span>Visible in this scene</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => dispatch({ type: 'LAYER_SET_LOCKED', layerId, locked: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span>Locked in editor canvas</span>
          </label>
        </div>
        <NumField
          label="Opacity"
          value={opacity}
          step={0.05}
          onCommit={(nextOpacity) => updateSettings({ opacity: nextOpacity })}
        />
        <p className="text-[9px] text-[var(--muted)] leading-relaxed">
          Hidden layers do not draw in play. Locked layers cannot be picked or dragged on the canvas.
        </p>
      </div>

      {/* Parallax — applies to this layer's background and (later) its entities */}
      <div className="space-y-1">
        <span className={labelClass}>Parallax</span>
        <div className="flex items-end gap-2">
          <NumField label="X" value={parallax.x} onCommit={(x) => updateParallax({ x })} />
          <NumField label="Y" value={parallax.y} onCommit={(y) => updateParallax({ y })} />
        </div>
        <p className="text-[9px] text-[var(--muted)] leading-relaxed">
          1 = moves with the world · &lt;1 = far background (slower) · 0 = locked to screen · &gt;1 = foreground.
        </p>
      </div>

      {/* Background image — repeating, scrolls with parallax + optional auto-scroll */}
      <div className="space-y-1">
        <span className={labelClass}>Background image</span>
        <EditorSelect
          value={bg.imageId}
          onChange={(imageId) => updateBg({ imageId })}
          options={imageOptions}
          placeholder="None"
          aria-label="Background image"
        />
        {hasBackground && (
          <div className="space-y-1.5 pt-1">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={bg.tileX}
                  onChange={(e) => updateBg({ tileX: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span>Tile horizontally</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={bg.tileY}
                  onChange={(e) => updateBg({ tileY: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span>Tile vertically</span>
              </label>
            </div>
            <div className="flex items-end gap-2">
              <NumField label="Auto-scroll X" value={bg.scrollX} step={1} onCommit={(scrollX) => updateBg({ scrollX })} />
              <NumField label="Auto-scroll Y" value={bg.scrollY} step={1} onCommit={(scrollY) => updateBg({ scrollY })} />
            </div>
            <p className="text-[9px] text-[var(--muted)] leading-relaxed">
              Auto-scroll is a constant drift in px/s (independent of the camera) — e.g. drifting clouds.
            </p>
          </div>
        )}
      </div>

      {/* Tileset sources painted on this layer */}
      <div className="space-y-1">
        <span className={labelClass}>Tileset sources</span>
        {usedIds.length > 0 ? (
          <ul className="space-y-1">
            {usedIds.map((id) => {
              const tileset = project?.tilesets?.[id]
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text)] truncate">
                    {tileset?.name ?? id}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'TILESET_PAINT_BEGIN', tilesetId: id })}
                    className="shrink-0 text-[9px] text-[var(--accent)] hover:underline"
                  >
                    Paint
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[var(--muted)]">No tilesets used on this layer yet.</p>
        )}
      </div>

      <p className="text-[var(--muted)] leading-relaxed">
        Rename or reorder layers in the Layers panel (left sidebar).
        Assign entities to a layer via the Layer field in the Inspector.
      </p>
    </div>
  )
}
