import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { runtimeSync } from '../../utils/runtime-sync-service'
import { normalizeEntityPosition } from '../../utils/entity-position'
import { InspectorSection, NumberField } from './inspector-fields'

type TransformPatch = Partial<{
  x: number; y: number; rotation: number; scaleX: number; scaleY: number
}>

export type TransformSectionProps = Readonly<{
  entity: EntityDef
}>

export function TransformSection({ entity }: TransformSectionProps) {
  const dispatch = useEditorDispatch()
  const selectionSceneId = useEditorSelector((s) => s.selection.sceneId)
  const project = useEditorSelector((s) => s.project)
  const editorGridSize = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)

  function commitTransform(next: TransformPatch) {
    const sceneId = selectionSceneId ?? project?.activeSceneId
    const activeScene = sceneId ? project?.scenes?.[sceneId] : undefined
    const gridSize = editorGridSize || activeScene?.tilemap?.tileSize || 32
    const rawX = next.x ?? entity.transform.position.x
    const rawY = next.y ?? entity.transform.position.y
    const { x, y } = normalizeEntityPosition(rawX, rawY, snapToGrid, gridSize)
    const rotation = next.rotation ?? entity.transform.rotation
    const scaleX = next.scaleX ?? entity.transform.scale.x
    const scaleY = next.scaleY ?? entity.transform.scale.y

    dispatch({ type: 'UPDATE_ENTITY_TRANSFORM', entityId: entity.id, x, y, rotation, scaleX, scaleY })
    runtimeSync.syncEntityTransform({ entityId: entity.id, x, y, rotation, scaleX, scaleY })
  }

  return (
    <InspectorSection label="Transform" defaultOpen>
      <div className="mb-2">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Position</span>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" step={1} value={entity.transform.position.x} onCommit={x => commitTransform({ x })} />
          <NumberField label="Y" step={1} value={entity.transform.position.y} onCommit={y => commitTransform({ y })} />
        </div>
      </div>
      <div className="mb-2">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Scale</span>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={entity.transform.scale.x} onCommit={scaleX => commitTransform({ scaleX })} />
          <NumberField label="Y" value={entity.transform.scale.y} onCommit={scaleY => commitTransform({ scaleY })} />
        </div>
      </div>
      <div className="mb-2">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Rotation</span>
        <NumberField label="Radians" value={entity.transform.rotation} onCommit={rotation => commitTransform({ rotation })} />
      </div>
    </InspectorSection>
  )
}
