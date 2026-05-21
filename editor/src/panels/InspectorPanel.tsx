// ---------------------------------------------------------------------------
// InspectorPanel — orchestrator
// ---------------------------------------------------------------------------
//
// The panel itself is just routing: pick the active scene + selected entity
// from the store, then render the relevant sections. Each section in
// `editor/src/panels/inspector/` owns its own commit logic so this file no
// longer balloons every time a new component is added.

import { Settings } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { SceneSettingsSection } from './inspector/SceneSettingsSection'
import { EntitySettingsSection } from './inspector/EntitySettingsSection'
import { TransformSection } from './inspector/TransformSection'
import { SpriteSection } from './inspector/SpriteSection'
import { ComponentsSection } from './inspector/ComponentsSection'
import { ScriptSection } from './inspector/ScriptSection'
import type { EntityDef } from '../types'

function EntityInspector({ entity }: { entity: EntityDef }) {
  return (
    <>
      <EntitySettingsSection entity={entity} />
      <TransformSection entity={entity} />
      <SpriteSection entity={entity} />
      <ComponentsSection entity={entity} />
      <ScriptSection entity={entity} />
    </>
  )
}

export default function InspectorPanel() {
  const { state } = useEditor()
  const { project, selection } = state

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : null

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]" data-panel="inspector">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <Settings size={13} className="text-[var(--muted)]" />
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Inspector</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" data-panel="inspector">
        {scene && <SceneSettingsSection scene={scene} />}

        {entity ? (
          <EntityInspector key={entity.id} entity={entity} />
        ) : (
          <div className="py-8 flex items-center justify-center opacity-20">
            <span className="text-[10px] uppercase tracking-widest">Select an entity</span>
          </div>
        )}
        {!scene && (
          <div className="py-8 flex items-center justify-center opacity-20">
            <span className="text-[10px] uppercase tracking-widest">No active scene</span>
          </div>
        )}
      </div>
    </div>
  )
}
