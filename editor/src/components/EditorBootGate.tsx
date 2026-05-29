import {
  useCallback, useEffect, useLayoutEffect, useState, type TransitionEvent, type ReactNode,
} from 'react'
import SplashScreen from './SplashScreen'
import { shouldShowBootLoadingStatus, shouldStartBootFade } from './boot-gate-logic'
import { useEditorBootReady } from '../hooks/useEditorBootReady'
import { revealTauriWindowAfterBoot } from '../utils/boot-chrome'
import { warmWasmBinary } from '../utils/wasm-bridge'

export interface EditorBootGateProps {
  children: ReactNode
}

/**
 * Full-screen boot gate: editor shell mounts underneath (WASM + project load)
 * while the splash blocks interaction. Dismisses only when runtime, EditorAPI,
 * blank project, and first project→WASM sync are all ready — and the intro
 * animation has finished or the user skipped it.
 *
 * Tauri window stays hidden until revealTauriWindowAfterBoot() after the gate clears.
 */
export default function EditorBootGate({ children }: EditorBootGateProps) {
  const { ready, timedOut, statusLine, retry } = useEditorBootReady()
  const [introDone, setIntroDone] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    void warmWasmBinary()
  }, [])

  useLayoutEffect(() => {
    document.getElementById('boot-shell')?.remove()
  }, [])

  const skipIntro = useCallback(() => setIntroDone(true), [])

  useEffect(() => {
    if (!shouldStartBootFade({ ready, introDone, bootComplete, fadeOut })) return
    setFadeOut(true)
    revealTauriWindowAfterBoot()
  }, [ready, introDone, bootComplete, fadeOut])

  const onOverlayTransitionEnd = useCallback((e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== 'opacity' || !fadeOut) return
    setBootComplete(true)
  }, [fadeOut])

  // lint-ignore: setTimeout — opacity transitionend may not fire (reduced-motion).
  useEffect(() => {
    if (!fadeOut || bootComplete) return undefined
    const t = globalThis.setTimeout(() => setBootComplete(true), 350)
    return () => globalThis.clearTimeout(t)
  }, [fadeOut, bootComplete])

  const showOverlay = !bootComplete
  const showLoadingStatus = shouldShowBootLoadingStatus({ introDone, ready, timedOut })

  return (
    <div className="relative h-full w-full min-h-0 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div
        className={`flex flex-1 min-h-0 flex-col overflow-hidden transition-opacity duration-300 ease-out ${
          bootComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!bootComplete}
      >
        {children}
      </div>

      {showOverlay && (
        <div
          className={`boot-overlay fixed inset-0 z-[100] bg-[var(--bg)] transition-opacity duration-300 ease-out ${
            fadeOut ? 'boot-overlay--fading opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          onTransitionEnd={onOverlayTransitionEnd}
          role="status"
          aria-live="polite"
          aria-busy={!timedOut}
        >
          <SplashScreen
            fastForward={introDone}
            onIntroComplete={() => setIntroDone(true)}
          />
          <button
            type="button"
            onClick={skipIntro}
            className="fixed bottom-6 right-6 z-[110] px-3 py-1.5 rounded text-[10px] font-semibold
                       border border-[var(--border-2)] text-[var(--muted)]
                       hover:text-[var(--text)] hover:border-[var(--accent-bd)] pointer-events-auto"
          >
            Skip intro
          </button>
          {showLoadingStatus && (
            <p className="fixed bottom-16 left-0 right-0 z-[105] text-center text-[10px] text-[var(--muted)] font-mono pointer-events-none px-6">
              {statusLine}
            </p>
          )}
          {timedOut && (
            <div className="fixed bottom-6 left-6 right-24 z-[110] flex flex-col gap-2 pointer-events-auto max-w-md">
              <p className="text-[11px] text-[var(--danger)] font-mono leading-snug">
                Startup timed out. Check the console for runtime errors, then retry.
              </p>
              <p className="text-[10px] text-[var(--muted)] font-mono">{statusLine}</p>
              <button
                type="button"
                onClick={retry}
                className="self-start px-4 py-1.5 rounded text-xs font-semibold border border-[var(--accent-bd)]
                           bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
