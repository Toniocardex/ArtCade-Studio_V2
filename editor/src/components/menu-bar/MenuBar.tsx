import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { FileMenu } from './FileMenu'
import { useEditMenuActions } from './useEditMenuActions'
import { ProjectNameField } from './ProjectNameField'
import { BuildToolbar } from './BuildToolbar'
import { useFileMenuActions } from './useFileMenuActions'
import { useBuildToolbarActions } from './useBuildToolbarActions'
import { mapWebExportToolbar, useWebExportStatus } from './useWebExportStatus'
import { useProjectNamePersist } from './project-name-context'
import { usePreviewPlayShortcut } from '../../hooks/usePreviewPlayShortcut'
import { ViewToolbarMenu } from './ViewToolbarMenu'
import { ToolsMenu } from './ToolsMenu'

export default function MenuBar() {
  const { state, dispatch } = useEditor()
  const {
    isPlaying,
    project,
    projectPath,
    projectDirty,
    openScripts,
    activeScriptPath,
    dialogs,
    selection,
    mode,
  } = state

  const { draft, setDraft, commitDraft, flushBeforePersist } = useProjectNamePersist()

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const editMenuRef = useRef<HTMLDivElement>(null)
  const closeFileMenu = useCallback(() => setFileMenuOpen(false), [])
  const closeEditMenu = useCallback(() => setEditMenuOpen(false), [])

  useEffect(() => {
    if (!fileMenuOpen && !editMenuOpen) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (fileMenuOpen && fileMenuRef.current && !fileMenuRef.current.contains(t)) {
        setFileMenuOpen(false)
      }
      if (editMenuOpen && editMenuRef.current && !editMenuRef.current.contains(t)) {
        setEditMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [fileMenuOpen, editMenuOpen])

  const { fileItems } = useFileMenuActions({
    dispatch,
    project,
    projectPath,
    projectDirty,
    dialogs,
    openScripts,
    activeScriptPath,
    closeMenu: closeFileMenu,
    flushBeforePersist,
  })

  const { editItems } = useEditMenuActions({
    state,
    dispatch,
    closeMenu: closeEditMenu,
  })

  const webExport = useWebExportStatus(projectPath, projectDirty, project?.projectName)

  const buildToolbar = useBuildToolbarActions({
    dispatch,
    project,
    projectPath,
    dialogs,
    webExportState: webExport.status.state,
    refreshWebExportStatus: webExport.refreshWebExportStatus,
    isPlaying,
    mode,
    openScripts,
    selectionSceneId: selection.sceneId,
    flushBeforePersist,
  })

  const { exportState } = mapWebExportToolbar(webExport.status)

  usePreviewPlayShortcut(buildToolbar.handlePlayStop)

  return (
    <header className="editor-toolbar flex items-center justify-between flex-shrink-0 z-50 select-none">
      <div className="relative flex items-center gap-1 editor-toolbar-workspace-start">
        <div ref={fileMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setEditMenuOpen(false)
              setFileMenuOpen((v) => !v)
            }}
            className={`editor-toolbar-btn border ${
              fileMenuOpen
                ? 'border-[var(--border-2)] bg-[var(--border)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--panel-3)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-2)]'
            }`}
          >
            FILE
            <ChevronDown size={10} className={`transition-transform ${fileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {fileMenuOpen && <FileMenu items={fileItems} />}
        </div>
        {project && (
          <div ref={editMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false)
                setEditMenuOpen((v) => !v)
              }}
              className={`editor-toolbar-btn border ${
                editMenuOpen
                  ? 'border-[var(--border-2)] bg-[var(--border)] text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--panel-3)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-2)]'
              }`}
            >
              EDIT
              <ChevronDown size={10} className={`transition-transform ${editMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {editMenuOpen && <FileMenu items={editItems} />}
          </div>
        )}
        {project && (
          <ProjectNameField
            value={draft}
            committedName={project.projectName}
            onChange={setDraft}
            onCommit={commitDraft}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <BuildToolbar
          isPlaying={isPlaying}
          buildBusy={buildToolbar.buildBusy}
          isBuilding={buildToolbar.isBuilding}
          isBuildingWeb={buildToolbar.isBuildingWeb}
          isOpeningWeb={buildToolbar.isOpeningWeb}
          exportState={exportState}
          onPlayStop={buildToolbar.handlePlayStop}
          onBuildExe={buildToolbar.handleBuildExe}
          onBuildWeb={buildToolbar.handleBuildWeb}
          onOpenWebInBrowser={buildToolbar.handleOpenWebInBrowser}
        />
        <ToolsMenu />
        <ViewToolbarMenu />
      </div>
    </header>
  )
}
