import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { FileMenu } from './FileMenu'
import { ProjectNameField } from './ProjectNameField'
import { BuildToolbar } from './BuildToolbar'
import { useFileMenuActions } from './useFileMenuActions'
import { useBuildToolbarActions } from './useBuildToolbarActions'
import { mapWebExportToolbar, useWebExportStatus } from './useWebExportStatus'
import { useProjectNamePersist } from './project-name-context'
import { usePreviewPlayShortcut } from '../../hooks/usePreviewPlayShortcut'

export default function MenuBar() {
  const { state, dispatch } = useEditor()
  const {
    isPlaying,
    project,
    projectPath,
    projectDirty,
    openScripts,
    activeScriptPath,
    selection,
    mode,
  } = state

  const { draft, setDraft, commitDraft, flushBeforePersist } = useProjectNamePersist()

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const closeFileMenu = useCallback(() => setFileMenuOpen(false), [])

  useEffect(() => {
    if (!fileMenuOpen) return
    function onDown(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [fileMenuOpen])

  const { fileItems } = useFileMenuActions({
    dispatch,
    project,
    projectPath,
    projectDirty,
    openScripts,
    activeScriptPath,
    closeMenu: closeFileMenu,
    flushBeforePersist,
  })

  const webExport = useWebExportStatus(projectPath, projectDirty, project?.projectName)

  const buildToolbar = useBuildToolbarActions({
    dispatch,
    project,
    projectPath,
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
      <div ref={fileMenuRef} className="relative flex items-center editor-toolbar-workspace-start">
        <button
          type="button"
          onClick={() => setFileMenuOpen((v) => !v)}
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
        {project && (
          <ProjectNameField
            value={draft}
            committedName={project.projectName}
            onChange={setDraft}
            onCommit={commitDraft}
          />
        )}
      </div>

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
    </header>
  )
}
