import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Crown, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import {
  isNativelyAvailable,
  purchasePackage,
  restorePurchases,
  isPremiumFromCustomerInfo,
} from "@/lib/natively-purchases";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  onPurchaseSuccess: () => void;
  lockApp?: boolean;
}

export default function PaywallModal({ open, onClose, onPurchaseSuccess, lockApp }: PaywallModalProps) {
  const { t } = useTranslation();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNative = isNativelyAvailable();

  const handlePurchase = async () => {
    if (!isNative) return;
    setPurchasing(true);
    setError(null);
    hapticTap("MEDIUM");

    const result = await purchasePackage("$rc_monthly");
    if (result.success) {
      hapticNotify("SUCCESS");
      try {
        await fetch("/api/update-premium-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ isPremium: true }),
        });
      } catch {}
      onPurchaseSuccess();
    } else if (result.error !== "cancelled") {
      hapticNotify("ERROR");
      setError(t("paywall.error_purchase"));
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    if (!isNative) return;
    setRestoring(true);
    setError(null);
    hapticTap("LIGHT");

    const result = await restorePurchases();
    if (result.success && isPremiumFromCustomerInfo(result.customerInfo || null)) {
      hapticNotify("SUCCESS");
      try {
        await fetch("/api/update-premium-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ isPremium: true }),
        });
      } catch {}
      onPurchaseSuccess();
    } else {
      setError(t("paywall.error_restore"));
    }
    setRestoring(false);
  };

  const handleMaybeLater = () => {
    if (lockApp) return;
    hapticTap("SOFT");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50"
          data-testid="paywall-overlay"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-background rounded-t-3xl px-6 pt-6 pb-10 shadow-xl"
            data-testid="paywall-modal"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="w-7 h-7 text-primary" />
              </div>

              <h2 className="text-xl font-bold" data-testid="text-paywall-title">
                {t("paywall.title")}
              </h2>
              <p className="text-sm text-muted-foreground" data-testid="text-paywall-subtitle">
                {t("paywall.subtitle")}
              </p>

              <div className="w-full flex flex-col gap-2 text-left text-sm mt-2">
                {["feature_plans", "feature_snap", "feature_roadmap", "feature_insights"].map((key) => (
                  <div key={key} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{t(`paywall.${key}`)}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive" data-testid="text-paywall-error">{error}</p>
              )}

              {isNative ? (
                <div className="w-full flex flex-col gap-3 mt-4">
                  <Button
                    className="w-full h-12 text-base gap-2"
                    onClick={handlePurchase}
                    disabled={purchasing || restoring}
                    data-testid="button-paywall-subscribe"
                  >
                    <Sparkles className="w-5 h-5" />
                    {purchasing ? t("paywall.processing") : t("paywall.subscribe_button")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRestore}
                    disabled={purchasing || restoring}
                    data-testid="button-paywall-restore"
                  >
                    {restoring ? t("paywall.processing") : t("paywall.restore")}
                  </Button>
                  {!lockApp && (
                    <button
                      onClick={handleMaybeLater}
                      className="text-sm text-muted-foreground underline mt-1"
                      data-testid="button-paywall-maybe-later"
                    >
                      {t("paywall.maybe_later")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3 mt-4">
                  <div className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3">
                    <p className="text-sm text-muted-foreground text-center" data-testid="text-paywall-native-hint">
                      {t("paywall.open_in_app")}
                    </p>
                  </div>
                  {!lockApp && (
                    <button
                      onClick={handleMaybeLater}
                      className="text-sm text-muted-foreground underline"
                      data-testid="button-paywall-maybe-later"
                    >
                      {t("paywall.maybe_later")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
