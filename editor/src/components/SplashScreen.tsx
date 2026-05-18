import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(0); // 0:Idle, 1:Grid, 2:DataFlow, 3:Burst, 4:Text, 5:Closing

  useEffect(() => {
    // Sequenza dell'animazione Synaptic Boot
    const timers = [
      setTimeout(() => setStep(1), 200),   // Appare la Griglia
      setTimeout(() => setStep(2), 600),   // Flusso dati Ciano/Magenta
      setTimeout(() => setStep(3), 1600),  // Flash e apparizione Logo
      setTimeout(() => setStep(4), 2200),  // Scrittura testi
      setTimeout(() => setStep(5), 4500),  // Dissolvenza finale 
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 5200)
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] overflow-hidden pointer-events-none select-none font-mono text-white">
      
      {/* 1. Isometric Grid Background (Appare al step 1) */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${step >= 1 ? 'opacity-30' : 'opacity-0'}`}
           style={{ 
             backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.15) 1px, transparent 1px)', 
             backgroundSize: '60px 60px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)'
           }}>
      </div>

      {/* 2. Data Streams (Appare al step 2, scompare al 3) */}
      {step === 2 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center opacity-70">
          {/* Ciano Streams */}
          <div className="absolute h-px bg-[var(--accent)] animate-stream-h" style={{width: '40vw', top: '45%'}}></div>
          <div className="absolute w-px bg-[var(--accent)] animate-stream-v" style={{height: '40vh', left: '45%'}}></div>
          {/* Magenta Streams (offset) */}
          <div className="absolute h-px bg-[var(--accent-2)] animate-stream-h-reverse" style={{width: '40vw', top: '55%'}}></div>
          <div className="absolute w-px bg-[var(--accent-2)] animate-stream-v-reverse" style={{height: '40vh', left: '55%'}}></div>
          
          {/* Pseudo-code data (flying to center) */}
          <div className="absolute text-[8px] text-[rgb(var(--accent-rgb)/0.5)] animate-data-fly-tl">0xAF 10101 enTT</div>
          <div className="absolute text-[8px] text-[rgb(var(--accent-2-rgb)/0.5)] animate-data-fly-tr">Lua::vm 0011 renderer</div>
          <div className="absolute text-[8px] text-[rgb(var(--accent-rgb)/0.5)] animate-data-fly-bl">SYS_MSG physics_step</div>
          <div className="absolute text-[8px] text-[rgb(var(--accent-2-rgb)/0.5)] animate-data-fly-br">0x00FF WASM_BOOT</div>
        </div>
      )}

      {/* 3. The Core & Logo Burst (Step 3+) */}
      <div className={`relative z-20 flex flex-col items-center gap-10 transition-all duration-700 ${step === 5 ? 'opacity-0 scale-110 blur-lg' : 'opacity-100'}`}>
        
        {/* Logo Container con Burst digitale */}
        <div className={`relative ${step >= 3 ? 'animate-logo-glitch-in' : 'opacity-0'}`}>
          {/* Il Burst Flashead (ONDA QUADRA/PIXELATA) */}
          {step === 3 && (
            <div className="absolute inset-0 bg-white z-0 animate-pixel-flash rounded-lg"></div>
          )}
          
          {/* Il bagliore neon Ciano/Magenta combinato */}
          <div className="absolute -inset-10 z-0 bg-[var(--accent)] blur-[60px] opacity-20 rounded-full animate-synapse-pulse"></div>
          <div className="absolute -inset-10 z-0 bg-[var(--accent-2)] blur-[80px] opacity-10 rounded-full animate-synapse-pulse delay-500"></div>

          {/* L'immagine Caricata */}
          <img 
            src="/artcade_logo.png" 
            alt="ArtCade Logo" 
            className="w-40 h-40 md:w-56 md:h-56 object-contain relative z-10 mix-blend-screen drop-shadow-[0_0_15px_rgba(0,255,255,0.7)]"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { 
                e.currentTarget.style.display = 'none'; 
                if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; 
                }
            }}
          />
          <div style={{display: 'none'}} className="w-40 h-40 border-2 border-dashed border-cyan-500 items-center justify-center text-cyan-500 font-mono text-[9px] text-center p-4">
            [Img /artcade_logo.png mancante nella cartella public/]
          </div>
        </div>

        {/* 4. Texts con Terminale effect (Step 4+) */}
        <div className="flex flex-col items-center gap-2">
          <div className={`text-[var(--muted)] tracking-[0.4em] text-xs uppercase font-mono transition-opacity duration-300 ${step >= 4 ? 'opacity-100' : 'opacity-0'}`}>
            {step === 4 ? <span className="animate-type-fast">Made with</span> : "Made with"}
          </div>
          
          <div className={`relative transition-all duration-700 delay-300 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-[var(--accent)] drop-shadow-[0_0_12px_rgba(0,255,255,0.8)]">
              Artcade
            </h1>
            {/* Glitch Overlay Text */}
            <h1 className="absolute inset-0 text-6xl md:text-8xl font-black tracking-tighter text-[var(--accent-2)] mix-blend-color-dodge opacity-0 hover:opacity-70 animate-text-glitch">
              Artcade
            </h1>
          </div>

          <div className={`mt-5 px-5 py-1 border border-[var(--accent-2)] text-[var(--accent-2)] font-mono text-[9px] tracking-widest uppercase bg-[rgb(var(--accent-2-rgb)/0.05)] shadow-[0_0_10px_rgba(255,0,255,0.3)] transition-all duration-500 delay-700 ${step >= 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            Free Edition / C++ Core
          </div>
        </div>
      </div>

      {/* --- CUSTOM CSS ANIMATIONS --- */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Data Streams */
        @keyframes stream-h { 0% { left: -40vw; opacity: 0; } 50% { opacity: 1; } 100% { left: 45%; opacity: 0; } }
        @keyframes stream-h-reverse { 0% { right: -40vw; opacity: 0; } 50% { opacity: 1; } 100% { right: 45%; opacity: 0; } }
        @keyframes stream-v { 0% { top: -40vh; opacity: 0; } 50% { opacity: 1; } 100% { top: 45%; opacity: 0; } }
        @keyframes stream-v-reverse { 0% { bottom: -40vh; opacity: 0; } 50% { opacity: 1; } 100% { bottom: 55%; opacity: 0; } }
        .animate-stream-h { animation: stream-h 1s ease-in-out forwards; }
        .animate-stream-h-reverse { animation: stream-h-reverse 1s ease-in-out forwards; }
        .animate-stream-v { animation: stream-v 1s ease-in-out forwards; }
        .animate-stream-v-reverse { animation: stream-v-reverse 1s ease-in-out forwards; }

        /* Data flying to center */
        @keyframes data-fly-tl { 0% { top: 10%; left: 10%; opacity: 1; } 100% { top: 45%; left: 45%; opacity: 0; scale: 0.5; } }
        @keyframes data-fly-tr { 0% { top: 10%; right: 10%; opacity: 1; } 100% { top: 45%; right: 45%; opacity: 0; scale: 0.5; } }
        @keyframes data-fly-bl { 0% { bottom: 10%; left: 10%; opacity: 1; } 100% { bottom: 45%; left: 45%; opacity: 0; scale: 0.5; } }
        @keyframes data-fly-br { 0% { bottom: 10%; right: 10%; opacity: 1; } 100% { bottom: 45%; right: 45%; opacity: 0; scale: 0.5; } }
        .animate-data-fly-tl { animation: data-fly-tl 0.8s ease-in forwards; }
        .animate-data-fly-tr { animation: data-fly-tr 0.8s 0.2s ease-in forwards; }
        .animate-data-fly-bl { animation: data-fly-bl 0.8s 0.1s ease-in forwards; }
        .animate-data-fly-br { animation: data-fly-br 0.8s 0.3s ease-in forwards; }

        /* Pixel Flash Burst */
        @keyframes pixel-flash {
          0% { transform: scale(0.1); opacity: 1; filter: blur(0px); }
          50% { transform: scale(1.5); opacity: 0.8; filter: blur(2px); }
          100% { transform: scale(2); opacity: 0; filter: blur(10px); }
        }
        .animate-pixel-flash { animation: pixel-flash 0.4s ease-out forwards; }

        /* Logo In Glitch */
        @keyframes logo-glitch-in {
          0% { opacity: 0; transform: scale(0.5); filter: hue-rotate(90deg) brightness(2); }
          10% { opacity: 1; transform: scale(1.1) skewX(-10deg); filter: hue-rotate(0deg) brightness(1); }
          20% { transform: scale(1) skewX(10deg); }
          30% { transform: skewX(0deg); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-logo-glitch-in { animation: logo-glitch-in 0.8s ease-out forwards; }

        /* Pulse */
        @keyframes synapse-pulse { 0%, 100% { opacity: 0.15; transform: scale(0.95); } 50% { opacity: 0.35; transform: scale(1.05); } }
        .animate-synapse-pulse { animation: synapse-pulse 4s ease-in-out infinite; }

        /* Terminal Type */
        @keyframes type-fast { from { width: 0; } to { width: 100%; } }
        .animate-type-fast { overflow: hidden; white-space: nowrap; display: inline-block; animation: type-fast 0.4s steps(20, end) forwards; border-right: 2px solid var(--muted); }
        
        /* Text Glitch */
        @keyframes text-glitch {
          0%, 100% { opacity: 0; transform: translate(0); }
          20% { opacity: 0.7; transform: translate(-3px, 2px); }
          40% { opacity: 0.7; transform: translate(3px, -2px); mix-blend-mode: exclusion; }
          60% { opacity: 0; transform: translate(0); }
        }
        .animate-text-glitch { animation: text-glitch 2s 3s infinite; }
      `}} />
    </div>
  );
};

export default SplashScreen;