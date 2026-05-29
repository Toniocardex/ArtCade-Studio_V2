import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type TransitionEvent, type ReactNode,
} from 'react'
import SplashScreen from './SplashScreen'
import {
  canSkipBootIntro,
  shouldShowBootLoadingStatus,
  shouldStartBootFade,
  SPLASH_MIN_VISIBLE_MS,
} from './boot-gate-logic'
import { useEditorBootReady } from '../hooks/useEditorBootReady'
import { revealTauriWindowForSplash } from '../utils/boot-chrome'
import { warmWasmBinary } from '../utils/wasm-bridge'

export interface EditorBootGateProps {
  children: ReactNode
}

/**
 * Full-screen boot gate: splash plays its intro, holds on the title, then fades
 * only when the engine is ready and the minimum splash time has elapsed.
 * Skip jumps to the title hold once runtime is fully ready; fade still respects
 * minimum splash time and intro completion (including the skip hold beat).
 */
export default function EditorBootGate({ children }: EditorBootGateProps) {
  const { ready, timedOut, statusLine, retry } = useEditorBootReady()
  const splashStartedAtRef = useRef(Date.now())
  const [introSkipped, setIntroSkipped] = useState(false)
  const [introComplete, setIntroComplete] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    void warmWasmBinary()
  }, [])

  useLayoutEffect(() => {
    document.getElementById('boot-shell')?.remove()
    revealTauriWindowForSplash()
  }, [])

  const skipIntro = useCallback(() => setIntroSkipped(true), [])
  const onIntroComplete = useCallback(() => setIntroComplete(true), [])

  useEffect(() => {
    if (!ready || !introComplete || bootComplete || fadeOut) return undefined

    const startFade = () => {
      setFadeOut(true)
    }

    const now = Date.now()
    const started = splashStartedAtRef.current
    if (shouldStartBootFade({
      ready,
      introComplete,
      bootComplete: false,
      fadeOut: false,
      nowMs: now,
      splashStartedAtMs: started,
    })) {
      startFade()
      return undefined
    }

    const remaining = SPLASH_MIN_VISIBLE_MS - (now - started)
    const t = globalThis.setTimeout(startFade, remaining)
    return () => globalThis.clearTimeout(t)
  }, [ready, introComplete, bootComplete, fadeOut])

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
  const showLoadingStatus = shouldShowBootLoadingStatus({ introComplete, ready, timedOut })
  const skipEnabled = canSkipBootIntro({ ready, introSkipped })

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
            skipped={introSkipped}
            exiting={fadeOut}
            onIntroComplete={onIntroComplete}
          />
          <button
            type="button"
            onClick={skipIntro}
            disabled={!skipEnabled}
            title={skipEnabled ? 'Skip intro animation' : 'Available when loading finishes'}
            className="fixed bottom-6 right-6 z-[110] px-3 py-1.5 rounded text-[10px] font-semibold
                       border border-[var(--border-2)] text-[var(--muted)]
                       hover:text-[var(--text)] hover:border-[var(--accent-bd)] pointer-events-auto
                       disabled:opacity-40 disabled:pointer-events-none"
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
