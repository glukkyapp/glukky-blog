import { useEffect, useRef } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import pigAnimationData from "@assets/wired-flat-453-savings-pig-hover-pinch_1773589181755.json";

interface CoinSavedPopupProps {
  coins: number;
  visible: boolean;
  onDismiss: () => void;
}

export function CoinSavedPopup({ coins, visible, onDismiss }: CoinSavedPopupProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      lottieRef.current?.goToAndPlay(0, true);
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 2500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        animation: "coinPopupFadeIn 0.3s ease-out",
      }}
      data-testid="popup-coin-saved"
    >
      <style>{`
        @keyframes coinPopupFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          borderRadius: "20px",
          padding: "16px 24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          border: "2px solid #14A085",
          minWidth: "160px",
        }}
      >
        <div style={{ width: 110, height: 110 }}>
          <Lottie
            lottieRef={lottieRef}
            animationData={pigAnimationData}
            loop={false}
            autoplay={true}
          />
        </div>
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: "15px",
            color: "#14A085",
            letterSpacing: "0.01em",
          }}
          data-testid="text-coin-saved-count"
        >
          +{coins} coin{coins !== 1 ? "s" : ""} saved!
        </p>
      </div>
    </div>
  );
}
