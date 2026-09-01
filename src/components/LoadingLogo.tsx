interface LoadingLogoProps {
  label?: string;
  size?: number;
}

function LoadingLogo({ label = "Cargando", size = 96 }: LoadingLogoProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-md">
      <img
        src="/mister-pan-watermark.png"
        alt="Mister Pan"
        style={{ width: size, height: size }}
        className="object-contain animate-[loadingPulse_1.4s_ease-in-out_infinite]"
      />
      <p className="font-body-md text-body-md text-on-surface-variant tracking-wide">{label}</p>
      <style>{`
        @keyframes loadingPulse {
          0%, 100% { transform: scale(0.88); opacity: 0.75; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default LoadingLogo;
