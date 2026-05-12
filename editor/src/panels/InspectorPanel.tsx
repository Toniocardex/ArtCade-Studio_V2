import { Settings, ChevronRight } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import type { EntityDef } from '../types'
import { editorSetTransform, isReady } from '../utils/wasm-bridge'

// ---- helpers ---------------------------------------------------------------

function SectionRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]
                    font-bold border-b border-[#1A253A] pb-1 mt-4 mb-2 uppercase tracking-widest">
      {label}
      <ChevronRight size={11} />
    </div>
  )
}

function Field({ label, value, cyan = false }: { label: string; value: string | number; cyan?: boolean }) {
  return (
    <div className="space-y-0.5 mb-2">
      <label className="text-[9px] text-[#9CA3AF] uppercase">{label}</label>
      <input
        type="text"
        defaultValue={String(value)}
        className={`w-full bg-[#1A253A] border border-[#2D3748] rounded px-2 py-1
                    text-xs focus:outline-none focus:border-[#00FFFF] transition-colors ${
                      cyan ? 'text-[#00FFFF]' : 'text-[#D1D5DB]'
                    }`}
      />
    </div>
  )
}

function NumberField({
  label, value, onCommit,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  return (
    <div>
      <label className="text-[8px] text-[#9CA3AF]/60">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onCommit(Number(e.target.value))}
        className="w-full bg-[#1A253A] border border-[#2D3748] rounded px-2 py-1
                   text-xs text-[#D1D5DB] focus:outline-none focus:border-[#00FFFF]"
      />
    </div>
  )
}

// ---- entity inspector -------------------------------------------------------

function EntityInspector({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()

  function commitTransform(next: Partial<{
    x: number; y: number; rotation: number; scaleX: number; scaleY: number
  }>) {
    const x = next.x ?? entity.transform.position.x
    const y = next.y ?? entity.transform.position.y
    const rotation = next.rotation ?? entity.transform.rotation
    const scaleX = next.scaleX ?? entity.transform.scale.x
    const scaleY = next.scaleY ?? entity.transform.scale.y

    dispatch({ type: 'UPDATE_ENTITY_TRANSFORM', entityId: entity.id, x, y, rotation, scaleX, scaleY })
    if (isReady()) editorSetTransform(entity.id, x, y, rotation, scaleX, scaleY)
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {/* Name */}
      <Field label="Entity Name" value={entity.name} cyan />

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {entity.tags.map(t => (
          <span key={t} className="bg-[#1A253A] border border-[#2D3748] text-[#9CA3AF]
                                   text-[9px] px-2 py-0.5 rounded">
            #{t}
          </span>
        ))}
      </div>

      {/* Transform */}
      <SectionRow label="Transform" />
      <div className="mb-2">
        <label className="text-[9px] text-[#9CA3AF] uppercase block mb-0.5">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={entity.transform.position.x} onCommit={x => commitTransform({ x })} />
          <NumberField label="Y" value={entity.transform.position.y} onCommit={y => commitTransform({ y })} />
        </div>
      </div>
      <div className="mb-2">
        <label className="text-[9px] text-[#9CA3AF] uppercase block mb-0.5">Scale</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={entity.transform.scale.x} onCommit={scaleX => commitTransform({ scaleX })} />
          <NumberField label="Y" value={entity.transform.scale.y} onCommit={scaleY => commitTransform({ scaleY })} />
        </div>
      </div>
      <div className="mb-2">
        <label className="text-[9px] text-[#9CA3AF] uppercase block mb-0.5">Rotation</label>
        <NumberField label="Radians" value={entity.transform.rotation} onCommit={rotation => commitTransform({ rotation })} />
      </div>

      {/* Sprite */}
      <SectionRow label="Sprite" />
      <Field label="Asset" value={entity.sprite.spriteAssetId || '(none)'} />
      <Field label="Alpha" value={entity.sprite.alpha.toFixed(2)} />
      <Field label="Render Order" value={entity.sprite.renderOrder} />

      {/* Script */}
      {entity.scriptPath && (
        <>
          <SectionRow label="Script" />
          <Field label="Path" value={entity.scriptPath} />
          <button
            onClick={() => dispatch({
              type: 'OPEN_SCRIPT',
              file: { path: entity.scriptPath!, content: '', isDirty: false },
            })}
            className="w-full mt-1 px-3 py-1 bg-[#FF00FF]/10 border border-[#FF00FF]/40
                       text-[#FF00FF] text-[10px] font-bold rounded hover:bg-[#FF00FF]/20
                       transition-colors"
          >
            OPEN IN LOGIC_BOARD →
          </button>
        </>
      )}
    </div>
  )
}

// ---- panel -----------------------------------------------------------------

export default function InspectorPanel() {
  const { state } = useEditor()
  const { project, selection } = state

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null

  return (
    <div className="h-full flex flex-col bg-[#0B1121]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1A253A] flex-shrink-0">
        <Settings size={13} className="text-[#9CA3AF]" />
        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Inspector</span>
      </div>

      {entity ? (
        <EntityInspector key={entity.id} entity={entity} />
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-20">
          <span className="text-[10px] uppercase tracking-widest">Select an entity</span>
        </div>
      )}
    </div>
  )
}
