import { useRef, useState, useCallback, useEffect } from 'react'
import {
  BookOpen,
  Info,
  Menu,
  MessageSquare,
  Moon,
  Sun,
  Pencil,
  FolderOpen,
  Eye,
  Wrench,
  CircleHelp,
} from 'lucide-react'
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
import { openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'
import ModuleTabs from '../shell/ModuleTabs'
import { MainMenuCategory, useMainMenuCascade } from './MainMenu'

const DOCS_URL = 'https://github.com/Toniocardex/ArtCade-Studio_V2/blob/main/docs/README.md'

function themeFromDocument(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'dark'
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
  const authoringMode = useEditorSelector((s) => s.authoringMode)

  const { draft, setDraft, commitDraft, flushBeforePersist } = useProjectNamePersist()

  const [mainMenuOpen, setMainMenuOpen] = useState(false)
  const mainMenuRef = useRef<HTMLDivElement>(null)
  const { activeId, setActiveId } = useMainMenuCascade()
  const closeMainMenu = useCallback(() => {
    setMainMenuOpen(false)
    setActiveId(null)
  }, [setActiveId])
  // Reset the open submenu whenever the root menu re-opens.
  useEffect(() => {
    if (!mainMenuOpen) setActiveId(null)
  }, [mainMenuOpen, setActiveId])
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
          <ToolbarDropdown
            open={mainMenuOpen}
            anchorRef={mainMenuRef}
            onClose={closeMainMenu}
            className="editor-menu-cascade"
          >
            <MainMenuCategory
              id="file"
              label="File"
              icon={<FolderOpen size={14} />}
              activeId={activeId}
              setActiveId={setActiveId}
            >
              <FileMenuContent items={fileItems} />
            </MainMenuCategory>

            {project && (
              <MainMenuCategory
                id="edit"
                label="Edit"
                icon={<Pencil size={14} />}
                activeId={activeId}
                setActiveId={setActiveId}
              >
                <FileMenuContent items={editItems} />
              </MainMenuCategory>
            )}

            <MainMenuCategory
              id="view"
              label="View"
              icon={<Eye size={14} />}
              activeId={activeId}
              setActiveId={setActiveId}
            >
              <div className="px-3 pt-2 pb-1 border-b border-[var(--outline-subtle)]">
                <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Authoring</span>
              </div>
              {(['base', 'advanced'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="menuitemradio"
                  aria-checked={authoringMode === m}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)] flex items-center justify-between border-b border-[var(--outline-subtle)] last:border-b-0"
                  onClick={() => dispatch({ type: 'SET_AUTHORING_MODE', mode: m })}
                >
                  <span className="capitalize">{m}</span>
                  {authoringMode === m && (
                    <span className="text-[var(--accent)] text-[10px]" aria-hidden>●</span>
                  )}
                </button>
              ))}
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
            </MainMenuCategory>

            <MainMenuCategory
              id="tools"
              label="Tools"
              icon={<Wrench size={14} />}
              activeId={activeId}
              setActiveId={setActiveId}
            >
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                onClick={() => {
                  openDialogLibraryModal(dispatch)
                  closeMainMenu()
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <MessageSquare size={14} />
                  Dialog library…
                </span>
              </button>
            </MainMenuCategory>

            <MainMenuCategory
              id="help"
              label="Help"
              icon={<CircleHelp size={14} />}
              activeId={activeId}
              setActiveId={setActiveId}
            >
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="block px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
                onClick={closeMainMenu}
              >
                <span className="inline-flex items-center gap-2">
                  <BookOpen size={14} />
                  Documentation…
                </span>
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
                <span className="inline-flex items-center gap-2">
                  <Info size={14} />
                  About ArtCade Studio
                </span>
              </button>
            </MainMenuCategory>
          </ToolbarDropdown>
        </div>

        {project && (
          <>
            <ProjectNameField
              value={draft}
              committedName={project.projectName}
              onChange={setDraft}
              onCommit={commitDraft}
            />
            <span className="text-[10px] font-mono text-[var(--muted)] shrink-0 hidden sm:inline">
              v{project.version ?? '1.0.0'}
            </span>
          </>
        )}
      </div>

      <div className="editor-toolbar-cluster editor-toolbar-module-center">
        <ModuleTabs />
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
      </div>
    </header>
  )
}
