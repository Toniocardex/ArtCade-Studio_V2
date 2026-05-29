import { useState, useEffect } from 'react'

/** Title visible; hold before boot gate may dismiss (no exit blur). */
const INTRO_HOLD_COMPLETE_MS = 4800
/** After skip, brief beat so the title frame paints before intro counts as complete. */
const SKIP_INTRO_COMPLETE_MS = 400

export interface SplashScreenProps {
  /** Intro choreography finished (title held). Does not mean runtime is ready. */
  onIntroComplete?: () => void
  /** Skip animation — jump to title hold frame. */
  skipped?: boolean
  /** Boot gate is fading — play exit blur on the title. */
  exiting?: boolean
}

/** Boot splash every launch. Text-only — no logo image. */
export default function SplashScreen({
  onIntroComplete,
  skipped = false,
  exiting = false,
}: SplashScreenProps) {
  const [step, setStep] = useState(0) // 0 idle, 1 grid, 2 streams, 3 title hold, 4 exit blur

  useEffect(() => {
    if (exiting) {
      setStep(4)
      return undefined
    }
    if (skipped) {
      setStep(3)
      const t = globalThis.setTimeout(() => onIntroComplete?.(), SKIP_INTRO_COMPLETE_MS)
      return () => globalThis.clearTimeout(t)
    }

    const timers = [
      globalThis.setTimeout(() => setStep(1), 200),
      globalThis.setTimeout(() => setStep(2), 600),
      globalThis.setTimeout(() => setStep(3), 1400),
      globalThis.setTimeout(() => onIntroComplete?.(), INTRO_HOLD_COMPLETE_MS),
    ]
    return () => timers.forEach(globalThis.clearTimeout)
  }, [skipped, exiting, onIntroComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] text-[var(--text)] overflow-hidden pointer-events-none select-none font-mono">

      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${step >= 1 ? 'opacity-30' : 'opacity-0'}`}
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.15) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
        }}
      />

      {step === 2 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center opacity-70">
          <div className="absolute h-px bg-[var(--accent)] animate-stream-h" style={{ width: '40vw', top: '45%' }} />
          <div className="absolute w-px bg-[var(--accent)] animate-stream-v" style={{ height: '40vh', left: '45%' }} />
          <div className="absolute h-px bg-[var(--accent-2)] animate-stream-h-reverse" style={{ width: '40vw', top: '55%' }} />
          <div className="absolute w-px bg-[var(--accent-2)] animate-stream-v-reverse" style={{ height: '40vh', left: '55%' }} />
          <div className="absolute text-[8px] text-[rgb(var(--accent-rgb)/0.5)] animate-data-fly-tl">0xAF 10101 enTT</div>
          <div className="absolute text-[8px] text-[rgb(var(--accent-2-rgb)/0.5)] animate-data-fly-tr">Lua::vm 0011 renderer</div>
          <div className="absolute text-[8px] text-[rgb(var(--accent-rgb)/0.5)] animate-data-fly-bl">SYS_MSG physics_step</div>
          <div className="absolute text-[8px] text-[rgb(var(--accent-2-rgb)/0.5)] animate-data-fly-br">0x00FF WASM_BOOT</div>
        </div>
      )}

      <div
        className={`relative z-20 flex flex-col items-center transition-all duration-700 ${
          step === 4 ? 'opacity-0 scale-105 blur-lg' : 'opacity-100'
        }`}
      >
        <div
          className={`transition-all duration-700 ${
            step >= 3 ? 'opacity-100 translate-y-0 animate-title-glitch-in' : 'opacity-0 translate-y-6'
          }`}
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-b from-[var(--text)] via-[var(--text)] to-[var(--accent)]">
            ArtCade Studio
          </h1>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes stream-h { 0% { left: -40vw; opacity: 0; } 50% { opacity: 1; } 100% { left: 45%; opacity: 0; } }
        @keyframes stream-h-reverse { 0% { right: -40vw; opacity: 0; } 50% { opacity: 1; } 100% { right: 45%; opacity: 0; } }
        @keyframes stream-v { 0% { top: -40vh; opacity: 0; } 50% { opacity: 1; } 100% { top: 45%; opacity: 0; } }
        @keyframes stream-v-reverse { 0% { bottom: -40vh; opacity: 0; } 50% { opacity: 1; } 100% { bottom: 55%; opacity: 0; } }
        .animate-stream-h { animation: stream-h 1s ease-in-out forwards; }
        .animate-stream-h-reverse { animation: stream-h-reverse 1s ease-in-out forwards; }
        .animate-stream-v { animation: stream-v 1s ease-in-out forwards; }
        .animate-stream-v-reverse { animation: stream-v-reverse 1s ease-in-out forwards; }

        @keyframes data-fly-tl { 0% { top: 10%; left: 10%; opacity: 1; } 100% { top: 45%; left: 45%; opacity: 0; scale: 0.5; } }
        @keyframes data-fly-tr { 0% { top: 10%; right: 10%; opacity: 1; } 100% { top: 45%; right: 45%; opacity: 0; scale: 0.5; } }
        @keyframes data-fly-bl { 0% { bottom: 10%; left: 10%; opacity: 1; } 100% { bottom: 45%; left: 45%; opacity: 0; scale: 0.5; } }
        @keyframes data-fly-br { 0% { bottom: 10%; right: 10%; opacity: 1; } 100% { bottom: 45%; right: 45%; opacity: 0; scale: 0.5; } }
        .animate-data-fly-tl { animation: data-fly-tl 0.8s ease-in forwards; }
        .animate-data-fly-tr { animation: data-fly-tr 0.8s 0.2s ease-in forwards; }
        .animate-data-fly-bl { animation: data-fly-bl 0.8s 0.1s ease-in forwards; }
        .animate-data-fly-br { animation: data-fly-br 0.8s 0.3s ease-in forwards; }

        @keyframes title-glitch-in {
          0% { opacity: 0; transform: scale(0.92); filter: brightness(1.4); }
          15% { opacity: 1; transform: scale(1.02) skewX(-4deg); filter: brightness(1); }
          30% { transform: scale(1) skewX(3deg); }
          45% { transform: skewX(0deg); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-title-glitch-in { animation: title-glitch-in 0.7s ease-out forwards; }
      ` }} />
    </div>
  )
}
