import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import {
  commitEntityTransform,
  transformSnapshotFromEntity,
  type TransformPatch,
} from '../../utils/entity-transform-commit'
import { InspectorSection, NumberField } from './inspector-fields'

export type TransformSectionProps = Readonly<{
  entity: EntityDef
}>

export function TransformSection({ entity }: TransformSectionProps) {
  const dispatch = useEditorDispatch()
  const selectionSceneId = useEditorSelector((s) => s.selection.sceneId)
  const project = useEditorSelector((s) => s.project)
  const editorGridSize = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)

  function commitTransform(patch: TransformPatch) {
    const sceneId = selectionSceneId ?? project?.activeSceneId
    const scene = sceneId ? project?.scenes?.[sceneId] : undefined
    const gridSize = editorGridSize || scene?.tilemap?.tileSize || 32

    commitEntityTransform({
      dispatch,
      snapshot: transformSnapshotFromEntity(entity, patch),
      source: 'inspector',
      snapToGrid,
      gridSize,
      entity,
    })
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
