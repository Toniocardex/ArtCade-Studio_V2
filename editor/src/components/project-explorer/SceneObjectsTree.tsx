import type { Dispatch, SetStateAction } from 'react'
import { Box, Copy, Eye, EyeOff, MoreHorizontal, Plus, Trash2, Workflow } from 'lucide-react'
import type { ExplorerTypeGroup } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { TreeFolder, TreeLeaf } from './TreeNode'
import { ExplorerRowAction } from './explorer-cta'
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
  selectedEntityIds?: readonly number[]
}>

function objectTypeMenuItems(
  group: ExplorerTypeGroup,
  scene: ReturnType<typeof useSceneExplorerActions>,
) {
  const objectTypeId = group.objectTypeId
  if (!objectTypeId) return []

  return [
    {
      id: 'add-instance',
      label: 'Add instance',
      onSelect: () => scene.addInstanceOfType(objectTypeId),
    },
    {
      id: 'rename-type',
      label: 'Rename object type',
      onSelect: () => scene.renameObjectType(objectTypeId),
    },
    {
      id: 'logic',
      label: 'Open Logic Board',
      onSelect: () => scene.openObjectTypeLogic(objectTypeId),
    },
    {
      id: 'delete-type',
      label: 'Delete object',
      danger: true,
      onSelect: () => scene.requestDeleteObject({ kind: 'object-type', objectTypeId }),
    },
  ]
}

/**
 * "Objects in scene" tree body: one collapsible folder per object type, with
 * the scene instances of that type as leaf rows (Construct-style grouping).
 */
export function SceneObjectsTree({
  groups,
  hasSearch,
  scene,
  selectedEntityId,
  selectedEntityIds = selectedEntityId != null ? [selectedEntityId] : [],
  isOpen,
  toggle,
  setContextMenu,
}: SceneObjectsTreeProps) {
  return (
    <>
      {groups.map((group) => {
        const groupKey = `scene-type:${group.typeKey}` as const
        const groupOpen = isOpen(groupKey, false) || hasSearch
        const typeMenuItems = objectTypeMenuItems(group, scene)

        return (
          <TreeFolder
            key={group.typeKey}
            label={group.displayName}
            count={group.instances.length}
            depth={1}
            open={groupOpen}
            onToggle={() => toggle(groupKey, false)}
            trailing={
              group.hasLogic ? (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--accent)]"
                  title="Has Logic Board rules"
                />
              ) : null
            }
            onContextMenu={(ev) => {
              if (typeMenuItems.length === 0) return
              openExplorerContextMenu(ev, typeMenuItems, setContextMenu)
            }}
            actions={
              group.objectTypeId ? (
                <>
                  <ExplorerRowAction
                    title="Add instance"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      scene.addInstanceOfType(group.objectTypeId!)
                    }}
                  >
                    <Plus size={13} />
                  </ExplorerRowAction>
                  <ExplorerRowAction
                    title="Object type actions"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      openExplorerContextMenu(ev, typeMenuItems, setContextMenu)
                    }}
                  >
                    <MoreHorizontal size={13} />
                  </ExplorerRowAction>
                </>
              ) : undefined
            }
          >
            {group.instances.length === 0 ? (
              <div className="py-1 pr-2 text-[10px] text-[var(--muted)]" style={{ paddingLeft: 32 }}>
                No instances in this scene
              </div>
            ) : (
              group.instances.map((row) => (
                <SceneInstanceLeaf
                  key={row.entityId}
                  row={row}
                  scene={scene}
                  selected={selectedEntityIds.includes(row.entityId)}
                  setContextMenu={setContextMenu}
                />
              ))
            )}
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
      onClick={(ev) => scene.selectEntity(row.entityId, ev.ctrlKey || ev.metaKey)}
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
              label: 'Rename instance',
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
              label: 'Duplicate instance',
              onSelect: () => scene.duplicateEntity(row.entityId),
            },
            {
              id: 'delete',
              label: 'Delete instance',
              danger: true,
              onSelect: () => scene.requestDeleteObject({ kind: 'instance', entityId: row.entityId }),
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
        <>
            <ExplorerRowAction
              title="Edit logic"
              tone={selected ? 'onSelected' : 'default'}
              onClick={(ev) => {
                ev.stopPropagation()
                scene.openEntityLogic(row.entityId)
              }}
            >
              <Workflow size={13} />
            </ExplorerRowAction>
            <ExplorerRowAction
              title={row.visible ? 'Hide in game' : 'Show in game'}
              tone={selected ? 'onSelected' : 'default'}
              onClick={(ev) => {
                ev.stopPropagation()
                scene.toggleEntityVisible(row.entityId, row.visible)
              }}
            >
              {row.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </ExplorerRowAction>
            <ExplorerRowAction
              title="Duplicate instance"
              tone={selected ? 'onSelected' : 'default'}
              onClick={(ev) => {
                ev.stopPropagation()
                scene.duplicateEntity(row.entityId)
              }}
            >
              <Copy size={13} />
            </ExplorerRowAction>
            <ExplorerRowAction
              title="Delete instance"
              tone={selected ? 'onSelected' : 'danger'}
              onClick={(ev) => {
                ev.stopPropagation()
                scene.requestDeleteObject({ kind: 'instance', entityId: row.entityId })
              }}
            >
              <Trash2 size={13} />
            </ExplorerRowAction>
          </>
      }
    />
  )
}
