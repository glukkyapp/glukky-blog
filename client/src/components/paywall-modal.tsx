import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import {
  isNativelyAvailable,
  purchasePackage,
  restorePurchases,
  isPremiumFromCustomerInfo,
  getMonthlyPriceString,
} from "@/lib/natively-purchases";
import laurelImg from "@assets/generated_images/laurel-wreath-gold.png";

const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://support-url-generator.com/privacy/jjw2eCXTIxWb";

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
  const [price, setPrice] = useState<string | null>(null);

  const isNative = isNativelyAvailable();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getMonthlyPriceString().then((p) => {
      if (!cancelled) setPrice(p);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const headline = price
    ? t("paywall.headline_with_price", { price })
    : t("paywall.headline_no_price");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed inset-0 z-[100] bg-background overflow-y-auto"
          data-testid="paywall-modal"
        >
          <div className="min-h-full flex flex-col items-center px-6 pt-10 pb-10 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-3 w-full">
              <img
                src={laurelImg}
                alt=""
                aria-hidden="true"
                className="h-12 w-auto select-none pointer-events-none"
                draggable={false}
              />
              <h1
                className="text-2xl font-bold text-center leading-tight"
                data-testid="text-paywall-title"
              >
                {t("paywall.headline_title")}
              </h1>
              <img
                src={laurelImg}
                alt=""
                aria-hidden="true"
                className="h-12 w-auto select-none pointer-events-none"
                style={{ transform: "scaleX(-1)" }}
                draggable={false}
              />
            </div>

            <p
              className="text-base text-foreground/90 text-center mt-6"
              data-testid="text-paywall-headline"
            >
              {headline}
            </p>

            <div className="w-full flex flex-col gap-3 text-left text-sm mt-5">
              {["feature_plans", "feature_snap", "feature_roadmap", "feature_insights"].map((key) => (
                <div key={key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{t(`paywall.${key}`)}</span>
                </div>
              ))}
            </div>

            <p
              className="text-sm font-medium text-primary text-center mt-5"
              data-testid="text-paywall-cup-of-coffee"
            >
              {t("paywall.cup_of_coffee")}
            </p>

            {error && (
              <p className="text-sm text-destructive text-center mt-4" data-testid="text-paywall-error">
                {error}
              </p>
            )}

            {isNative ? (
              <div className="w-full flex flex-col gap-3 mt-6">
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
              <div className="w-full flex flex-col gap-3 mt-6">
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

            <p
              className="text-xs text-muted-foreground text-center mt-6 leading-relaxed"
              data-testid="text-paywall-legal"
            >
              {(() => {
                const TERMS_TOKEN = "__GLUKKY_TERMS__";
                const PRIVACY_TOKEN = "__GLUKKY_PRIVACY__";
                const raw = t("paywall.legal_disclosure", {
                  terms: TERMS_TOKEN,
                  privacy: PRIVACY_TOKEN,
                });
                const nodes: React.ReactNode[] = [];
                let rest = raw;
                let idx = 0;
                while (rest.length > 0) {
                  const tIdx = rest.indexOf(TERMS_TOKEN);
                  const pIdx = rest.indexOf(PRIVACY_TOKEN);
                  const next =
                    tIdx === -1 ? pIdx : pIdx === -1 ? tIdx : Math.min(tIdx, pIdx);
                  if (next === -1) {
                    nodes.push(rest);
                    break;
                  }
                  if (next > 0) nodes.push(rest.slice(0, next));
                  if (next === tIdx) {
                    nodes.push(
                      <a
                        key={`t-${idx++}`}
                        href={TERMS_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                        data-testid="link-paywall-terms"
                      >
                        {t("paywall.legal_terms_link")}
                      </a>,
                    );
                    rest = rest.slice(next + TERMS_TOKEN.length);
                  } else {
                    nodes.push(
                      <a
                        key={`p-${idx++}`}
                        href={PRIVACY_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                        data-testid="link-paywall-privacy"
                      >
                        {t("paywall.legal_privacy_link")}
                      </a>,
                    );
                    rest = rest.slice(next + PRIVACY_TOKEN.length);
                  }
                }
                return nodes;
              })()}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
