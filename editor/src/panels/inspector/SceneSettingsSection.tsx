import { useState } from 'react'
import { useEditorDispatch } from '../../store/editor-store'
import type { SceneDef } from '../../types'
import { InspectorRow, InspectorSection, parseSceneDimension } from './inspector-fields'
import { DimensionField } from './DimensionField'
import { CanvasPreview } from './CanvasPreview'
import { SegmentedControl } from '../../components/ui/SegmentedControl'

export type SceneSettingsSectionProps = Readonly<{
  scene: SceneDef
}>

type AspectPreset = Readonly<{ value: string; label: string; w: number; h: number }>

const ASPECT_PRESETS: readonly AspectPreset[] = [
  { value: '16:9', label: '16:9', w: 16, h: 9 },
  { value: '4:3', label: '4:3', w: 4, h: 3 },
  { value: '1:1', label: '1:1', w: 1, h: 1 },
]

const PRESET_OPTIONS = [...ASPECT_PRESETS.map((p) => ({ value: p.value, label: p.label })),
  { value: 'custom', label: 'Custom' }]

const RATIO_EPSILON = 0.02

/** Identify which preset the current world ratio matches, else 'custom'. */
function activePreset(width: number, height: number): string {
  if (height <= 0) return 'custom'
  const ratio = width / height
  const hit = ASPECT_PRESETS.find((p) => Math.abs(ratio - p.w / p.h) < RATIO_EPSILON)
  return hit?.value ?? 'custom'
}

export function SceneSettingsSection({ scene }: SceneSettingsSectionProps) {
  const dispatch = useEditorDispatch()
  const [worldLocked, setWorldLocked] = useState(false)
  const [viewportLocked, setViewportLocked] = useState(false)

  function commitWorld(next: { width: number; height: number }) {
    dispatch({ type: 'SCENE_SET_WORLD_SIZE', sceneId: scene.id, x: next.width, y: next.height })
  }

  function commitViewport(next: { width: number; height: number }) {
    dispatch({ type: 'SCENE_SET_VIEWPORT_SIZE', sceneId: scene.id, x: next.width, y: next.height })
  }

  function applyPreset(value: string) {
    if (value === 'custom') return
    const preset = ASPECT_PRESETS.find((p) => p.value === value)
    if (!preset) return
    const height = parseSceneDimension(
      String(Math.round(scene.worldSize.x * (preset.h / preset.w))),
      scene.worldSize.y,
    )
    commitWorld({ width: scene.worldSize.x, height })
  }

  return (
    <InspectorSection label="Canvas" defaultOpen>
      <CanvasPreview
        worldWidth={scene.worldSize.x}
        worldHeight={scene.worldSize.y}
        viewportWidth={scene.viewportSize.x}
        viewportHeight={scene.viewportSize.y}
      />
      <InspectorRow label="World" unit="px">
        <DimensionField
          width={scene.worldSize.x}
          height={scene.worldSize.y}
          locked={worldLocked}
          onToggleLock={() => setWorldLocked((v) => !v)}
          onCommit={commitWorld}
        />
      </InspectorRow>
      <InspectorRow label="Viewport" unit="px">
        <DimensionField
          width={scene.viewportSize.x}
          height={scene.viewportSize.y}
          locked={viewportLocked}
          onToggleLock={() => setViewportLocked((v) => !v)}
          onCommit={commitViewport}
        />
      </InspectorRow>
      <div className="mb-2">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-1">
          World aspect ratio
        </span>
        <SegmentedControl
          aria-label="World aspect ratio preset"
          value={activePreset(scene.worldSize.x, scene.worldSize.y)}
          onChange={applyPreset}
          options={PRESET_OPTIONS}
        />
      </div>
      {scene.tilemap && (
        <p className="text-[9px] text-[var(--muted)] leading-snug mb-3">
          Tilemap: {scene.tilemap.cols} x {scene.tilemap.rows} cells at {scene.tilemap.tileSize}px.
        </p>
      )}
    </InspectorSection>
  )
}
