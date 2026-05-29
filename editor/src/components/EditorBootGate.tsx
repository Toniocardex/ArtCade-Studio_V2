import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import SplashScreen from './SplashScreen'
import { BootLoadingOverlay } from './BootLoadingOverlay'
import { useEditorBootReady } from '../hooks/useEditorBootReady'
import { hasSeenBootSplash, markBootSplashSeen } from '../utils/editor-boot-storage'
import { runtimeSync } from '../utils/runtime-sync-service'

export interface EditorBootGateProps {
  children: ReactNode
}

/**
 * Full-screen boot gate: editor shell mounts underneath (WASM + project load)
 * while the overlay blocks interaction. Dismisses only when runtime, EditorAPI,
 * blank project, and first project→WASM sync are all ready.
 *
 * First launch: marketing SplashScreen (once per machine), then spinner if needed.
 */
export default function EditorBootGate({ children }: EditorBootGateProps) {
  // Synchronous reset before descendants mount/effects — avoids parent useEffect
  // running after PreviewPanel and clearing engine/boot flags (race on warm WASM).
  const sessionResetDone = useRef(false)
  if (!sessionResetDone.current) {
    sessionResetDone.current = true
    runtimeSync.reset()
  }

  const [showMarketing] = useState(() => !hasSeenBootSplash())
  const { ready, timedOut, statusLine, retry } = useEditorBootReady()

  const [marketingDone, setMarketingDone] = useState(!showMarketing)
  const [bootComplete, setBootComplete] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  const finishMarketing = useCallback(() => {
    markBootSplashSeen()
    setMarketingDone(true)
  }, [])

  useEffect(() => {
    if (!ready || !marketingDone || bootComplete) return
    setFadeOut(true)
    const t = globalThis.setTimeout(() => setBootComplete(true), 280)
    return () => globalThis.clearTimeout(t)
  }, [ready, marketingDone, bootComplete])

  const showOverlay = !bootComplete
  const showSplash = showOverlay && showMarketing && !marketingDone
  const showSpinner = showOverlay && marketingDone

  return (
    <div className="relative h-full w-full min-h-0 flex flex-col overflow-hidden">
      <div
        className={`flex flex-1 min-h-0 flex-col overflow-hidden transition-opacity duration-300 ${
          bootComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!bootComplete}
      >
        {children}
      </div>

      {showOverlay && (
        <div
          className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
            fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {showSplash ? (
            <>
              <SplashScreen onComplete={finishMarketing} />
              <button
                type="button"
                onClick={finishMarketing}
                className="fixed bottom-6 right-6 z-[110] px-3 py-1.5 rounded text-[10px] font-semibold
                           border border-[var(--border-2)] text-[var(--muted)]
                           hover:text-[var(--text)] hover:border-[var(--accent-bd)] pointer-events-auto"
              >
                Skip intro
              </button>
            </>
          ) : showSpinner ? (
            <BootLoadingOverlay
              statusLine={statusLine}
              timedOut={timedOut}
              onRetry={retry}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
