import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { hapticNotify } from "@/lib/haptics";

export function CoinSavedPopup({ coins, visible, onDismiss }: { coins: number; visible: boolean; onDismiss: () => void }) {
  const { t } = useTranslation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      hapticNotify("SUCCESS");
      timerRef.current = setTimeout(onDismiss, 2500);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, onDismiss]);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center justify-center" data-testid="popup-coin-saved">
      <style>{`@keyframes coinPopupFadeIn { 0% { opacity: 0; transform: translateY(10%) scale(.4); } 65% { opacity: 1; transform: translateY(-2%) scale(1.08); } 100% { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      <div className="flex flex-col items-center gap-1" style={{ animation: "coinPopupFadeIn .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
        <div className="w-[96px] h-[96px] rounded-full bg-amber-100 border-4 border-amber-300 shadow-lg flex items-center justify-center text-5xl" aria-hidden="true">🐷</div>
        <p className="m-0 font-bold text-[15px] text-[#14A085]" data-testid="text-coin-saved-count">
          {t("popup.coin_saved", { count: coins })}
        </p>
      </div>
    </div>
  );
}