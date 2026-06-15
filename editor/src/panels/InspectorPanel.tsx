// ---------------------------------------------------------------------------
// InspectorPanel — contextual right dock (scene / entity / asset / layer)
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react'
import { shallowEqual, useEditorDispatch, useEditorSelector } from '../store/editor-store'
import { SceneSettingsSection } from './inspector/SceneSettingsSection'
import { WorldSettingsSection, WorldDebugTimeSection } from './inspector/WorldSettingsSection'
import { EntityHeaderBar } from './inspector/EntityHeaderBar'
import { TransformSection } from './inspector/TransformSection'
import { SpriteSection } from './inspector/SpriteSection'
import { ComponentsSection } from './inspector/ComponentsSection'
import { ScriptSection } from './inspector/ScriptSection'
import { LogicBoardCta } from './inspector/LogicBoardCta'
import { EntityMetadataSection } from './inspector/EntityMetadataSection'
import { AssetInspectorSection } from './inspector/AssetInspectorSection'
import { LayerSettingsSection } from './inspector/LayerSettingsSection'
import { ProjectVariablesSection } from './inspector/ProjectVariablesSection'
import { ObjectVariablesSection } from './inspector/ObjectVariablesSection'
import { VariableWatchSection } from './inspector/VariableWatchSection'
import {
  deriveInspectorMode,
  inspectorChromeForMode,
} from './inspector/inspector-context'
import { scrollToComponentBlock } from './inspector/entity-component-utils'
import type { EntityDef } from '../types'
import type { InspectorBlockKey } from './inspector/entity-component-utils'

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
      <EntityMetadataSection entity={entity} />
      <ObjectVariablesSection entity={entity} />
      <VariableWatchSection entityId={entity.id} />
      <ComponentsSection
        entity={entity}
        open={componentsOpen}
        onOpenChange={setComponentsOpen}
      />
      <LogicBoardCta entity={entity} />
      <TransformSection entity={entity} />
      <SpriteSection entity={entity} />
      <ScriptSection entity={entity} />
    </>
  )
}

export default function InspectorPanel() {
  const project = useEditorSelector((s) => s.project)
  const selection = useEditorSelector((s) => s.selection)
  const inspectorAsset = useEditorSelector((s) => s.inspectorAsset)
  const inspectorLayerName = useEditorSelector((s) => s.inspectorLayerName)

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : null

  const dispatch = useEditorDispatch()
  const chrome = useEditorSelector(
    (s) => inspectorChromeForMode(deriveInspectorMode(s), s),
    shallowEqual,
  )
  const mode = chrome.mode
  return (
    <div className="h-full flex flex-col bg-[var(--bg-window)]" data-panel="inspector">
      <div className="editor-panel-header flex-col !items-start !gap-0.5 !py-2">
        {mode === 'entity' && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'SELECT_ENTITY', entityId: null })}
            className="text-[9px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-0.5 flex items-center gap-1"
          >
            ← Scene
          </button>
        )}
        <span className="editor-panel-header__title">{chrome.title}</span>
        {chrome.subtitle ? (
          <span className="editor-panel-header__subtitle text-[10px]">{chrome.subtitle}</span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 panel-scroll" data-panel="inspector-body">
        {mode === 'entity' && entity && (
          <>
            <EntityInspector key={entity.id} entity={entity} />
          </>
        )}

        {mode === 'entity' && !entity && (
          <div className="py-10 flex flex-col items-center gap-1.5 text-center px-4">
            <span className="text-[11px] text-[var(--muted)]">Select an object in the scene to inspect its properties.</span>
          </div>
        )}

        {mode === 'scene' && (
          <>
            {scene && <SceneSettingsSection scene={scene} />}
            {project && <WorldSettingsSection />}
            {project && <WorldDebugTimeSection />}
            {project && <ProjectVariablesSection />}
            {project && <VariableWatchSection />}
            {!project && (
              <div className="py-10 flex flex-col items-center gap-1.5 text-center px-4">
                <span className="text-[11px] text-[var(--muted)]">No project loaded.</span>
              </div>
            )}
          </>
        )}

        {mode === 'asset' && inspectorAsset && (
          <AssetInspectorSection selection={inspectorAsset} />
        )}

        {mode === 'layer' && inspectorLayerName && (
          <LayerSettingsSection
            layerName={inspectorLayerName}
            sceneName={scene?.name}
          />
        )}
      </div>
    </div>
  )
}
