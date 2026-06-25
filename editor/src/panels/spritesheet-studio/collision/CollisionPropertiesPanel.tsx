import type { ProjectDoc, CollisionProfileDef } from '../../../types'
import type { CollisionShapeDef } from '../../../types/components'
import { EditorSelect } from '../../../components/ui/EditorSelect'
import {
  patchCollisionProfileShape,
  physicsLayerOptions,
} from '../../../utils/collision-profile'
import { ROLES } from './CollisionToolsPanel'

const SHAPE_TYPES: CollisionShapeDef['type'][] = ['rectangle', 'circle', 'capsule', 'polygon']

type CollisionPropertiesPanelProps = Readonly<{
  project: ProjectDoc | null
  profile: CollisionProfileDef
  activeShapeIndex: number
  onPatchProfile: (profile: CollisionProfileDef) => void
}>

function patchActiveShape(
  profile: CollisionProfileDef,
  activeShapeIndex: number,
  patch: Partial<CollisionShapeDef>,
): CollisionProfileDef {
  return patchCollisionProfileShape(profile, activeShapeIndex, patch)
}

export function CollisionPropertiesPanel({
  project,
  profile,
  activeShapeIndex,
  onPatchProfile,
}: CollisionPropertiesPanelProps) {
  const shape = profile.shapes?.[activeShapeIndex]
  const layerOptions = physicsLayerOptions(project)

  if (!shape) {
    return (
      <aside className="w-64 shrink-0 border-l border-[var(--border)] p-3 text-xs text-[var(--muted)]">
        Add a collision shape to edit layer and mask.
      </aside>
    )
  }

  function commit(patch: Partial<CollisionShapeDef>) {
    onPatchProfile(patchActiveShape(profile, activeShapeIndex, patch))
  }

  function toggleMask(layerId: string) {
    const current = new Set(shape.maskLayerIds ?? [])
    if (current.has(layerId)) current.delete(layerId)
    else current.add(layerId)
    commit({ maskLayerIds: [...current] })
  }

  function changeType(nextType: CollisionShapeDef['type']) {
    if (nextType === 'polygon') {
      commit({
        type: nextType,
        points: shape.points && shape.points.length >= 3
          ? shape.points
          : [
              { x: 0, y: 0 },
              { x: Math.max(0.1, shape.width), y: 0 },
              { x: Math.max(0.05, shape.width * 0.5), y: Math.max(0.1, shape.height) },
            ],
      })
      return
    }
    commit({ type: nextType })
  }

  function patchPoint(index: number, key: 'x' | 'y', value: number) {
    const points = [...(shape.points ?? [])]
    const point = points[index]
    if (!point) return
    points[index] = { ...point, [key]: value }
    commit({ points })
  }

  function addPoint() {
    const points = [...(shape.points ?? [])]
    points.push({ x: shape.width * 0.5, y: shape.height * 0.5 })
    commit({ points })
  }

  function removePoint(index: number) {
    const points = (shape.points ?? []).filter((_, i) => i !== index)
    commit({ points: points.length >= 3 ? points : shape.points })
  }

  return (
    <aside className="w-64 shrink-0 border-l border-[var(--border)] flex flex-col min-h-0 bg-[var(--panel-2)] overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-bold">
          Shape properties
        </p>
      </div>
      <div className="p-3 space-y-3 text-xs">
        <div>
          <label className="text-[9px] uppercase text-[var(--muted)]">Type</label>
          <EditorSelect
            value={shape.type}
            onChange={(next) => changeType(next as CollisionShapeDef['type'])}
            triggerClassName="py-1"
            options={SHAPE_TYPES.map((type) => ({ value: type, label: type }))}
            aria-label="Collision shape type"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-[var(--muted)]">Role</label>
          <EditorSelect
            value={shape.role}
            onChange={(next) => commit({ role: next as CollisionShapeDef['role'] })}
            triggerClassName="py-1"
            options={ROLES.map((role) => ({ value: role, label: role }))}
            aria-label="Collision shape role"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-[var(--muted)]">Response</label>
          <EditorSelect
            value={shape.response}
            onChange={(next) => commit({ response: next as CollisionShapeDef['response'] })}
            triggerClassName="py-1"
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'sensor', label: 'Sensor (trigger)' },
            ]}
            aria-label="Collision response"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-[var(--muted)]">Physics layer</label>
          <EditorSelect
            value={shape.layerId}
            onChange={(next) => commit({ layerId: next })}
            triggerClassName="py-1"
            options={layerOptions.map((layer) => ({ value: layer.id, label: layer.name }))}
            aria-label="Physics layer"
          />
        </div>
        <div>
          <p className="text-[9px] uppercase text-[var(--muted)] mb-1">Collision mask</p>
          <div className="space-y-1 max-h-40 overflow-y-auto border border-[var(--border)] rounded p-2">
            {layerOptions.map((layer) => (
              <label key={layer.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shape.maskLayerIds?.includes(layer.id) ?? false}
                  onChange={() => toggleMask(layer.id)}
                />
                <span>{layer.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['offsetX', 'offsetY', 'width', 'height'] as const).map((key) => (
            <div key={key}>
              <label className="text-[9px] uppercase text-[var(--muted)]">{key}</label>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="editor-input py-1"
                value={shape[key]}
                onChange={(e) => commit({ [key]: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
          ))}
        </div>
        {shape.type === 'circle' && (
          <div>
            <label className="text-[9px] uppercase text-[var(--muted)]">Radius</label>
            <input
              type="number"
              step={0.5}
              min={0}
              className="editor-input py-1"
              value={shape.radius}
              onChange={(e) => commit({ radius: Number.parseFloat(e.target.value) || 0 })}
            />
          </div>
        )}
        {shape.type === 'polygon' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] uppercase text-[var(--muted)]">Polygon points</p>
              <button
                type="button"
                className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)]"
                onClick={addPoint}
              >
                Add
              </button>
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {(shape.points ?? []).map((point, index) => (
                <div key={`point-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
                  <input
                    type="number"
                    step={0.01}
                    className="editor-input py-1"
                    value={point.x}
                    onChange={(e) => patchPoint(index, 'x', Number.parseFloat(e.target.value) || 0)}
                    aria-label={`Point ${index + 1} x`}
                  />
                  <input
                    type="number"
                    step={0.01}
                    className="editor-input py-1"
                    value={point.y}
                    onChange={(e) => patchPoint(index, 'y', Number.parseFloat(e.target.value) || 0)}
                    aria-label={`Point ${index + 1} y`}
                  />
                  <button
                    type="button"
                    className="w-7 h-7 rounded border border-[var(--border)] text-[var(--danger)] disabled:opacity-40"
                    disabled={(shape.points?.length ?? 0) <= 3}
                    onClick={() => removePoint(index)}
                    aria-label={`Remove point ${index + 1}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={shape.oneWay}
            onChange={(e) => commit({ oneWay: e.target.checked })}
          />
          <span>One-way platform</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={shape.enabled}
            onChange={(e) => commit({ enabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>
      </div>
    </aside>
  )
}
