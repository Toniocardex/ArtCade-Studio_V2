import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { SceneDef } from '../../types'
import {
  Field, InspectorSection, parseGridSize, parseSceneDimension,
} from './inspector-fields'

export type SceneSettingsSectionProps = Readonly<{
  scene: SceneDef
}>

export function SceneSettingsSection({ scene }: SceneSettingsSectionProps) {
  const dispatch = useEditorDispatch()
  const gridSize = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)

  function commitWorld(patch: Partial<{ x: number; y: number }>) {
    dispatch({
      type: 'SCENE_SET_WORLD_SIZE',
      sceneId: scene.id,
      x: patch.x ?? scene.worldSize.x,
      y: patch.y ?? scene.worldSize.y,
    })
  }

  function commitViewport(patch: Partial<{ x: number; y: number }>) {
    dispatch({
      type: 'SCENE_SET_VIEWPORT_SIZE',
      sceneId: scene.id,
      x: patch.x ?? scene.viewportSize.x,
      y: patch.y ?? scene.viewportSize.y,
    })
  }

  function commitGridSize(value: string) {
    dispatch({
      type: 'EDITOR_SET_GRID_SIZE',
      tileSize: parseGridSize(value, gridSize),
    })
  }

  return (
    <InspectorSection label="Scene Settings" defaultOpen>
      <div className="mb-3">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Scene Size</span>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Width"
            value={scene.worldSize.x}
            onCommit={(value) => commitWorld({
              x: parseSceneDimension(value, scene.worldSize.x),
            })}
          />
          <Field
            label="Height"
            value={scene.worldSize.y}
            onCommit={(value) => commitWorld({
              y: parseSceneDimension(value, scene.worldSize.y),
            })}
          />
        </div>
      </div>
      <div className="mb-3">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Viewport</span>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Width"
            value={scene.viewportSize.x}
            onCommit={(value) => commitViewport({
              x: parseSceneDimension(value, scene.viewportSize.x),
            })}
          />
          <Field
            label="Height"
            value={scene.viewportSize.y}
            onCommit={(value) => commitViewport({
              y: parseSceneDimension(value, scene.viewportSize.y),
            })}
          />
        </div>
      </div>
      <div className="mb-3">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Editor Grid</span>
        <div className="grid grid-cols-2 gap-2 items-end">
          <Field
            label="Size (px)"
            value={gridSize}
            onCommit={commitGridSize}
          />
          <label className="flex items-center gap-2 mb-2 text-[9px] text-[var(--muted)] uppercase select-none">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => dispatch({ type: 'SET_SNAP_TO_GRID', enabled: e.target.checked })}
              className="accent-[var(--accent)]"
            /><span>Snap to grid</span>
          </label>
        </div>
      </div>
      {scene.tilemap && (
        <p className="text-[9px] text-[var(--muted)] leading-snug mb-3">
          Tilemap: {scene.tilemap.cols} x {scene.tilemap.rows} cells at {scene.tilemap.tileSize}px.
        </p>
      )}
    </InspectorSection>
  )
}
