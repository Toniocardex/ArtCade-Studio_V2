import type { Dispatch, MouseEvent, SetStateAction } from 'react'
import { Copy, FileText, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { TreeLeaf } from './TreeNode'
import { ExplorerRowAction } from './explorer-cta'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import { ExplorerEmptyState } from './ExplorerEmptyState'

type SceneRow = ReturnType<typeof buildProjectExplorerData>['scenes'][number]

export type SceneContextBarProps = Readonly<{
  scenes: readonly SceneRow[]
  visible: boolean
  scene: ReturnType<typeof useSceneExplorerActions>
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
}>

function stopRowAction(ev: MouseEvent) {
  ev.stopPropagation()
}

export function SceneContextBar({
  scenes,
  visible,
  scene,
  setContextMenu,
}: SceneContextBarProps) {
  if (!visible) return null

  const activeSceneName = scene.scene?.name ?? 'No active scene'
  const list = (
    <div className="max-h-[8.75rem] overflow-auto px-1 pb-1">
      {scenes.length === 0 ? (
        <ExplorerEmptyState title="No matches" detail="Clear search to browse scenes." />
      ) : (
        scenes.map((row) => (
          <SceneSwitcherRow
            key={row.sceneId}
            row={row}
            active={scene.sceneId === row.sceneId}
            scene={scene}
            setContextMenu={setContextMenu}
          />
        ))
      )}
    </div>
  )

  return (
    <section className="border-b border-[var(--border)] bg-[var(--panel-2)]">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <FileText size={13} className="text-[var(--accent)] flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] font-semibold text-[var(--text)] truncate">
              {activeSceneName}
            </span>
            {scene.isStartScene ? (
              <span className="shrink-0 rounded border border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.12)] px-1 py-0.5 text-[8px] uppercase font-bold tracking-wide text-[var(--accent)]">
                Start
              </span>
            ) : null}
          </div>
          <p className="text-[9px] text-[var(--muted)]">
            {scene.sceneCount} {scene.sceneCount === 1 ? 'scene' : 'scenes'}
          </p>
        </div>
        <ExplorerRowAction
          title="Add scene"
          tone="accent"
          onClick={(ev) => {
            stopRowAction(ev)
            scene.addScene()
          }}
        >
          <Plus size={13} />
        </ExplorerRowAction>
      </div>

      {scene.sceneCount > 4 ? (
        <details className="border-t border-[var(--outline-faint)]">
          <summary className="cursor-pointer select-none px-2 py-1 text-[9px] uppercase font-bold tracking-widest text-[var(--muted)] hover:text-[var(--text)]">
            Switch scene
          </summary>
          {list}
        </details>
      ) : (
        <div className="border-t border-[var(--outline-faint)] pt-1">{list}</div>
      )}
    </section>
  )
}

function SceneSwitcherRow({
  row,
  active,
  scene,
  setContextMenu,
}: Readonly<{
  row: SceneRow
  active: boolean
  scene: ReturnType<typeof useSceneExplorerActions>
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
}>) {
  const canDelete = !row.isStartScene && scene.sceneCount > 1

  return (
    <TreeLeaf
      label={row.name}
      selected={active}
      onClick={() => scene.selectScene(row.sceneId)}
      onDoubleClick={() => scene.renameSceneById(row.sceneId)}
      onContextMenu={(ev) =>
        openExplorerContextMenu(
          ev,
          [
            {
              id: 'set-start',
              label: 'Set as start scene',
              disabled: row.isStartScene,
              onSelect: () => scene.setStartSceneById(row.sceneId),
            },
            {
              id: 'duplicate',
              label: 'Duplicate scene',
              onSelect: () => scene.duplicateSceneById(row.sceneId),
            },
            {
              id: 'rename',
              label: 'Rename scene',
              onSelect: () => scene.renameSceneById(row.sceneId),
            },
            {
              id: 'delete',
              label: 'Delete scene',
              danger: true,
              disabled: !canDelete,
              onSelect: () => scene.deleteSceneById(row.sceneId),
            },
          ],
          setContextMenu,
        )
      }
      icon={<FileText size={11} className="flex-shrink-0 opacity-70" />}
      trailing={
        row.isStartScene ? (
          <Star size={10} fill="currentColor" className="flex-shrink-0 opacity-90" />
        ) : null
      }
      actions={
        <>
          <ExplorerRowAction
            title={row.isStartScene ? 'Start scene' : 'Set as start scene'}
            disabled={row.isStartScene}
            tone={active ? 'onSelected' : 'default'}
            onClick={(ev) => {
              stopRowAction(ev)
              scene.setStartSceneById(row.sceneId)
            }}
          >
            <Star size={13} fill={row.isStartScene ? 'currentColor' : 'none'} />
          </ExplorerRowAction>
          <ExplorerRowAction
            title="Duplicate scene"
            tone={active ? 'onSelected' : 'default'}
            onClick={(ev) => {
              stopRowAction(ev)
              scene.duplicateSceneById(row.sceneId)
            }}
          >
            <Copy size={13} />
          </ExplorerRowAction>
          <ExplorerRowAction
            title="Rename scene"
            tone={active ? 'onSelected' : 'default'}
            onClick={(ev) => {
              stopRowAction(ev)
              scene.renameSceneById(row.sceneId)
            }}
          >
            <Pencil size={13} />
          </ExplorerRowAction>
          <ExplorerRowAction
            title={canDelete ? 'Delete scene' : 'Cannot delete this scene'}
            disabled={!canDelete}
            tone={active ? 'onSelected' : 'danger'}
            onClick={(ev) => {
              stopRowAction(ev)
              scene.deleteSceneById(row.sceneId)
            }}
          >
            <Trash2 size={13} />
          </ExplorerRowAction>
        </>
      }
    />
  )
}
