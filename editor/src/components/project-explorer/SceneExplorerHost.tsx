import { useEffect, useMemo, useState } from 'react'
import { useEditorSelector } from '../../store/editor-store'
import { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { ProjectSearch } from './ProjectSearch'
import { SceneTreeSection } from './SceneTreeSection'
import {
  ExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import { useSharedExplorerExpanded } from './ExplorerExpandedContext'
import { ExplorerEmptyProject, ExplorerFooter } from './explorer-panel-chrome'

/** Scene hierarchy host — owns Insert shortcut; no asset hooks. */
export function SceneExplorerHost() {
  const openScripts = useEditorSelector((s) => s.openScripts)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
  const { isOpen, toggle, setOpen } = useSharedExplorerExpanded()
  const scene = useSceneExplorerActions({ enableInsertShortcut: true })

  const sceneId = scene.sceneId
  const project = scene.project
  const openScriptPaths = useMemo(
    () => openScripts.map((s) => s.path).join('\0'),
    [openScripts],
  )

  const tree = useMemo(() => {
    if (!project) return null
    const extra = openScriptPaths ? openScriptPaths.split('\0') : []
    return buildProjectExplorerData(project, sceneId, search, extra)
  }, [project, sceneId, search, openScriptPaths])

  const selectionEntityId = scene.selection.entityId
  useEffect(() => {
    if (selectionEntityId == null || !tree) return
    const group = tree.entityGroups.find((g) =>
      g.instances.some((row) => row.entityId === selectionEntityId),
    )
    if (group) setOpen(`scene-type:${group.typeKey}`, true)
  }, [selectionEntityId, tree, setOpen])

  if (!project || !tree) {
    return <ExplorerEmptyProject />
  }

  const selectedEntityId = scene.selection.entityId
  const selectedEntityIds =
    scene.selection.entityIds ?? (selectedEntityId != null ? [selectedEntityId] : [])

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--panel)]" data-panel="project-explorer">
      <ExplorerContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />
      <ProjectSearch value={search} onChange={setSearch} />
      <div className="flex flex-col flex-1 min-h-0">
        <SceneTreeSection
          tree={tree}
          scene={scene}
          selectedEntityId={selectedEntityId}
          selectedEntityIds={selectedEntityIds}
          isOpen={isOpen}
          toggle={toggle}
          setContextMenu={setContextMenu}
        />
      </div>
      <ExplorerFooter
        sceneCount={scene.sceneCount}
        typeCount={Object.keys(project.objectTypes ?? {}).length}
        instanceCount={scene.scene?.instances?.length ?? 0}
      />
    </div>
  )
}
