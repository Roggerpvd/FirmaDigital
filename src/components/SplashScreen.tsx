
import { useEffect, useState } from "react";

const VISIBLE_MS = 1400; // cuánto se ve el splash antes de empezar a desvanecerse
const FADE_MS = 400; // duración de la transición de desvanecido

interface SplashScreenProps {
  onFinish: () => void;
}

function SplashScreen({ onFinish }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), VISIBLE_MS);
    const finishTimer = setTimeout(onFinish, VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity"
      style={{
        opacity: fadingOut ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <div className="flex flex-col items-center gap-md animate-[splashPop_0.5s_ease-out]">
        <img
          src="/mister-pan-watermark.png"
          alt="Mister Pan"
          className="w-80 h-80 object-contain animate-[loadingPulse_1.4s_ease-in-out_infinite]"        />
        <p className="font-body-md text-body-md text-on-surface-variant tracking-wide">Cargando</p>
      </div>
      <style>{`
        @keyframes splashPop {
          0% { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes loadingPulse {
          0%, 100% { transform: scale(0.88); opacity: 0.75; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;