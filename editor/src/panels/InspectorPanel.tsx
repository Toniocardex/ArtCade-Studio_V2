// ---------------------------------------------------------------------------
// InspectorPanel — contextual right dock (scene / entity / asset / layer / tileset-paint)
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
import { TilePalettePanel } from './tileset-studio/TilePalettePanel'
import { releaseTilesetAsset } from '../utils/asset-orchestrator'
import {
  collectProjectAssetRefs,
  formatAssetDeleteBlockMessage,
} from '../utils/collect-project-asset-refs'
import { alertDialog } from '../utils/native-dialog'
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
  const inspectorLayerId = useEditorSelector((s) => s.inspectorLayerId)
  const activePaintTilesetId = useEditorSelector((s) => s.activePaintTilesetId)

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : null
  const paintTileset = activePaintTilesetId ? project?.tilesets?.[activePaintTilesetId] : undefined

  const dispatch = useEditorDispatch()
  const chrome = useEditorSelector(
    (s) => inspectorChromeForMode(deriveInspectorMode(s), s),
    shallowEqual,
  )
  const mode = chrome.mode

  const isTilesetPaint = mode === 'tileset-paint'

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
        {isTilesetPaint && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'TILESET_PAINT_END' })}
            className="text-[9px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-0.5 flex items-center gap-1"
          >
            ← Done painting
          </button>
        )}
        <span className="editor-panel-header__title flex items-center gap-1.5">
          {chrome.title}
          {mode === 'scene' && scene && project?.activeSceneId === scene.id && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
                             bg-[#1a3a1a] text-[#4caf50] border border-[#2a5a2a]">
              Start
            </span>
          )}
        </span>
        {chrome.subtitle ? (
          <span className="editor-panel-header__subtitle text-[10px]">{chrome.subtitle}</span>
        ) : null}
      </div>

      {isTilesetPaint && paintTileset && (
        <div className="flex-1 min-h-0 overflow-hidden" data-panel="inspector-body">
          <TilePalettePanel
            tileset={paintTileset}
            onRemove={() => void (async () => {
              if (project) {
                const refs = collectProjectAssetRefs(project, {
                  kind: 'tileset',
                  id: paintTileset.assetId,
                })
                if (refs.length > 0) {
                  await alertDialog(
                    formatAssetDeleteBlockMessage(paintTileset.name, refs),
                    { title: 'Asset is still in use', kind: 'warning' },
                  )
                  return
                }
              }
              releaseTilesetAsset(paintTileset)
              dispatch({ type: 'TILESET_ASSET_REMOVE', assetId: paintTileset.assetId })
              dispatch({ type: 'TILESET_PAINT_END' })
            })()}
          />
        </div>
      )}

      {!isTilesetPaint && (
        <div className="flex-1 overflow-y-auto px-4 pb-3 panel-scroll" data-panel="inspector-body">
          {mode === 'entity' && entity && (
            <EntityInspector key={entity.id} entity={entity} />
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

          {mode === 'layer' && inspectorLayerId && (
            <LayerSettingsSection
              layerId={inspectorLayerId}
              sceneName={scene?.name}
            />
          )}
        </div>
      )}
    </div>
  )
}
