import { useRef, useState, useCallback } from 'react'
import { Menu, Hexagon } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { canRedoProject, canUndoProject } from '../../store/project-history'
import { FileMenuContent } from './FileMenu'
import { ToolbarDropdown } from './ToolbarDropdown'
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
import ModuleTabs from '../shell/ModuleTabs'

function MenuSectionLabel({ children }: Readonly<{ children: string }>) {
  return (
    <p className="px-4 pt-2 pb-1 text-[8px] font-bold uppercase tracking-widest text-[var(--muted)] select-none">
      {children}
    </p>
  )
}

export default function MenuBar() {
  const dispatch = useEditorDispatch()
  const isPlaying = useEditorSelector((s) => s.isPlaying)
  const undoEnabled = useEditorSelector(canUndoProject)
  const redoEnabled = useEditorSelector(canRedoProject)
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const projectDirty = useEditorSelector((s) => s.projectDirty)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const activeScriptPath = useEditorSelector((s) => s.activeScriptPath)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const selectionSceneId = useEditorSelector((s) => s.selection.sceneId)
  const mode = useEditorSelector((s) => s.mode)

  const { draft, setDraft, commitDraft, flushBeforePersist } = useProjectNamePersist()

  const [mainMenuOpen, setMainMenuOpen] = useState(false)
  const mainMenuRef = useRef<HTMLDivElement>(null)
  const closeMainMenu = useCallback(() => setMainMenuOpen(false), [])

  const { fileItems } = useFileMenuActions({
    dispatch,
    project,
    projectPath,
    projectDirty,
    dialogs,
    openScripts,
    activeScriptPath,
    closeMenu: closeMainMenu,
    flushBeforePersist,
  })

  const { editItems } = useEditMenuActions({
    undoEnabled,
    redoEnabled,
    dispatch,
    closeMenu: closeMainMenu,
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
    selectionSceneId,
    flushBeforePersist,
  })

  const { exportState } = mapWebExportToolbar(webExport.status)

  usePreviewPlayShortcut(buildToolbar.handlePlayStop)

  return (
    <header className="editor-toolbar flex items-center justify-between flex-shrink-0 z-50 select-none">
      <div className="editor-toolbar-cluster editor-toolbar-workspace-start">
        <div ref={mainMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setMainMenuOpen((v) => !v)}
            title="Menu (File / Edit)"
            aria-label="Main menu"
            aria-expanded={mainMenuOpen}
            className={`editor-toolbar-btn border !px-2.5 ${
              mainMenuOpen
                ? 'border-[var(--border-2)] bg-[var(--border)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--panel-3)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-2)]'
            }`}
          >
            <Menu size={14} />
          </button>
          <ToolbarDropdown open={mainMenuOpen} anchorRef={mainMenuRef} onClose={closeMainMenu}>
            <MenuSectionLabel>File</MenuSectionLabel>
            <FileMenuContent items={fileItems} />
            {project && (
              <>
                <div className="my-1 border-t border-[var(--outline)]" />
                <MenuSectionLabel>Edit</MenuSectionLabel>
                <FileMenuContent items={editItems} />
              </>
            )}
          </ToolbarDropdown>
        </div>

        <span
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-[var(--radius)]
                     border border-[var(--outline)] bg-[var(--surface-3)] text-[var(--primary)]"
          title="ArtCade Studio"
        >
          <Hexagon size={14} />
        </span>

        <ModuleTabs />
      </div>

      {project && (
        <div className="flex items-center justify-center gap-2 min-w-0 flex-1">
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
