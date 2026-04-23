import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
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
import heroImg from "@assets/2dd316a7-1d08-4d1c-9af7-810af53516b8_1776833621839.png";
import { preloadStage4DietTipThumbnails } from "@/lib/preload-assets";

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

  // When the paywall opens, start warming the Health Info diet-tip
  // thumbnails in the background so they're cached by the time the
  // user finishes paying and lands on /health-info.
  useEffect(() => {
    if (open) preloadStage4DietTipThumbnails();
  }, [open]);

  // Ask the server to verify entitlement with RevenueCat and update
  // is_premium accordingly. Returns true only when the server's verified
  // result is premium. Never trust the client's own opinion here.
  // force:true bypasses the server's 30s cache because this is the
  // user-initiated post-purchase / post-restore path.
  const refreshPremiumOnServer = async (): Promise<boolean> => {
    try {
      const resp = await fetch("/api/refresh-premium-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force: true }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      return Boolean(data?.verifiedPremium ?? data?.isPremium);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPrice(null);
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
    // Client never decides premium. After a successful purchase we ask the
    // server to refresh, and the server verifies entitlement with RevenueCat.
    if (result.success && isPremiumFromCustomerInfo(result.customerInfo || null)) {
      const verified = await refreshPremiumOnServer();
      if (verified) {
        hapticNotify("SUCCESS");
        onPurchaseSuccess();
      } else {
        hapticNotify("ERROR");
        setError(t("paywall.error_purchase"));
      }
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
    // Don't trust customerInfo from the device for unlock decisions; let the
    // server verify with RevenueCat. We only use the device result to skip
    // the round-trip when it clearly shows nothing was restored.
    if (result.success) {
      const verified = await refreshPremiumOnServer();
      if (verified) {
        hapticNotify("SUCCESS");
        onPurchaseSuccess();
      } else {
        hapticNotify("ERROR");
        setError(t("paywall.error_restore"));
      }
    } else {
      hapticNotify("ERROR");
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
          className="fixed inset-0 z-[100] text-popover-foreground overflow-y-auto"
          style={{ backgroundColor: "#fdfbee" }}
          data-testid="paywall-modal"
        >
          <div className="min-h-full w-full flex flex-col items-center px-6 pb-10 max-w-md mx-auto">
            <img
              src={heroImg}
              alt=""
              data-testid="paywall-hero-image"
              aria-hidden="true"
              className="w-[140%] max-w-none object-cover ml-[-20%] pointer-events-none select-none"
              style={{
                aspectRatio: "16 / 9",
                opacity: 0.8,
                WebkitMaskImage:
                  "linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)",
              }}
            />

            <div
              className="w-full flex flex-col items-center mt-[-120px] relative z-10 px-6"
              style={{
                background: "#fdfbee",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0px, transparent 40px, #000 110px)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0px, transparent 40px, #000 110px)",
                marginLeft: "-1.5rem",
                marginRight: "-1.5rem",
                width: "calc(100% + 3rem)",
              }}
            >
            <div className="flex items-center justify-center gap-3 w-full pt-[95px]">
              <img
                src={laurelImg}
                alt=""
                aria-hidden="true"
                className="h-12 w-auto select-none pointer-events-none"
                draggable={false}
              />
              <h1
                className="text-2xl font-bold text-center leading-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
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
              className="text-sm text-foreground/90 text-center mt-[18px]"
              data-testid="text-paywall-headline"
            >
              {headline}
            </p>

            <div className="w-full flex flex-col gap-[7px] text-left text-base mt-[26px]">
              {["feature_plans", "feature_snap", "feature_roadmap", "feature_insights"].map((key) => (
                <div key={key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="font-semibold">{t(`paywall.${key}`)}</span>
                </div>
              ))}
            </div>

            <p
              className="text-base font-medium text-foreground text-center mt-[38px]"
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
              <div className="w-full flex flex-col gap-2 mt-6">
                <Button
                  className="w-full h-12 text-xl gap-2 bg-orange-500 hover:bg-orange-600 text-white"
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
                    className="text-xs text-muted-foreground underline"
                    data-testid="button-paywall-maybe-later"
                  >
                    {t("paywall.maybe_later")}
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col gap-2 mt-6">
                <div className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground text-center" data-testid="text-paywall-native-hint">
                    {t("paywall.open_in_app")}
                  </p>
                </div>
                {!lockApp && (
                  <button
                    onClick={handleMaybeLater}
                    className="text-xs text-muted-foreground underline"
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
              <Trans
                i18nKey="paywall.legal_disclosure"
                components={{
                  terms: (
                    <a
                      href={TERMS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium hover:text-primary/80"
                      data-testid="link-paywall-terms"
                    />
                  ),
                  privacy: (
                    <a
                      href={PRIVACY_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium hover:text-primary/80"
                      data-testid="link-paywall-privacy"
                    />
                  ),
                }}
              />
            </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
