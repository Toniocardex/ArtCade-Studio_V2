import { useSplashChoreography } from './useSplashChoreography'

export interface SplashScreenProps {
  /** Intro choreography finished (title held). Does not mean runtime is ready. */
  onIntroComplete?: () => void
  /** Skip animation — jump to title hold frame. */
  skipped?: boolean
  /** Boot gate is fading — play exit blur on the title. */
  exiting?: boolean
}

/** Slow drifting dust motes (ambient, decorative). */
const DUST: ReadonlyArray<{ left: string; delay: string }> = [
  { left: '18%', delay: '0s' },
  { left: '34%', delay: '2.1s' },
  { left: '52%', delay: '1.1s' },
  { left: '67%', delay: '3.2s' },
  { left: '82%', delay: '0.6s' },
  { left: '91%', delay: '2.6s' },
]

/** Boot status lines, revealed in sequence under the wordmark. */
const STATUS: ReadonlyArray<string> = [
  'initializing core',
  'compiling lua bytecode',
  'linking renderer',
  'warming wasm runtime',
]

/**
 * Boot splash every launch. Monochrome stage built around the original
 * ArtCade app icon (kept in its canonical dark grey/white form). Intentionally
 * dark regardless of editor theme so the brand mark reads consistently.
 */
export default function SplashScreen({
  onIntroComplete,
  skipped = false,
  exiting = false,
}: SplashScreenProps) {
  const step = useSplashChoreography({ skipped, exiting, onIntroComplete })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none select-none font-ui text-[#E8E8EC]"
      style={{
        background:
          'radial-gradient(110% 80% at 50% 38%, #17171a 0%, #0d0d0f 50%, #070708 100%)',
      }}
    >
      {/* Ambient dust */}
      {step >= 1 && step !== 4 && (
        <div className="absolute inset-0 overflow-hidden">
          {DUST.map((d) => (
            <span
              key={d.left}
              className="absolute bottom-0 w-[2px] h-[2px] rounded-full bg-white/50 animate-splash-dust"
              style={{ left: d.left, animationDelay: d.delay }}
            />
          ))}
        </div>
      )}

      {/* Core: logo + wordmark */}
      <div
        className={`relative z-20 flex flex-col items-center transition-all duration-700 ${
          step === 4 ? 'opacity-0 scale-105 blur-lg' : 'opacity-100'
        }`}
      >
        {step >= 2 && (
          <div className="relative w-[170px] h-[170px] flex items-center justify-center mb-7">
            <div
              className="absolute w-[150px] h-[150px] rounded-full animate-splash-halo"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 68%)',
              }}
            />
            <div className="absolute w-[104px] h-[104px] rounded-[26px] border border-white/20 animate-splash-sonar" />
            <div
              className="absolute w-[104px] h-[104px] rounded-[26px] border border-white/20 animate-splash-sonar"
              style={{ animationDelay: '0.9s' }}
            />

            {/* Original ArtCade app icon — used as-is (canonical dark badge). */}
            <div
              className="relative w-[104px] h-[104px] rounded-[24px] overflow-hidden animate-splash-badge"
              style={{ boxShadow: '0 18px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
            >
              <img src="/app-icon.png" alt="ArtCade" className="block w-full h-full" draggable={false} />
              <div
                className="absolute top-0 left-0 w-[55%] h-full animate-splash-glint"
                style={{
                  background:
                    'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
                }}
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden px-1.5">
          {step >= 3 && (
            <h1 className="text-4xl md:text-6xl font-light tracking-[0.18em] text-center animate-splash-word">
              ArtCade Studio
            </h1>
          )}
        </div>

        {step >= 3 && (
          <p className="mt-4 text-[11px] font-medium text-[#74747c] animate-splash-tag">
            2D&nbsp;&nbsp;GAME&nbsp;&nbsp;ENGINE
          </p>
        )}
      </div>

      {/* Boot loader */}
      {step >= 3 && step !== 4 && (
        <div className="absolute z-20 bottom-[11%] left-1/2 -translate-x-1/2 w-[42%] max-w-[420px] flex flex-col items-center gap-2.5">
          <div className="w-full h-[2px] rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full animate-splash-fill"
              style={{ background: 'linear-gradient(90deg, #6a6a70, #f2f2f4)' }}
            />
          </div>
          <div className="relative w-full h-3 font-mono text-[11px] tracking-[0.14em] text-[#6a6a72] text-center">
            {STATUS.map((line, i) => (
              <span
                key={line}
                className="absolute inset-x-0 opacity-0 animate-splash-status"
                style={{ animationDelay: `${i * 0.85}s` }}
              >
                {line}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
