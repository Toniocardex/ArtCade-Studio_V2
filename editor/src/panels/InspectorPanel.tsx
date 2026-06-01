// ---------------------------------------------------------------------------
// InspectorPanel — contextual right dock (scene / entity / asset / layer)
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react'
import { useEditor } from '../store/editor-store'
import { SceneSettingsSection } from './inspector/SceneSettingsSection'
import { WorldSettingsSection } from './inspector/WorldSettingsSection'
import { EntityHeaderBar } from './inspector/EntityHeaderBar'
import { TransformSection } from './inspector/TransformSection'
import { SpriteSection } from './inspector/SpriteSection'
import { ComponentsSection } from './inspector/ComponentsSection'
import { ScriptSection } from './inspector/ScriptSection'
import { LogicBoardCta } from './inspector/LogicBoardCta'
import { EntityMetadataSection } from './inspector/EntityMetadataSection'
import { AssetInspectorSection } from './inspector/AssetInspectorSection'
import { LayerSettingsSection } from './inspector/LayerSettingsSection'
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
  const { state } = useEditor()
  const { project, selection } = state

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : null

  const mode = deriveInspectorMode(state)
  const chrome = inspectorChromeForMode(mode, state)
  return (
    <div className="h-full flex flex-col bg-[var(--bg-window)]" data-panel="inspector">
      <div className="editor-panel-header flex-col !items-start !gap-0.5 !py-2">
        <span className="editor-panel-header__title">{chrome.title}</span>
        {chrome.subtitle ? (
          <span className="editor-panel-header__subtitle text-[10px]">{chrome.subtitle}</span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 panel-scroll" data-panel="inspector-body">
        {mode === 'entity' && entity && (
          <>
            <EntityInspector key={entity.id} entity={entity} />
            <VariableWatchSection />
          </>
        )}

        {mode === 'entity' && !entity && (
          <div className="py-8 flex items-center justify-center opacity-20">
            <span className="text-[10px] uppercase tracking-widest">Nothing to inspect</span>
          </div>
        )}

        {mode === 'scene' && (
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

        {mode === 'asset' && state.inspectorAsset && (
          <AssetInspectorSection selection={state.inspectorAsset} />
        )}

        {mode === 'layer' && state.inspectorLayerName && (
          <LayerSettingsSection
            layerName={state.inspectorLayerName}
            sceneName={scene?.name}
          />
        )}
      </div>
    </div>
  )
}
