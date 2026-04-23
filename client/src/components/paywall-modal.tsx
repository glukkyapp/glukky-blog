import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";
import {
  isNativelyAvailable,
  purchasePackage,
  restorePurchases,
  isPremiumFromCustomerInfo,
  getMonthlyPriceString,
  ensureIdentified,
  isIdentityReadyFor,
  subscribeIdentity,
  getIdentityState,
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
  const { user } = useAuth();
  const userId = user?.id;
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState<boolean>(() => isIdentityReadyFor(userId));
  const [identityError, setIdentityError] = useState<string | null>(() => getIdentityState().lastResult?.error ?? null);

  const isNative = isNativelyAvailable();
  const bridgeMissingLogIn = isNative && identityError === "no_login_method";

  // Keep an up-to-date view of "is RC identity established for the
  // current Replit user?" so we can gate the subscribe button on it
  // and never let a fast-tapping user record a purchase against the
  // anonymous app-user-id.
  useEffect(() => {
    const update = () => {
      setIdentityReady(isIdentityReadyFor(userId));
      setIdentityError(getIdentityState().lastResult?.error ?? null);
    };
    update();
    const unsubscribe = subscribeIdentity(update);
    if (open && userId) {
      // Defensive: if the boot-time effect somehow didn't fire (e.g. the
      // paywall is opened from an unauthenticated edge case), kick off
      // logIn now so the user isn't permanently blocked.
      ensureIdentified(userId);
    }
    return unsubscribe;
  }, [userId, open]);

  // When the paywall opens, start warming the Health Info diet-tip
  // thumbnails in the background so they're cached by the time the
  // user finishes paying and lands on /health-info.
  useEffect(() => {
    if (open) preloadStage4DietTipThumbnails();
  }, [open]);

  // Ask the server to verify entitlement with RevenueCat and update
  // is_premium accordingly. Returns the parsed result so callers can
  // distinguish a hard "not premium" from a transient verifier failure.
  // force:true bypasses the server's 30s cache because this is the
  // user-initiated post-purchase / post-restore path.
  // Tracks the verifier source (e.g. "not_found", "error_transient",
  // "revenuecat") from the most recent /refresh-premium-status response,
  // so we can attribute a "purchase failed" / "restore failed" message
  // to a named cause instead of an opaque toast.
  const lastVerifySourceRef = { current: null as string | null };

  const refreshPremiumOnServer = async (): Promise<{ verified: boolean; transient: boolean }> => {
    try {
      const resp = await fetch("/api/refresh-premium-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force: true }),
      });
      if (!resp.ok) {
        lastVerifySourceRef.current = `http_${resp.status}`;
        return { verified: false, transient: true };
      }
      const data = await resp.json();
      lastVerifySourceRef.current = (data?.verificationSource as string) ?? null;
      return {
        verified: Boolean(data?.verifiedPremium ?? data?.isPremium),
        transient: Boolean(data?.transient),
      };
    } catch (e: any) {
      lastVerifySourceRef.current = `network: ${e?.message ?? "unknown"}`;
      return { verified: false, transient: true };
    }
  };

  const withVerifierSource = (msg: string): string => {
    const src = lastVerifySourceRef.current;
    return src ? `${msg} (verifier: ${src})` : msg;
  };

  // Poll the server's verifier a few times to cover the typical
  // 2–5s Apple → StoreKit → RevenueCat propagation gap in sandbox.
  // Total budget ~8s. Stops early on a verified=true. Keeps polling
  // through transient failures (5xx/429/network) so a one-off blip
  // doesn't drop us into the error path.
  const verifyWithRetry = async (): Promise<boolean> => {
    const ATTEMPTS = 6;
    const GAP_MS = 1300;
    for (let i = 0; i < ATTEMPTS; i++) {
      const { verified, transient } = await refreshPremiumOnServer();
      if (verified) return true;
      // Stop early only when the server gave an authoritative "no" AND
      // we've already given Apple → RC at least one propagation window.
      if (!transient && i >= 2) return false;
      if (i < ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    }
    return false;
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
    if (!identityReady) return; // button is also disabled, but belt-and-suspenders
    setPurchasing(true);
    setError(null);
    hapticTap("MEDIUM");

    const result = await purchasePackage("$rc_monthly");
    // Client never decides premium. After a successful purchase we ask the
    // server to refresh, and the server verifies entitlement with RevenueCat.
    const purchaseLooksDone =
      (result.success && isPremiumFromCustomerInfo(result.customerInfo || null)) ||
      result.error === "pending_verification";

    if (purchaseLooksDone) {
      const verified = await verifyWithRetry();
      if (verified) {
        hapticNotify("SUCCESS");
        onPurchaseSuccess();
      } else {
        hapticNotify("ERROR");
        setError(withVerifierSource(t("paywall.error_purchase")));
      }
    } else if (result.error !== "cancelled") {
      hapticNotify("ERROR");
      const base = t("paywall.error_purchase");
      setError(result.error ? `${base} (bridge: ${result.error})` : base);
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
      const verified = await verifyWithRetry();
      if (verified) {
        hapticNotify("SUCCESS");
        onPurchaseSuccess();
      } else {
        hapticNotify("ERROR");
        setError(withVerifierSource(t("paywall.error_restore")));
      }
    } else {
      hapticNotify("ERROR");
      const base = t("paywall.error_restore");
      setError(result.error ? `${base} (bridge: ${result.error})` : base);
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

            <div className="w-full flex flex-col gap-[4px] text-left text-base mt-[26px]">
              {["feature_plans", "feature_snap", "feature_roadmap", "feature_insights"].map((key) => (
                <div key={key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="font-semibold">{t(`paywall.${key}`)}</span>
                </div>
              ))}
            </div>

            <p
              className="text-base font-medium text-foreground text-center mt-[23px]"
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
              <div className="w-full flex flex-col gap-2 mt-3">
                {bridgeMissingLogIn && (
                  <div
                    className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-950 p-3 text-xs text-red-700 dark:text-red-300 leading-relaxed"
                    data-testid="banner-paywall-no-login-method"
                  >
                    This build of the app cannot attach purchases to your
                    account, so subscribing is temporarily disabled. A new
                    app build will be released shortly — please try again
                    after updating from TestFlight / the App Store.
                  </div>
                )}
                <Button
                  className="w-full h-12 text-xl gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handlePurchase}
                  disabled={purchasing || restoring || !identityReady}
                  data-testid="button-paywall-subscribe"
                >
                  <Sparkles className="w-5 h-5" />
                  {purchasing || !identityReady
                    ? t("paywall.processing")
                    : t("paywall.subscribe_button")}
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
              <div className="w-full flex flex-col gap-2 mt-3">
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
