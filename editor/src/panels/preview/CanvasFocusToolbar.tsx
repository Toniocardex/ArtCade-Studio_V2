import { Minimize2, Pause, Play, Square } from 'lucide-react'
import { useEditor, useConsoleLogs } from '../../store/editor-store'
import { DEFAULT_WORLD } from '../../types'
import { usePreviewPlayStop } from '../../hooks/usePreviewPlayStop'
import { usePreviewPlayShortcut } from '../../hooks/usePreviewPlayShortcut'
import { ZoomControls } from './ZoomControls'

/** Reduced toolbar shown in Focus mode (play/stop, speed, zoom, coords, exit). */
export function CanvasFocusToolbar() {
  const { state, dispatch } = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { isPlaying, project } = state
  const { cursorPos } = volatile
  const handlePlayStop = usePreviewPlayStop()
  usePreviewPlayShortcut(handlePlayStop)

  const timeScale = { ...DEFAULT_WORLD, ...project?.world }.timeScale

  function nudgeTimeScale(delta: number) {
    if (!project) return
    const next = Math.min(2, Math.max(0, timeScale + delta))
    dispatch({ type: 'WORLD_SET', patch: { timeScale: Math.round(next * 10) / 10 } })
  }

  return (
    <div className="editor-focus-toolbar" data-panel="canvas-focus-toolbar">
      <button
        type="button"
        onClick={handlePlayStop}
        title={isPlaying ? 'Stop (F5)' : 'Play (F5)'}
        className="editor-toolbar-btn editor-toolbar-btn-primary"
      >
        {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        {isPlaying ? 'Stop' : 'Play'}
      </button>

      <button
        type="button"
        disabled
        title="Pause support is planned for the preview runtime"
        className="editor-toolbar-btn"
      >
        <Pause size={12} />
        Pause
      </button>

      <span className="text-[var(--outline)]" aria-hidden>|</span>

      <span className="flex items-center gap-1" title="World time scale">
        <span>Speed</span>
        <button
          type="button"
          className="editor-icon-btn"
          onClick={() => nudgeTimeScale(-0.1)}
          aria-label="Decrease simulation speed"
        >
          -
        </button>
        <span className="text-[var(--primary)] min-w-[2.5rem] text-center">{timeScale.toFixed(1)}x</span>
        <button
          type="button"
          className="editor-icon-btn"
          onClick={() => nudgeTimeScale(0.1)}
          aria-label="Increase simulation speed"
        >
          +
        </button>
      </span>

      <span className="text-[var(--outline)]" aria-hidden>|</span>

      <span className="font-mono">
        X: {cursorPos.x} Y: {cursorPos.y}
      </span>

      <ZoomControls />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_FOCUS_MODE', enabled: false })}
          title="Exit Focus (F11 or Esc)"
          className="editor-toolbar-btn"
        >
          <Minimize2 size={12} />
          Exit Focus
        </button>
      </div>
    </div>
  )
}
