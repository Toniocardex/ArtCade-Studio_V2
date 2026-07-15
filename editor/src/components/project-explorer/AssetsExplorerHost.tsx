import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { openDialogEditorForId, openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'
import { assetFolderItemCount, buildProjectExplorerData } from '../../utils/project-explorer-tree'
import { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import { ProjectSearch } from './ProjectSearch'
import { AssetsTreeSection } from './AssetsTreeSection'
import { AssetFileInputs } from './AssetFileInputs'
import { DialogsSection } from './DialogsSection'
import {
  ExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import { useSharedExplorerExpanded } from './ExplorerExpandedContext'
import { ExplorerEmptyProject, ExplorerFooter } from './explorer-panel-chrome'

/** Assets + dialogs host — owns Delete shortcut and file inputs; no Insert binding. */
export function AssetsExplorerHost() {
  const dispatch = useEditorDispatch()
  const openScripts = useEditorSelector((s) => s.openScripts)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const projectLoadEpoch = useEditorSelector((s) => s.projectLoadEpoch)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const project = useEditorSelector((s) => s.project)
  const selectedEntityId = useEditorSelector((s) => s.selection.entityId)
  const sceneId = useEditorSelector((s) => s.selection.sceneId ?? s.project?.activeSceneId ?? '')
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
  const assetsAnchorRef = useRef<HTMLDivElement>(null)
  const { isOpen, toggle, setOpen, allAssetLibraryFoldersExpanded, toggleAllAssetFolders } =
    useSharedExplorerExpanded()
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

  if (!project || !tree) {
    return <ExplorerEmptyProject />
  }

  const sceneCount = Object.keys(project.scenes ?? {}).length
  const instanceCount = project.scenes?.[sceneId]?.instances?.length ?? 0

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
      <div ref={assetsAnchorRef} className="panel-scroll flex-1 min-h-0">
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
      <ExplorerFooter
        sceneCount={sceneCount}
        typeCount={Object.keys(project.objectTypes ?? {}).length}
        instanceCount={instanceCount}
      />
    </div>
  )
}
