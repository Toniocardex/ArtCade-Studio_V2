import { useRef, useState, useCallback } from 'react'
import { ChevronDown, Hexagon } from 'lucide-react'
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
import { HelpMenu } from './HelpMenu'

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
      <div className="editor-toolbar-cluster editor-toolbar-workspace-start">
        <div className="hidden min-w-0 items-center gap-2 pr-2 text-[var(--primary)] lg:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--surface-3)]">
            <Hexagon size={14} />
          </span>
          <span className="truncate text-[12px] font-semibold">ArtCade Studio</span>
        </div>
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
            File
            <ChevronDown size={10} className={`transition-transform ${fileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          <FileMenu
            items={fileItems}
            open={fileMenuOpen}
            anchorRef={fileMenuRef}
            onClose={closeFileMenu}
          />
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
              Edit
              <ChevronDown size={10} className={`transition-transform ${editMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <FileMenu
              items={editItems}
              open={editMenuOpen}
              anchorRef={editMenuRef}
              onClose={closeEditMenu}
            />
          </div>
        )}
        {project && (
          <div className="flex items-center gap-2 min-w-0">
            <ProjectNameField
              value={draft}
              committedName={project.projectName}
              onChange={setDraft}
              onCommit={commitDraft}
            />
            <span className="text-[10px] font-mono text-[var(--muted)] shrink-0">
              v{project.version ?? '1.0.0'}
            </span>
          </div>
        )}
      </div>

      <div className="editor-toolbar-actions">
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
        <div className="editor-toolbar-menus">
          <ToolsMenu />
          <ViewToolbarMenu />
          <HelpMenu />
        </div>
      </div>
    </header>
  )
}
