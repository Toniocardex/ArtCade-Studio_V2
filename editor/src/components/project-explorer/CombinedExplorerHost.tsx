import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { openDialogEditorForId, openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'
import { assetFolderItemCount, buildProjectExplorerData } from '../../utils/project-explorer-tree'
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
import { useSharedExplorerExpanded } from './ExplorerExpandedContext'
import { ExplorerEmptyProject, ExplorerFooter } from './explorer-panel-chrome'

/** Compact "all" host — one Insert listener + one Delete listener in a single tree. */
export function CombinedExplorerHost() {
  const dispatch = useEditorDispatch()
  const openScripts = useEditorSelector((s) => s.openScripts)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const projectLoadEpoch = useEditorSelector((s) => s.projectLoadEpoch)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
  const assetsAnchorRef = useRef<HTMLDivElement>(null)
  const { isOpen, toggle, setOpen, allAssetLibraryFoldersExpanded, toggleAllAssetFolders } =
    useSharedExplorerExpanded()
  const scene = useSceneExplorerActions({ enableInsertShortcut: true })
  const assetMulti = useAssetTreeMultiSelect()
  const assets = useAssetExplorerActions({
    enableDeleteShortcut: true,
    resolveDeleteTargets: () =>
      assetMulti.selectedRefs().map((ref) => ({ type: ref.type, id: ref.id })),
    onSelectionRemoved: () => assetMulti.clearMulti(),
  })
  const assetFolders = useAssetFolderActions()

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

  const selectionEntityId = scene.selection.entityId
  useEffect(() => {
    if (selectionEntityId == null || !tree) return
    const group = tree.entityGroups.find((g) =>
      g.instances.some((row) => row.entityId === selectionEntityId),
    )
    if (group) setOpen(`scene-type:${group.typeKey}`, true)
  }, [selectionEntityId, tree, setOpen])

  const toggleAssetFolderExpansion = () => {
    const expanding = !allAssetLibraryFoldersExpanded
    toggleAllAssetFolders()
    if (expanding) {
      assetsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (!project || !tree) {
    return <ExplorerEmptyProject />
  }

  const selectedEntityId = scene.selection.entityId
  const selectedEntityIds =
    scene.selection.entityIds ?? (selectedEntityId != null ? [selectedEntityId] : [])

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--panel)]" data-panel="project-explorer">
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
        <SceneTreeSection
          tree={tree}
          scene={scene}
          selectedEntityId={selectedEntityId}
          selectedEntityIds={selectedEntityIds}
          isOpen={isOpen}
          toggle={toggle}
          setContextMenu={setContextMenu}
        />
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
            onOpenLibrary={() => openDialogLibraryModal(dispatch)}
            onOpenDialog={(dialogId) => openDialogEditorForId(dispatch, dialogs, dialogId)}
          />
        </div>
      </div>
      <ExplorerFooter
        sceneCount={scene.sceneCount}
        typeCount={Object.keys(project.objectTypes ?? {}).length}
        instanceCount={scene.scene?.instances?.length ?? 0}
      />
    </div>
  )
}
