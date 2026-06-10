import { useRef, useState, useCallback } from 'react'
import { Menu, Hexagon, Moon, Sun } from 'lucide-react'
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
import { DockPanelsViewSection } from './DockPanelsViewSection'
import { EditorUiScaleViewSection } from './EditorUiScaleViewSection'
import { useEditorUiScaleContext } from '../../contexts/editor-ui-scale-context'
import { applyTheme, toggleTheme, type Theme } from '../../utils/theme'
import AuthoringModeSwitch from '../AuthoringModeSwitch'
import { openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'
import ModuleTabs from '../shell/ModuleTabs'

const DOCS_URL = 'https://github.com/Toniocardex/ArtCade-Studio_V2/blob/main/docs/README.md'

function themeFromDocument(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'dark'
}

function MenuSectionLabel({ children }: Readonly<{ children: string }>) {
  return (
    <p className="px-4 pt-2 pb-1 text-[8px] font-bold uppercase tracking-widest text-[var(--muted)] select-none">
      {children}
    </p>
  )
}

function MenuDivider() {
  return <div className="my-1 border-t border-[var(--outline)]" />
}

const menuItemClass =
  'w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]'

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
  const uiScale = useEditorUiScaleContext()
  const [theme, setTheme] = useState<Theme>(themeFromDocument)

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
                <MenuDivider />
                <MenuSectionLabel>Edit</MenuSectionLabel>
                <FileMenuContent items={editItems} />
              </>
            )}
            <MenuDivider />
            <MenuSectionLabel>View</MenuSectionLabel>
            <div className="px-3 py-2 border-b border-[var(--outline-subtle)]">
              <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Authoring</span>
              <div className="mt-2">
                <AuthoringModeSwitch />
              </div>
            </div>
            <EditorUiScaleViewSection uiScale={uiScale} />
            <DockPanelsViewSection />
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                const next = toggleTheme(theme)
                applyTheme(next)
                setTheme(next)
              }}
            >
              <span className="inline-flex items-center gap-2">
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              </span>
            </button>
            <MenuDivider />
            <MenuSectionLabel>Tools</MenuSectionLabel>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                openDialogLibraryModal(dispatch)
                closeMainMenu()
              }}
            >
              Dialog library…
            </button>
            <MenuDivider />
            <MenuSectionLabel>Help</MenuSectionLabel>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="block px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
              onClick={closeMainMenu}
            >
              Documentation…
            </a>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                void navigator.clipboard?.writeText('ArtCade Studio — editor UI refactor 2026')
                closeMainMenu()
              }}
            >
              About ArtCade Studio
            </button>
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
      </div>
    </header>
  )
}
