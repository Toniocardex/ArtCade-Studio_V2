import { useEffect, useMemo, useRef, useState } from 'react'
import { openDialogEditorForId } from '../../panels/dialog/dialog-modal-api'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../../store/editor-store'
import { assetFolderItemCount, buildProjectExplorerData } from '../../utils/project-explorer-tree'
import { useExplorerExpanded } from '../../hooks/useExplorerExpanded'
import { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { ProjectSearch } from './ProjectSearch'
import { SceneTreeSection } from './SceneTreeSection'
import { AssetsTreeSection } from './AssetsTreeSection'
import { AssetFileInputs } from './AssetFileInputs'
import { DialogsSection } from './DialogsSection'
import {
  ExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'

export type ExplorerPane = 'scene' | 'assets' | 'all'

export type ProjectExplorerPanelProps = Readonly<{
  explorerPane?: ExplorerPane
}>

export default function ProjectExplorerPanel({ explorerPane = 'all' }: ProjectExplorerPanelProps) {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const openScripts = useEditorSelector((s) => s.openScripts)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const projectLoadEpoch = useEditorSelector((s) => s.projectLoadEpoch)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
  const assetsAnchorRef = useRef<HTMLDivElement>(null)
  const { isOpen, toggle, setOpen, allAssetLibraryFoldersExpanded, toggleAllAssetFolders } =
    useExplorerExpanded()
  const scene = useSceneExplorerActions()
  const assets = useAssetExplorerActions()
  const assetFolders = useAssetFolderActions()
  const assetMulti = useAssetTreeMultiSelect()

  useEffect(() => {
    assetMulti.clearMulti()
  }, [search, assetMulti.clearMulti])

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

  const totalAssets = useMemo(() => {
    if (!tree) return 0
    return tree.assetFolders.reduce((n, f) => n + assetFolderItemCount(f), 0)
  }, [tree])

  const prevAssetCountRef = useRef(0)

  useEffect(() => {
    prevAssetCountRef.current = 0
  }, [projectLoadEpoch])

  useEffect(() => {
    if (totalAssets > 0 && prevAssetCountRef.current === 0) {
      setOpen('assets', true)
    }
    prevAssetCountRef.current = totalAssets
  }, [totalAssets, setOpen])

  const toggleAssetFolderExpansion = () => {
    const expanding = !allAssetLibraryFoldersExpanded
    toggleAllAssetFolders()
    if (expanding) {
      assetsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Keep the group of a canvas-selected instance visible in the tree.
  const selectionEntityId = scene.selection.entityId
  useEffect(() => {
    if (selectionEntityId == null || !tree) return
    const group = tree.entityGroups.find((g) =>
      g.instances.some((row) => row.entityId === selectionEntityId),
    )
    if (group) setOpen(`scene-type:${group.typeKey}`, true)
  }, [selectionEntityId, tree, setOpen])

  if (!project || !tree) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--surface)]">
        <span className="text-[var(--muted)] text-xs">No project</span>
      </div>
    )
  }

  const sel = scene.selection
  const selectedEntityId = sel.entityId
  const selectedEntityIds = sel.entityIds ?? (selectedEntityId != null ? [selectedEntityId] : [])
  const showScene = explorerPane === 'all' || explorerPane === 'scene'
  const showAssets = explorerPane === 'all' || explorerPane === 'assets'

  return (
    <div
      className="h-full min-h-0 flex flex-col bg-[var(--panel)]"
      data-panel="project-explorer"
    >
      <ExplorerContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />
      <AssetFileInputs
        imageRef={assets.imageRef}
        audioRef={assets.audioRef}
        fontRef={assets.fontRef}
        tilesetRef={assets.tilesetRef}
        onPickImage={assets.onPickImage}
        onPickAudio={assets.onPickAudio}
        onPickFont={assets.onPickFont}
        onPickTileset={assets.onPickTileset}
      />

      <ProjectSearch value={search} onChange={setSearch} />

      <div className="flex flex-col flex-1 min-h-0">
        {showScene ? (
          <SceneTreeSection
            tree={tree}
            scene={scene}
            selectedEntityId={selectedEntityId}
            selectedEntityIds={selectedEntityIds}
            isOpen={isOpen}
            toggle={toggle}
            setContextMenu={setContextMenu}
          />
        ) : null}

        {showAssets ? (
        <div ref={assetsAnchorRef} className="panel-scroll flex-[2] min-h-0 border-t border-[var(--outline)]">
          <AssetsTreeSection
            project={project}
            projectPath={projectPath}
            tree={tree}
            assets={assets}
            assetFolders={assetFolders}
            assetMulti={assetMulti}
            selectedEntityId={selectedEntityId}
            isOpen={isOpen}
            toggle={toggle}
            setContextMenu={setContextMenu}
            dispatch={dispatch}
            allAssetFoldersExpanded={allAssetLibraryFoldersExpanded}
            onToggleAssetFoldersExpand={toggleAssetFolderExpansion}
          />

          <DialogsSection
            dialogs={dialogs}
            open={isOpen('dialogs')}
            onToggle={() => toggle('dialogs')}
            onOpenDialog={(dialogId) =>
              openDialogEditorForId(dispatch, store.getState().dialogs, dialogId)}
          />
        </div>
        ) : null}
      </div>

      <div className="px-2 py-1 border-t border-[var(--outline)] text-[9px] text-[var(--muted)] flex-shrink-0">
        {scene.sceneCount} scenes · {tree.entityGroups.length} types ·{' '}
        {tree.entityGroups.reduce((n, g) => n + g.instances.length, 0)} objects
      </div>
    </div>
  )
}
