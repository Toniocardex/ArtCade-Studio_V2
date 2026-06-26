import type { Dispatch, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { SceneObjectsTree } from './SceneObjectsTree'
import { TreeSection } from './TreeSection'
import { ExplorerRowAction } from './explorer-cta'
import type { ExplorerContextMenuState } from './explorer-context-menu'
import { SceneContextBar } from './SceneContextBar'
import { ExplorerEmptyState } from './ExplorerEmptyState'

export type SceneTreeSectionProps = Readonly<{
  tree: ReturnType<typeof buildProjectExplorerData>
  scene: ReturnType<typeof useSceneExplorerActions>
  selectedEntityId: number | null
  selectedEntityIds?: readonly number[]
  isOpen: (key: ExplorerExpandKey, defaultOpen?: boolean) => boolean
  toggle: (key: ExplorerExpandKey, defaultOpen?: boolean) => void
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
}>

/** Scene context plus the active scene's Construct-style object tree. */
export function SceneTreeSection({
  tree,
  scene,
  selectedEntityId,
  selectedEntityIds,
  isOpen,
  toggle,
  setContextMenu,
}: SceneTreeSectionProps) {
  return (
    <div className="panel-scroll flex-[3] min-h-0">
      <SceneContextBar
        scenes={tree.scenes}
        visible={tree.scenesVisible}
        scene={scene}
        setContextMenu={setContextMenu}
      />

      <TreeSection
        title="Objects"
        open={isOpen('entities')}
        onToggle={() => toggle('entities')}
        hidden={!tree.entitiesVisible}
        bodyClassName={tree.entityGroups.length === 0 ? 'min-h-[3.25rem]' : ''}
        actions={
          <ExplorerRowAction
            title="Insert an object into this scene (Insert)"
            tone="accent"
            disabled={!scene.scene}
            onClick={(ev) => {
              ev.stopPropagation()
              scene.insertObject()
            }}
          >
            <Plus size={13} />
          </ExplorerRowAction>
        }
      >
        {tree.entityGroups.length === 0 ? (
          tree.hasSearch ? (
            <ExplorerEmptyState title="No matches" detail="Clear search to browse objects." />
          ) : !scene.scene ? (
            <ExplorerEmptyState title="No active scene" detail="Select a scene to show its objects." />
          ) : (
            <ExplorerEmptyState
              title="No object types yet"
              detail="Use the add button above to create the first object type."
            />
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
