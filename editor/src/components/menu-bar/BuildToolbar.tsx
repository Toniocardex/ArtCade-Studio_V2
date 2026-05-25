import { Play, Square, Hammer, Globe2, ExternalLink } from 'lucide-react'

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
    : exportState === 'ready' ? 'Export ready'
    : exportState === 'stale' ? 'Export outdated'
    : 'No export'

  const badgeTitle =
    isOpeningWeb ? 'Opening browser…'
    : exportState === 'ready' ? 'Open web export in browser (localhost)'
    : exportState === 'stale' ? 'Project changed — run BUILD WEB to refresh'
    : 'Run BUILD WEB first'

  const badgeClass = exportState === 'ready'
    ? 'text-[var(--accent)] border-[var(--accent-bd)] bg-[var(--accent-bg)] hover:bg-[var(--accent-bg-h)] cursor-pointer'
    : exportState === 'stale'
      ? 'text-[color:var(--warn,#f59e0b)] border-[var(--border)] bg-transparent cursor-not-allowed opacity-70'
      : 'text-[var(--muted)] border-[var(--border)] bg-transparent cursor-not-allowed opacity-50'

  return (
    <div className="flex items-center gap-2.5 editor-toolbar-workspace-end">
      <button
        type="button"
        onClick={onPlayStop}
        title="Preview in editor (not the browser export)"
        className={`editor-toolbar-btn border ${
          isPlaying
            ? 'border-[var(--danger)] bg-[rgb(var(--danger-rgb)/0.12)] text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.2)]'
            : 'border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]'
        }`}
      >
        {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        {isPlaying ? 'STOP' : 'PLAY'}
      </button>

      <button
        type="button"
        onClick={onBuildExe}
        disabled={buildBusy}
        className={`editor-toolbar-btn border ${
          isBuilding
            ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
            : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)]'
        }`}
      >
        <Hammer size={12} className={isBuilding ? 'animate-pulse' : ''} />
        {isBuilding ? 'BUILDING…' : 'BUILD .EXE'}
      </button>

      <button
        type="button"
        onClick={onBuildWeb}
        disabled={buildBusy}
        className={`editor-toolbar-btn border ${
          isBuildingWeb
            ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
            : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)]'
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
