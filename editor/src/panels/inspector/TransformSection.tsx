import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { runtimeSync } from '../../utils/runtime-sync-service'
import { InspectorSection, NumberField, snapToGridValue } from './inspector-fields'

type TransformPatch = Partial<{
  x: number; y: number; rotation: number; scaleX: number; scaleY: number
}>

export function TransformSection({ entity }: { entity: EntityDef }) {
  const { state, dispatch } = useEditor()

  function commitTransform(next: TransformPatch) {
    const sceneId = state.selection.sceneId ?? state.project?.activeSceneId
    const activeScene = sceneId ? state.project?.scenes[sceneId] : undefined
    const gridSize = state.editorGridSize ?? activeScene?.tilemap?.tileSize ?? 32
    const rawX = next.x ?? entity.transform.position.x
    const rawY = next.y ?? entity.transform.position.y
    const x = state.snapToGrid ? snapToGridValue(rawX, gridSize) : rawX
    const y = state.snapToGrid ? snapToGridValue(rawY, gridSize) : rawY
    const rotation = next.rotation ?? entity.transform.rotation
    const scaleX = next.scaleX ?? entity.transform.scale.x
    const scaleY = next.scaleY ?? entity.transform.scale.y

    dispatch({ type: 'UPDATE_ENTITY_TRANSFORM', entityId: entity.id, x, y, rotation, scaleX, scaleY })
    runtimeSync.syncEntityTransform({ entityId: entity.id, x, y, rotation, scaleX, scaleY })
  }

  return (
    <InspectorSection label="Transform" defaultOpen>
      <div className="mb-2">
        <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={entity.transform.position.x} onCommit={x => commitTransform({ x })} />
          <NumberField label="Y" value={entity.transform.position.y} onCommit={y => commitTransform({ y })} />
        </div>
      </div>
      <div className="mb-2">
        <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Scale</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={entity.transform.scale.x} onCommit={scaleX => commitTransform({ scaleX })} />
          <NumberField label="Y" value={entity.transform.scale.y} onCommit={scaleY => commitTransform({ scaleY })} />
        </div>
      </div>
      <div className="mb-2">
        <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Rotation</label>
        <NumberField label="Radians" value={entity.transform.rotation} onCommit={rotation => commitTransform({ rotation })} />
      </div>
    </InspectorSection>
  )
}
