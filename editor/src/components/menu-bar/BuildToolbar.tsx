import { Play, Square, Hammer, Globe2, ExternalLink } from 'lucide-react'
interface BuildToolbarProps {
  isPlaying: boolean
  buildBusy: boolean
  isBuilding: boolean
  isBuildingWeb: boolean
  isOpeningWeb: boolean
  canOpenInBrowser: boolean
  openDisabledReason?: string
  exportStatusHint: string
  buildWebHint?: string
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
  canOpenInBrowser,
  openDisabledReason,
  exportStatusHint,
  buildWebHint,
  onPlayStop,
  onBuildExe,
  onBuildWeb,
  onOpenWebInBrowser,
}: BuildToolbarProps) {
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
      <span
        className="text-[10px] text-[var(--muted)] max-w-[7rem] truncate"
        title={buildWebHint ?? exportStatusHint}
      >
        {exportStatusHint}
      </span>

      <button
        type="button"
        onClick={onOpenWebInBrowser}
        disabled={!canOpenInBrowser}
        title={openDisabledReason ?? 'Open last web export in browser (localhost)'}
        className={`editor-toolbar-btn border ${
          isOpeningWeb
            ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
            : !canOpenInBrowser
              ? 'border-[var(--border)] bg-transparent text-[var(--muted)] cursor-not-allowed opacity-60'
              : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)]'
        }`}
      >
        <ExternalLink size={12} className={isOpeningWeb ? 'animate-pulse' : ''} />
        {isOpeningWeb ? 'OPENING…' : 'OPEN IN BROWSER'}
      </button>
    </div>
  )
}
