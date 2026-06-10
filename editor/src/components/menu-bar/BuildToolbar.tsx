import { useCallback, useRef, useState } from 'react'
import { Play, Square, Hammer, Globe2, ExternalLink, ChevronDown } from 'lucide-react'
import { editorToolbarPrimary } from '../ui/editor-ui-classes'
import { ToolbarDropdown } from './ToolbarDropdown'

interface BuildToolbarProps {
  isPlaying: boolean
  buildBusy: boolean
  isBuilding: boolean
  isBuildingWeb: boolean
  isOpeningWeb: boolean
  exportState: 'missing' | 'stale' | 'ready'
  onPlayStop: () => void
  onBuildExe: () => void
  onBuildWeb: () => void
  onOpenWebInBrowser: () => void
}

const menuItemClass =
  'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors'

export function BuildToolbar({
  isPlaying,
  buildBusy,
  isBuilding,
  isBuildingWeb,
  isOpeningWeb,
  exportState,
  onPlayStop,
  onBuildExe,
  onBuildWeb,
  onOpenWebInBrowser,
}: BuildToolbarProps) {
  const [buildOpen, setBuildOpen] = useState(false)
  const buildAnchorRef = useRef<HTMLDivElement>(null)
  const closeBuild = useCallback(() => setBuildOpen(false), [])

  const canOpen = exportState === 'ready' && !buildBusy

  const previewLabel =
    isOpeningWeb ? 'Opening browser…'
    : exportState === 'ready' ? 'Preview in browser'
    : exportState === 'stale' ? 'Preview (outdated — rebuild)'
    : 'Preview (build Web first)'

  const previewTitle =
    isOpeningWeb ? 'Opening browser…'
    : exportState === 'ready' ? 'Open web export in browser (localhost)'
    : exportState === 'stale' ? 'Project changed — run Build Web to refresh'
    : 'Run Build Web to create a browser export'

  return (
    <div className="editor-toolbar-cluster editor-toolbar-build">
      <button
        type="button"
        onClick={(e) => {
          onPlayStop()
          requestAnimationFrame(() => (e.currentTarget as HTMLButtonElement).blur())
        }}
        onKeyDown={(e) => {
          if (e.code === 'Space') e.preventDefault()
        }}
        title="Run / Stop preview in editor (F5)"
        className={`editor-toolbar-btn border font-medium ${
          isPlaying
            ? 'border-[var(--danger)] bg-[rgb(var(--danger-rgb)/0.12)] text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.2)]'
            : editorToolbarPrimary
        }`}
      >
        {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        {isPlaying ? 'Stop' : 'Play'}
      </button>

      <div ref={buildAnchorRef} className="relative">
        <button
          type="button"
          onClick={() => setBuildOpen((v) => !v)}
          title="Build targets"
          aria-expanded={buildOpen}
          className={`editor-toolbar-btn border ${
            buildOpen
              ? 'border-[var(--outline-strong)] bg-[var(--surface-selected)] text-[var(--text-on-selected)]'
              : 'border-[var(--outline-strong)] bg-transparent text-[var(--primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <Hammer size={12} className={buildBusy ? 'animate-pulse' : ''} />
          {buildBusy ? 'Building…' : 'Build'}
          <ChevronDown size={10} className={buildOpen ? 'rotate-180' : ''} />
        </button>
        <ToolbarDropdown open={buildOpen} anchorRef={buildAnchorRef} align="right" onClose={closeBuild}>
          <button
            type="button"
            role="menuitem"
            disabled={buildBusy}
            title="Build native desktop executable"
            className={`${menuItemClass} ${
              buildBusy
                ? 'text-[var(--muted)] cursor-not-allowed'
                : 'text-[var(--primary)] hover:bg-[var(--surface-hover)]'
            }`}
            onClick={() => {
              onBuildExe()
              closeBuild()
            }}
          >
            <Hammer size={13} className={isBuilding ? 'animate-pulse' : ''} />
            {isBuilding ? 'Building .EXE…' : 'Build .EXE'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={buildBusy}
            title="Build Web package"
            className={`${menuItemClass} ${
              buildBusy
                ? 'text-[var(--muted)] cursor-not-allowed'
                : 'text-[var(--primary)] hover:bg-[var(--surface-hover)]'
            }`}
            onClick={() => {
              onBuildWeb()
              closeBuild()
            }}
          >
            <Globe2 size={13} className={isBuildingWeb ? 'animate-pulse' : ''} />
            {isBuildingWeb ? 'Exporting Web…' : 'Build Web'}
          </button>
          <div className="my-1 border-t border-[var(--outline)]" />
          <button
            type="button"
            role="menuitem"
            disabled={!canOpen}
            title={previewTitle}
            className={`${menuItemClass} ${
              canOpen
                ? 'text-[var(--primary)] hover:bg-[var(--surface-hover)]'
                : 'text-[var(--muted)] cursor-not-allowed opacity-70'
            }`}
            onClick={() => {
              if (!canOpen) return
              onOpenWebInBrowser()
              closeBuild()
            }}
          >
            <ExternalLink size={13} className={isOpeningWeb ? 'animate-pulse' : ''} />
            {previewLabel}
          </button>
        </ToolbarDropdown>
      </div>
    </div>
  )
}
