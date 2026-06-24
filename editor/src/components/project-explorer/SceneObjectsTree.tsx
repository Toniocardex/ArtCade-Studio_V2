import type { Dispatch, SetStateAction } from 'react'
import { Box, Copy, Eye, EyeOff, Trash2, Workflow } from 'lucide-react'
import type { ExplorerTypeGroup } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { TreeFolder, TreeLeaf } from './TreeNode'
import { ExplorerLeafActionBtn } from './explorer-cta'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'

export type SceneObjectsTreeProps = Readonly<{
  groups: ExplorerTypeGroup[]
  /** When the explorer search is active, groups render expanded regardless of stored state. */
  hasSearch: boolean
  scene: ReturnType<typeof useSceneExplorerActions>
  selectedEntityId: number | null
  isOpen: (key: ExplorerExpandKey, defaultOpen?: boolean) => boolean
  toggle: (key: ExplorerExpandKey, defaultOpen?: boolean) => void
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
}>

/**
 * "Objects in scene" tree body: one collapsible folder per object type, with
 * the scene instances of that type as leaf rows (Construct-style grouping).
 */
export function SceneObjectsTree({
  groups,
  hasSearch,
  scene,
  selectedEntityId,
  isOpen,
  toggle,
  setContextMenu,
}: SceneObjectsTreeProps) {
  return (
    <>
      {groups.map((group) => {
        const groupKey = `scene-type:${group.typeKey}` as const
        const groupOpen = isOpen(groupKey, false) || hasSearch
        const firstInstanceId = group.instances[0]?.entityId
        return (
          <TreeFolder
            key={group.typeKey}
            label={group.displayName}
            count={group.instances.length}
            depth={1}
            open={groupOpen}
            onToggle={() => toggle(groupKey, false)}
            onContextMenu={(ev) =>
              openExplorerContextMenu(
                ev,
                [
                  {
                    id: 'add-instance',
                    label: 'Add instance',
                    disabled: !group.objectTypeId,
                    onSelect: () => {
                      if (group.objectTypeId) scene.addInstanceOfType(group.objectTypeId)
                    },
                  },
                  {
                    id: 'logic',
                    label: 'Edit Logic Board',
                    disabled: firstInstanceId == null,
                    onSelect: () => {
                      if (firstInstanceId != null) scene.openEntityLogic(firstInstanceId)
                    },
                  },
                ],
                setContextMenu,
              )
            }
          >
            {group.instances.map((row) => (
              <SceneInstanceLeaf
                key={row.entityId}
                row={row}
                scene={scene}
                selected={selectedEntityId === row.entityId}
                setContextMenu={setContextMenu}
              />
            ))}
          </TreeFolder>
        )
      })}
    </>
  )
}

type SceneInstanceLeafProps = Readonly<{
  row: ExplorerTypeGroup['instances'][number]
  scene: ReturnType<typeof useSceneExplorerActions>
  selected: boolean
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
}>

function SceneInstanceLeaf({
  row,
  scene,
  selected,
  setContextMenu,
}: SceneInstanceLeafProps) {
  return (
    <TreeLeaf
      label={row.name}
      depth={2}
      selected={selected}
      muted={!row.visible}
      onClick={() => scene.selectEntity(row.entityId)}
      onContextMenu={(ev) =>
        openExplorerContextMenu(
          ev,
          [
            {
              id: 'logic',
              label: 'Edit Logic Board',
              onSelect: () => scene.openEntityLogic(row.entityId),
            },
            {
              id: 'visible',
              label: row.visible ? 'Hide in game' : 'Show in game',
              onSelect: () => scene.toggleEntityVisible(row.entityId, row.visible),
            },
            {
              id: 'rename',
              label: 'Rename',
              onSelect: () => scene.renameEntity(row.entityId),
            },
            {
              id: 'copy',
              label: 'Copy',
              onSelect: () => scene.copyEntity(row.entityId),
            },
            {
              id: 'paste',
              label: 'Paste',
              disabled: !scene.canPasteEntity,
              onSelect: () => scene.pasteEntity(),
            },
            {
              id: 'duplicate',
              label: 'Duplicate',
              onSelect: () => scene.duplicateEntity(row.entityId),
            },
            {
              id: 'delete',
              label: 'Delete',
              danger: true,
              onSelect: () => scene.deleteEntity(row.entityId),
            },
          ],
          setContextMenu,
        )
      }
      icon={<Box size={11} className="flex-shrink-0" aria-hidden />}
      trailing={
        !selected && row.hasLogic ? (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--accent)]"
            title="Has Logic Board rules"
          />
        ) : null
      }
      actions={
        selected ? (
          <>
            <ExplorerLeafActionBtn
              title="Edit logic"
              onClick={(ev) => {
                ev.stopPropagation()
                scene.openEntityLogic(row.entityId)
              }}
            >
              <Workflow size={13} />
            </ExplorerLeafActionBtn>
            <ExplorerLeafActionBtn
              title={row.visible ? 'Hide in game' : 'Show in game'}
              onClick={(ev) => {
                ev.stopPropagation()
                scene.toggleEntityVisible(row.entityId, row.visible)
              }}
            >
              {row.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </ExplorerLeafActionBtn>
            <ExplorerLeafActionBtn
              title="Duplicate"
              onClick={(ev) => {
                ev.stopPropagation()
                scene.duplicateEntity(row.entityId)
              }}
            >
              <Copy size={13} />
            </ExplorerLeafActionBtn>
            <ExplorerLeafActionBtn
              title="Delete"
              onClick={(ev) => {
                ev.stopPropagation()
                scene.deleteEntity(row.entityId)
              }}
            >
              <Trash2 size={13} />
            </ExplorerLeafActionBtn>
          </>
        ) : undefined
      }
    />
  )
}
