import { Box, Eye, Plus } from 'lucide-react'
import PanelHeader from '../components/PanelHeader'
import { useEditor } from '../store/editor-store'
import type { EntityDef } from '../types'

const CLASS_COLOR: Record<string, string> = {
  Player:  '#00FFFF',
  Tilemap: '#9CA3AF',
  Slime:   '#4ade80',
  Enemy:   '#f87171',
}

function EntityRow({ entity, selected, onClick }: {
  entity:  EntityDef
  selected: boolean
  onClick:  () => void
}) {
  const color = CLASS_COLOR[entity.className] ?? '#9CA3AF'
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center justify-between px-2 py-1.5
                  rounded text-xs cursor-pointer transition-all ${
                    selected
                      ? 'bg-[#00FFFF] text-[#0B1121] font-bold'
                      : 'hover:bg-[#1A253A] text-[#D1D5DB]'
                  }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Box size={12} style={{ color: selected ? '#0B1121' : color, flexShrink: 0 }} />
        <span className="truncate">{entity.name}</span>
      </div>
      <Eye size={11} className="opacity-0 group-hover:opacity-40 flex-shrink-0" />
    </button>
  )
}

export default function HierarchyPanel() {
  const { state, dispatch } = useEditor()
  const { project, selection } = state

  if (!project) {
    return (
      <div className="h-full bg-[#0B1121] flex items-center justify-center">
        <span className="text-[#9CA3AF] text-xs">No project</span>
      </div>
    )
  }

  const sceneId   = selection.sceneId ?? project.activeSceneId
  const scene     = project.scenes[sceneId]
  const entities  = (scene?.entityIds ?? [])
    .map(id => project.entities[id])
    .filter((e): e is EntityDef => Boolean(e))

  return (
    <div className="h-full flex flex-col bg-[#0B1121]">
      <PanelHeader title="Hierarchy">
        <Plus size={13} className="text-[#00FFFF] cursor-pointer hover:opacity-70" />
      </PanelHeader>

      {/* Scene selector */}
      <div className="px-2 py-1.5 border-b border-[#1A253A]">
        <select
          value={sceneId}
          onChange={e => dispatch({ type: 'SELECT_SCENE', sceneId: e.target.value })}
          className="w-full bg-[#1A253A] border border-[#2D3748] text-[#D1D5DB]
                     text-[11px] rounded px-2 py-0.5 focus:outline-none
                     focus:border-[#00FFFF]"
        >
          {Object.values(project.scenes).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {entities.length === 0 ? (
          <p className="text-[#9CA3AF] text-[10px] px-2 pt-2">No entities.</p>
        ) : (
          entities.map(e => (
            <EntityRow
              key={e.id}
              entity={e}
              selected={selection.entityId === e.id}
              onClick={() =>
                dispatch({ type: 'SELECT_ENTITY', entityId: selection.entityId === e.id ? null : e.id })
              }
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 border-t border-[#1A253A] text-[9px] text-[#9CA3AF]">
        {entities.length} entities · {scene?.name ?? '—'}
      </div>
    </div>
  )
}
