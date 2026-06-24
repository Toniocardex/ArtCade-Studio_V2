import type { Dispatch, SetStateAction } from 'react'
import { Copy, FileText, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { SceneObjectsTree } from './SceneObjectsTree'
import { TreeSection } from './TreeSection'
import { TreeLeaf } from './TreeNode'
import { ExplorerActionBar, ExplorerLabelCta } from './explorer-cta'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'

export type SceneTreeSectionProps = Readonly<{
  tree: ReturnType<typeof buildProjectExplorerData>
  scene: ReturnType<typeof useSceneExplorerActions>
  selectedEntityId: number | null
  selectedEntityIds?: readonly number[]
  isOpen: (key: ExplorerExpandKey, defaultOpen?: boolean) => boolean
  toggle: (key: ExplorerExpandKey, defaultOpen?: boolean) => void
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
}>

/** Scenes list (+ scene CTAs) and the "Objects in scene" type tree. */
export function SceneTreeSection({
  tree,
  scene,
  selectedEntityId,
  selectedEntityIds,
  isOpen,
  toggle,
  setContextMenu,
}: SceneTreeSectionProps) {
  const sceneId = scene.sceneId
  return (
    <div className="panel-scroll flex-[3] min-h-0">
      <TreeSection
        title="Scenes"
        open={isOpen('scenes')}
        onToggle={() => toggle('scenes')}
        hidden={!tree.scenesVisible}
        actions={
          <ExplorerLabelCta
            label="Add scene"
            title="Create a new scene"
            onClick={scene.addScene}
            icon={<Plus size={12} />}
          />
        }
        actionBar={
          scene.scene ? (
            <ExplorerActionBar>
              <ExplorerLabelCta
                label="Set start"
                title="Set as start scene"
                tone="default"
                disabled={scene.isStartScene}
                onClick={scene.setStartScene}
                icon={<Star size={12} />}
              />
              <ExplorerLabelCta
                label="Duplicate"
                title="Duplicate scene"
                tone="default"
                onClick={() => scene.duplicateSceneById(sceneId)}
                icon={<Copy size={12} />}
              />
              <ExplorerLabelCta
                label="Rename"
                title="Rename scene"
                tone="default"
                onClick={scene.renameScene}
                icon={<Pencil size={12} />}
              />
              <ExplorerLabelCta
                label="Delete"
                title="Delete scene"
                tone="default"
                disabled={!scene.canDeleteScene}
                onClick={scene.deleteScene}
                icon={<Trash2 size={12} />}
              />
            </ExplorerActionBar>
          ) : null
        }
      >
        {tree.scenes.length === 0 ? (
          <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">No matches</p>
        ) : (
          tree.scenes.map((s) => {
            const active = sceneId === s.sceneId
            return (
              <TreeLeaf
                key={s.sceneId}
                label={s.name}
                depth={1}
                selected={active}
                onClick={() => scene.selectScene(s.sceneId)}
                onDoubleClick={() => scene.renameSceneById(s.sceneId)}
                onContextMenu={(ev) =>
                  openExplorerContextMenu(
                    ev,
                    [
                      {
                        id: 'set-start',
                        label: 'Set as start scene',
                        disabled: s.isStartScene,
                        onSelect: () => scene.setStartSceneById(s.sceneId),
                      },
                      {
                        id: 'duplicate',
                        label: 'Duplicate scene',
                        onSelect: () => scene.duplicateSceneById(s.sceneId),
                      },
                      {
                        id: 'rename',
                        label: 'Rename scene',
                        onSelect: () => scene.renameSceneById(s.sceneId),
                      },
                      {
                        id: 'delete',
                        label: 'Delete scene',
                        danger: true,
                        disabled: s.isStartScene || scene.sceneCount <= 1,
                        onSelect: () => scene.deleteSceneById(s.sceneId),
                      },
                    ],
                    setContextMenu,
                  )
                }
                icon={<FileText size={11} className="flex-shrink-0 opacity-70" />}
                trailing={
                  s.isStartScene ? (
                    <Star size={10} fill="currentColor" className="flex-shrink-0 opacity-90" />
                  ) : null
                }
              />
            )
          })
        )}
      </TreeSection>

      <TreeSection
        title="Objects in scene"
        open={isOpen('entities')}
        onToggle={() => toggle('entities')}
        hidden={!tree.entitiesVisible}
        bodyClassName={tree.entityGroups.length === 0 ? 'min-h-[3.25rem]' : ''}
        actions={
          <ExplorerLabelCta
            label="Insert object"
            title="Insert an object into this scene (Insert)"
            onClick={scene.insertObject}
            disabled={!scene.scene}
            icon={<Plus size={12} />}
          />
        }
      >
        {tree.entityGroups.length === 0 ? (
          tree.hasSearch ? (
            <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">No matches</p>
          ) : scene.scene ? (
            <p className="text-[10px] text-[var(--muted)] px-2 py-1">
              No objects yet — use <strong className="font-medium text-[var(--text)]">Insert object</strong> above.
            </p>
          ) : (
            <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">No active scene</p>
          )
        ) : (
          <SceneObjectsTree
            groups={tree.entityGroups}
            hasSearch={tree.hasSearch}
            scene={scene}
            selectedEntityId={selectedEntityId}
            selectedEntityIds={selectedEntityIds}
            isOpen={isOpen}
            toggle={toggle}
            setContextMenu={setContextMenu}
          />
        )}
      </TreeSection>
    </div>
  )
}
