import { useSplashChoreography } from './useSplashChoreography'

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
  const step = useSplashChoreography({ skipped, exiting, onIntroComplete })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] text-[var(--text)] overflow-hidden pointer-events-none select-none font-ui">

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
        <div className="absolute inset-0 z-10 flex items-center justify-center opacity-70 font-mono">
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

    </div>
  )
}
