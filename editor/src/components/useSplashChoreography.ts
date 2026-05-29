import { useEffect, useRef, useState } from 'react'
import {
  SPLASH_INTRO_HOLD_MS,
  SPLASH_SKIP_INTRO_COMPLETE_MS,
  SPLASH_STEP_DELAYS_MS,
} from './splash-choreography'

export type SplashStep = 0 | 1 | 2 | 3 | 4

export interface UseSplashChoreographyOptions {
  skipped?: boolean
  exiting?: boolean
  onIntroComplete?: () => void
}

/**
 * Splash timeline — timers start once per mount (StrictMode-safe).
 * Step 4 (exit blur) only when `exiting`; intro complete fires on title hold, not on blur.
 */
export function useSplashChoreography({
  skipped = false,
  exiting = false,
  onIntroComplete,
}: UseSplashChoreographyOptions): SplashStep {
  const [step, setStep] = useState<SplashStep>(0)
  const phaseRef = useRef<'idle' | 'running' | 'done'>('idle')
  const onIntroCompleteRef = useRef(onIntroComplete)
  onIntroCompleteRef.current = onIntroComplete

  useEffect(() => {
    if (exiting) {
      setStep(4)
      return undefined
    }

    if (phaseRef.current === 'done') return undefined

    const finishIntro = () => {
      if (phaseRef.current === 'done') return
      phaseRef.current = 'done'
      onIntroCompleteRef.current?.()
    }

    if (skipped) {
      if (phaseRef.current === 'idle') phaseRef.current = 'running'
      setStep(3)
      const t = globalThis.setTimeout(finishIntro, SPLASH_SKIP_INTRO_COMPLETE_MS)
      return () => globalThis.clearTimeout(t)
    }

    if (phaseRef.current !== 'idle') return undefined
    phaseRef.current = 'running'

    const timers = [
      globalThis.setTimeout(() => setStep(1), SPLASH_STEP_DELAYS_MS.grid),
      globalThis.setTimeout(() => setStep(2), SPLASH_STEP_DELAYS_MS.streams),
      globalThis.setTimeout(() => setStep(3), SPLASH_STEP_DELAYS_MS.title),
      globalThis.setTimeout(finishIntro, SPLASH_INTRO_HOLD_MS),
    ]
    return () => timers.forEach(globalThis.clearTimeout)
  }, [skipped, exiting])

  return step
}
