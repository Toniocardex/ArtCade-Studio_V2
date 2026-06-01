import { Play, Square, Hammer, Globe2, ExternalLink } from 'lucide-react'
import { editorToolbarPrimary } from '../ui/editor-ui-classes'

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
  const canOpen = exportState === 'ready' && !buildBusy

  const badgeLabel =
    isOpeningWeb ? 'Opening…'
    : exportState === 'ready' ? 'Preview in Browser'
    : exportState === 'stale' ? 'Outdated — rebuild'
    : 'Build first'

  const badgeTitle =
    isOpeningWeb ? 'Opening browser…'
    : exportState === 'ready' ? 'Open web export in browser (localhost)'
    : exportState === 'stale' ? 'Project changed — run BUILD WEB to refresh'
    : 'Run BUILD WEB to create a browser export'

  const badgeClass = exportState === 'ready'
    ? 'text-[var(--primary)] border-[var(--outline-strong)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] cursor-pointer'
    : exportState === 'stale'
      ? 'text-[color:var(--warn,#f59e0b)] border-[var(--border)] bg-transparent cursor-not-allowed opacity-70'
      : 'text-[var(--muted)] border-[var(--border)] bg-transparent cursor-not-allowed opacity-50'

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
        className={`editor-toolbar-btn border ${
          isPlaying
            ? 'border-[var(--danger)] bg-[rgb(var(--danger-rgb)/0.12)] text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.2)]'
            : editorToolbarPrimary
        }`}
      >
        {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        {isPlaying ? 'STOP' : 'PLAY'}
      </button>

      <button
        type="button"
        onClick={onBuildExe}
        disabled={buildBusy}
        title="Build native desktop executable"
        className={`editor-toolbar-btn border ${
          isBuilding
            ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
            : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--outline-strong)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        <Hammer size={12} className={isBuilding ? 'animate-pulse' : ''} />
        {isBuilding ? 'BUILDING…' : 'BUILD .EXE'}
      </button>

      <button
        type="button"
        onClick={onBuildWeb}
        disabled={buildBusy}
        title="Build Web package"
        className={`editor-toolbar-btn border ${
          isBuildingWeb
            ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
            : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--outline-strong)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        <Globe2 size={12} className={isBuildingWeb ? 'animate-pulse' : ''} />
        {isBuildingWeb ? 'EXPORTING...' : 'BUILD WEB'}
      </button>

      <button
        type="button"
        onClick={canOpen ? onOpenWebInBrowser : undefined}
        disabled={!canOpen}
        title={badgeTitle}
        className={`editor-toolbar-btn border text-[10px] gap-1 ${badgeClass}`}
      >
        <ExternalLink size={10} className={isOpeningWeb ? 'animate-pulse' : ''} />
        {badgeLabel}
      </button>
    </div>
  )
}
