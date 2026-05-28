// ---------------------------------------------------------------------------
// InspectorPanel — orchestrator
// ---------------------------------------------------------------------------
//
// Entity tab: header + Components (prominent) + Transform/Sprite/Script.
// Scene tab: scene layout, grid, and global world/physics settings.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { SceneSettingsSection } from './inspector/SceneSettingsSection'
import { WorldSettingsSection } from './inspector/WorldSettingsSection'
import { EntityHeaderBar } from './inspector/EntityHeaderBar'
import { TransformSection } from './inspector/TransformSection'
import { SpriteSection } from './inspector/SpriteSection'
import { ComponentsSection } from './inspector/ComponentsSection'
import { ScriptSection } from './inspector/ScriptSection'
import {
  inspectorBodyView,
  nextInspectorTab,
  type InspectorTab,
} from './inspector/inspector-tab-logic'
import { scrollToComponentBlock } from './inspector/entity-component-utils'
import type { EntityDef } from '../types'
import type { InspectorBlockKey } from './inspector/entity-component-utils'

type InspectorTabBarProps = Readonly<{
  tab: InspectorTab
  onTab: (t: InspectorTab) => void
  hasEntity: boolean
}>

function InspectorTabBar({ tab, onTab, hasEntity }: InspectorTabBarProps) {
  if (!hasEntity) return null

  const btn = (id: InspectorTab, label: string) => {
    const active = tab === id
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onTab(id)}
        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors
          ${active
            ? 'text-[var(--text)] border-b-2 border-[var(--accent-2)]'
            : 'text-[var(--muted)] hover:text-[var(--text)] border-b-2 border-transparent'
          }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      className="flex border-b border-[var(--border)] flex-shrink-0 px-2"
      role="tablist"
      aria-label="Inspector sections"
    >
      {btn('scene', 'Scene')}
      {btn('entity', 'Entity')}
    </div>
  )
}

type EntityInspectorProps = Readonly<{
  entity: EntityDef
}>

function EntityInspector({ entity }: EntityInspectorProps) {
  const [componentsOpen, setComponentsOpen] = useState(true)

  const jumpToComponent = useCallback((key: InspectorBlockKey) => {
    setComponentsOpen(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToComponentBlock(key))
    })
  }, [])

  return (
    <>
      <EntityHeaderBar entity={entity} onJumpToComponent={jumpToComponent} />
      <ComponentsSection
        entity={entity}
        open={componentsOpen}
        onOpenChange={setComponentsOpen}
      />
      <TransformSection entity={entity} />
      <SpriteSection entity={entity} />
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

  const [tab, setTab] = useState<InspectorTab>('scene')
  const hadEntityRef = useRef(false)

  useEffect(() => {
    const hasEntity = entity != null
    setTab((prev) => nextInspectorTab(prev, hadEntityRef.current, hasEntity))
    hadEntityRef.current = hasEntity
  }, [entity?.id])

  const bodyView = inspectorBodyView({
    tab,
    hasEntity: entity != null,
    hasScene: scene != null,
  })

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]" data-panel="inspector">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <Settings size={13} className="text-[var(--muted)]" />
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">
          Inspector
        </span>
      </div>

      <InspectorTabBar tab={tab} onTab={setTab} hasEntity={entity != null} />

      <div className="flex-1 overflow-y-auto px-4 py-3" data-panel="inspector-body">
        {bodyView === 'entity' && entity && (
          <EntityInspector key={entity.id} entity={entity} />
        )}

        {tab === 'scene' && (
          <>
            {scene && <SceneSettingsSection scene={scene} />}
            {project && <WorldSettingsSection />}
            {!project && (
              <div className="py-8 flex items-center justify-center opacity-20">
                <span className="text-[10px] uppercase tracking-widest">No project</span>
              </div>
            )}
          </>
        )}

        {bodyView === 'entity' && !entity && (
          <div className="py-8 flex items-center justify-center opacity-20">
            <span className="text-[10px] uppercase tracking-widest">Nothing to inspect</span>
          </div>
        )}
      </div>
    </div>
  )
}
