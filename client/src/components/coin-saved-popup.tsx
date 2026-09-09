import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { hapticNotify } from "@/lib/haptics";

interface CoinSavedPopupProps {
  visible: boolean;
  onDismiss: () => void;
}

export function CoinSavedPopup({ visible, onDismiss }: CoinSavedPopupProps) {
  const { t } = useTranslation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      hapticNotify("SUCCESS");
      timerRef.current = setTimeout(onDismiss, 2500);
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
        animation: "coinPopupFadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
      data-testid="popup-coin-saved"
    >
      <style>{`
        @keyframes coinPopupFadeIn {
          0%   { opacity: 0; transform: translate(-50%, -40%) scale(0.4); }
          65%  { opacity: 1; transform: translate(-50%, -52%) scale(1.08); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: "15px",
            color: "#14A085",
            letterSpacing: "0.01em",
            textShadow: "0 1px 4px rgba(255,255,255,0.9)",
          }}
          data-testid="text-coin-saved-count"
        >
          {t("popup.garden_grew")}
        </p>
      </div>
    </div>
  );
}