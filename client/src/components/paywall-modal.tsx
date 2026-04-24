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
  ensureIdentified,
  isIdentityReadyFor,
  subscribeIdentity,
  getIdentityState,
  aliasAnonymousIfNeeded,
  generateTraceId,
  postPurchaseTrace,
  fetchRcStateDiag,
  getLastOfferingSnapshot,
  captureAnonymousIdSequence,
  summarizeCaptureSequence,
  probeBridgeMethods,
  getInstallId,
  type AnonCaptureResult,
  type BridgeProbeResult,
  type CustomerInfo,
} from "@/lib/natively-purchases";
import laurelImg from "@assets/generated_images/laurel-wreath-gold.png";
import heroImg from "@assets/2dd316a7-1d08-4d1c-9af7-810af53516b8_1776833621839.png";
import { preloadStage4DietTipThumbnails } from "@/lib/preload-assets";
import { beginPurchaseFlight, endPurchaseFlight } from "@/lib/purchase-in-flight";

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
  const [identityReady, setIdentityReady] = useState<boolean>(() => isIdentityReadyFor(userId));
  const [identityError, setIdentityError] = useState<string | null>(() => getIdentityState().lastResult?.error ?? null);

  const isNative = isNativelyAvailable();
  const bridgeMissingLogIn = isNative && identityError === "no_login_method";
  // When the wrapper does NOT expose `Set Customer ID` (no logIn), the
  // identity gate would block Subscribe forever. In that build we rely
  // on the post-purchase server-side alias path instead, so the gate is
  // bypassed. When logIn IS available we keep gating on it (preferred
  // path: purchases land on the right RC subscriber from the start).
  const useIdentityGate = isNative && !bridgeMissingLogIn;
  const subscribeBlockedByIdentity = useIdentityGate && !identityReady;

  // Keep an up-to-date view of "is RC identity established for the
  // current Replit user?" so we can gate the subscribe button on it
  // when the bridge supports logIn. Without logIn we still subscribe
  // to identity changes so the diagnostic state (identityError) stays
  // fresh for the dev panel.
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
      // logIn now. On builds where logIn is missing this just records
      // the `no_login_method` error and the alias path takes over.
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

  // Notify the build-staleness checker so it re-runs whenever the
  // paywall opens — that's a high-stakes screen where being on a
  // stale shell is most disruptive.
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent("paywall-opened"));
    }
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

  // Build a one-line cause string from the server-side diagnostic so
  // the user can see, on the very paywall toast, *why* the unlock did
  // not happen (probe source, alias source, webhook configured?,
  // suspected project mismatch). No PII — no Replit user id, no email,
  // no anonymous RC id. Truncated to a single short line.
  const buildCauseString = async (
    aliasSource: string | null,
  ): Promise<string> => {
    const diag = await fetchRcStateDiag();
    if (!diag) return "(diag unavailable)";
    const parts: string[] = [];
    parts.push(`probe: ${diag.subscriberProbe?.source ?? "?"}`);
    if (aliasSource) parts.push(`alias: ${aliasSource}`);
    parts.push(`webhook: ${diag.webhookConfigured ? "ok" : "503"}`);
    if (diag.projectMismatchSuspected) parts.push("mismatch: yes");
    return `(${parts.join(", ")})`;
  };

  // Poll the server's verifier a few times to cover the typical
  // 2–5s Apple → StoreKit → RevenueCat propagation gap in sandbox.
  // Total budget ~8s. Stops early on a verified=true. Keeps polling
  // through transient failures (5xx/429/network) so a one-off blip
  // doesn't drop us into the error path.
  // When traceId is supplied, posts one purchase-trace event per
  // attempt so the deployment log shows the full retry sequence.
  const verifyWithRetry = async (
    traceId?: string,
    traceStartedAt?: number,
    installIdForTrace?: string,
  ): Promise<{ verified: boolean; verifySource: string | null }> => {
    const ATTEMPTS = 6;
    const GAP_MS = 1300;
    for (let i = 0; i < ATTEMPTS; i++) {
      const { verified, transient } = await refreshPremiumOnServer();
      if (traceId && traceStartedAt != null) {
        // Route through the same wrapper used elsewhere so installId
        // is attached to the verify event too (Task #486 step 8).
        postPurchaseTrace(traceId, "verify", Date.now() - traceStartedAt, {
          installId: installIdForTrace ?? null,
          attempt: i + 1,
          verifySource: lastVerifySourceRef.current ?? null,
          verifyHasPremium: verified,
          verifyTransient: transient,
        });
      }
      if (verified) return { verified: true, verifySource: lastVerifySourceRef.current };
      // Stop early only when the server gave an authoritative "no" AND
      // we've already given Apple → RC at least one propagation window.
      if (!transient && i >= 2) return { verified: false, verifySource: lastVerifySourceRef.current };
      if (i < ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    }
    return { verified: false, verifySource: lastVerifySourceRef.current };
  };

  // Plain-language failure messages. Never leaks the raw bridge error
  // string back to the user — the raw code stays in the trace for
  // server-side debugging only.
  const restoreFailureMessage = (_code: string | null): string => {
    return t("paywall.error_restore");
  };
  const purchaseFailureMessage = (_code: string | null): string => {
    return t("paywall.error_purchase");
  };

  // Verdict-badge classification (Task #486). One short, machine-grep-able
  // tag per purchase / restore so the deployment log can be filtered to
  // the exact failure mode without parsing free-form messages. Order
  // matters — earlier branches win.
  type VerdictBadge =
    | "OK"
    | "AUTH_NOT_READY"
    | "BRIDGE_MISSING_PURCHASE"
    | "RC_ID_NEVER_OBTAINED"
    | "MAPPING_POST_FAILED"
    | "VERIFY_AFTER_MAPPING_FAILED"
    | "OTHER";

  const classifyVerdict = (input: {
    isNative: boolean;
    identityBlocked: boolean;
    bridgePurchasePackageMissing: boolean;
    purchaseError: string | null;
    capturedAnonId: string | null;
    aliasAttempted: boolean;
    aliasOk: boolean;
    verified: boolean;
    cancelled: boolean;
  }): VerdictBadge => {
    if (input.verified) return "OK";
    if (input.cancelled) return "OTHER";
    if (input.identityBlocked) return "AUTH_NOT_READY";
    if (!input.isNative || input.bridgePurchasePackageMissing) return "BRIDGE_MISSING_PURCHASE";
    if (
      input.purchaseError &&
      input.purchaseError !== "pending_verification" &&
      input.purchaseError !== "cancelled"
    ) {
      return "BRIDGE_MISSING_PURCHASE";
    }
    if (!input.capturedAnonId) return "RC_ID_NEVER_OBTAINED";
    if (input.aliasAttempted && !input.aliasOk) return "MAPPING_POST_FAILED";
    if (input.aliasOk && !input.verified) return "VERIFY_AFTER_MAPPING_FAILED";
    return "OTHER";
  };

  // Wrap postPurchaseTrace so every event in this paywall session is
  // stamped with the install id. The server's whitelist filters it
  // out if the field isn't expected, so this is safe to always send.
  const traceWith = (
    traceId: string,
    traceStart: number,
    installId: string,
    phase: string,
    data: Record<string, unknown>,
    extras?: { clientOfferingIdentifiers?: string[]; clientPackageIdentifiers?: string[] },
  ) => {
    postPurchaseTrace(
      traceId,
      phase,
      Date.now() - traceStart,
      { installId, ...data },
      extras,
    );
  };

  const handlePurchase = async () => {
    if (!isNative) return;
    if (subscribeBlockedByIdentity) return; // button is also disabled, but belt-and-suspenders
    setPurchasing(true);
    setError(null);
    hapticTap("MEDIUM");
    beginPurchaseFlight();

    const traceId = generateTraceId();
    const traceStart = Date.now();
    const installId = getInstallId();
    const trace = (phase: string, data: Record<string, unknown>) =>
      traceWith(traceId, traceStart, installId, phase, data);
    const snapshot = getLastOfferingSnapshot();

    // Run the sharper bridge probe up front so the start event records
    // exactly which methods are present / null / missing on this build.
    // Probe is read-only and does NOT invoke purchasePackage / logIn /
    // restorePurchases — those are existence-only checks.
    const bridgeProbe: BridgeProbeResult = await probeBridgeMethods();

    // Start event includes the client-side offering identifiers so the
    // server-side project-mismatch detector has both halves of the
    // comparison. Sent on the FIRST trace post (server creates the
    // ring-buffer entry on first event).
    traceWith(
      traceId,
      traceStart,
      installId,
      "start",
      {
        isNative,
        identityReady,
        identityError: identityError ?? null,
        bridgeMissingLogIn,
        priceSource: snapshot?.source ?? null,
        // Send the FULL structured probe object (server name:
        // bridgeProbeBefore) so /api/diag/rc-state can render
        // per-method outcome + returned value, not just a 240-char
        // summary. Keep the legacy `bridgeProbe` summary too for
        // back-compat with traces being read by older tooling.
        bridgeProbe: bridgeProbe.summary,
        bridgeProbeBefore: bridgeProbe,
      },
      {
        clientOfferingIdentifiers: snapshot?.offeringIdentifiers ?? [],
        clientPackageIdentifiers: snapshot?.packageIdentifiers ?? [],
      },
    );

    let aliasSourceForToast: string | null = null;
    let aliasAttempted = false;
    let aliasOk = false;
    let aliasGrantedFromServer = false;
    let capture: AnonCaptureResult | null = null;
    let verified = false;

    try {
      const result = await purchasePackage("$rc_monthly");
      // Client never decides premium. After a successful purchase we ask the
      // server to refresh, and the server verifies entitlement with RevenueCat.
      const purchaseLooksDone =
        (result.success && isPremiumFromCustomerInfo(result.customerInfo || null)) ||
        result.error === "pending_verification";

      // Multi-route capture of the anonymous RC subscriber id. We MUST
      // get this id (or confirm it cannot be obtained) before alias /
      // verify, otherwise the self-healing path has nothing to attach.
      // Capture itself runs each accessor in PARALLEL bounded by a
      // single timeout, so it adds at most one timeout window — not
      // `count × timeout` — to the unlock path.
      capture = await captureAnonymousIdSequence(result.customerInfo);
      const capturedAnonId = capture.anonymousAppUserId;

      // The post-capture bridge probe used to be awaited here, which
      // could add seconds to the unlock path. It is now fired in the
      // background after the `final` event — see the `probe-after`
      // trace below — and the verdict-badge check uses the BEFORE
      // probe, since `purchasePackage` membership on the wrapper does
      // not change between two adjacent calls within one purchase.

      trace("purchase-result", {
        success: Boolean(result.success),
        anonAppUserId: capturedAnonId,
        isAnonymous: capturedAnonId
          ? capturedAnonId.startsWith("$RCAnonymousID:")
          : false,
        pendingVerification: result.error === "pending_verification",
        bridgeError: result.error ?? null,
        captureMethod: capture.capturedBy ?? null,
        captureMethodSucceeded: capturedAnonId !== null,
        captureSequence: summarizeCaptureSequence(capture),
      });

      // Server-side alias: when the bridge has no logIn (or even when it
      // does and the device record was anonymous before logIn), attach the
      // captured anonymous RC subscriber id to the signed-in Replit user
      // id. We feed the captured id (which may have come from a fresh
      // getCustomerInfo() rather than the original purchase callback) into
      // the existing helper via a synthesised CustomerInfo wrapper.
      const aliasInfo: CustomerInfo | null = capturedAnonId
        ? { originalAppUserId: capturedAnonId }
        : (result.customerInfo ?? null);
      const aliasResult = await aliasAnonymousIfNeeded(aliasInfo, userId);
      aliasSourceForToast = aliasResult.attempted ? aliasResult.source : null;
      aliasAttempted = aliasResult.attempted;
      aliasOk = aliasResult.aliased;
      trace("alias", {
        aliasSource: aliasResult.source,
        aliased: aliasResult.aliased,
        aliasHttpStatus: aliasResult.httpStatus ?? null,
      });

      let verifySource: string | null = null;
      if (purchaseLooksDone) {
        const v = await verifyWithRetry(traceId, traceStart, installId);
        verified = v.verified;
        verifySource = v.verifySource;
        // Mark "alias granted" only when the server's self-healing
        // verifier specifically attributed the unlock to the alias
        // path (source: "alias"). A direct `revenuecat` source means
        // RC's own merge worked — that's not the self-healing path.
        aliasGrantedFromServer = verified && verifySource === "alias";
        if (verified) {
          hapticNotify("SUCCESS");
        } else {
          hapticNotify("ERROR");
          const cause = await buildCauseString(aliasSourceForToast);
          setError(`${withVerifierSource(purchaseFailureMessage(result.error ?? null))} ${cause}`);
        }
      } else if (result.error !== "cancelled") {
        hapticNotify("ERROR");
        setError(purchaseFailureMessage(result.error ?? null));
      }

      const verdictBadge = classifyVerdict({
        isNative,
        identityBlocked: subscribeBlockedByIdentity,
        // `purchasePackage` membership on the wrapper does not change
        // mid-purchase, so the BEFORE probe is authoritative for the
        // verdict badge. This avoids waiting on a second probe round-
        // trip on the unlock path.
        bridgePurchasePackageMissing: bridgeProbe.methods.purchasePackage === "missing",
        purchaseError: result.error ?? null,
        capturedAnonId,
        aliasAttempted,
        aliasOk,
        verified,
        cancelled: result.error === "cancelled",
      });

      trace("final", {
        verdict: verified ? "granted" : "denied",
        reason: verified
          ? "verify_ok"
          : result.error === "cancelled"
            ? "cancelled"
            : !purchaseLooksDone
              ? `bridge_${result.error ?? "unknown"}`
              : "verify_failed",
        verdictBadge,
        aliasGranted: aliasGrantedFromServer,
        verifySource,
        bridgeProbe: bridgeProbe.summary,
        bridgeProbeBefore: bridgeProbe,
      });

      if (verified) onPurchaseSuccess();

      // Fire-and-forget post-purchase probe so we still record what
      // the wrapper looked like AFTER the charge — useful for diagnosing
      // wrappers that only initialise certain accessors after the first
      // purchase callback resolves — without blocking unlock latency.
      // Errors here are intentionally swallowed.
      void probeBridgeMethods()
        .then((bridgeProbeAfter) => {
          trace("probe-after", { bridgeProbeAfter });
        })
        .catch(() => {
          /* probe-after is best-effort, never gates unlock */
        });
    } finally {
      endPurchaseFlight();
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!isNative) return;
    setRestoring(true);
    setError(null);
    hapticTap("LIGHT");
    beginPurchaseFlight();

    const traceId = generateTraceId();
    const traceStart = Date.now();
    const installId = getInstallId();
    const trace = (phase: string, data: Record<string, unknown>) =>
      traceWith(traceId, traceStart, installId, phase, data);
    const snapshot = getLastOfferingSnapshot();
    const bridgeProbe: BridgeProbeResult = await probeBridgeMethods();

    traceWith(
      traceId,
      traceStart,
      installId,
      "start",
      {
        isNative,
        identityReady,
        identityError: identityError ?? null,
        bridgeMissingLogIn,
        priceSource: snapshot?.source ?? null,
        reason: "restore",
        bridgeProbe: bridgeProbe.summary,
        bridgeProbeBefore: bridgeProbe,
      },
      {
        clientOfferingIdentifiers: snapshot?.offeringIdentifiers ?? [],
        clientPackageIdentifiers: snapshot?.packageIdentifiers ?? [],
      },
    );

    let aliasSourceForToast: string | null = null;
    let aliasAttempted = false;
    let aliasOk = false;
    let capture: AnonCaptureResult | null = null;
    let verified = false;

    try {
      const result = await restorePurchases();

      // Even when the bridge says "restore_not_supported" or
      // "restore_timeout" we still try a forced server-side verify
      // because a previous successful purchase from this install may
      // already have been aliased and just needs the verifier to
      // re-read it.
      capture = await captureAnonymousIdSequence(result.customerInfo);
      const capturedAnonId = capture.anonymousAppUserId;

      // Post-capture probe is fire-and-forget after `final` (see
      // below) so it does not block the unlock path. The verdict
      // badge uses the BEFORE probe — `purchasePackage` membership
      // does not change between two adjacent calls.

      trace("purchase-result", {
        success: Boolean(result.success),
        anonAppUserId: capturedAnonId,
        isAnonymous: capturedAnonId
          ? capturedAnonId.startsWith("$RCAnonymousID:")
          : false,
        bridgeError: result.error ?? null,
        captureMethod: capture.capturedBy ?? null,
        captureMethodSucceeded: capturedAnonId !== null,
        captureSequence: summarizeCaptureSequence(capture),
        restoreMissingMethod: result.error === "restore_not_supported",
      });

      const aliasInfo: CustomerInfo | null = capturedAnonId
        ? { originalAppUserId: capturedAnonId }
        : (result.customerInfo ?? null);

      if (result.success || capturedAnonId) {
        // Same server-side alias path as purchase: any anonymous record
        // surfaced by Restore should be attached to the signed-in user.
        const aliasResult = await aliasAnonymousIfNeeded(aliasInfo, userId);
        aliasSourceForToast = aliasResult.attempted ? aliasResult.source : null;
        aliasAttempted = aliasResult.attempted;
        aliasOk = aliasResult.aliased;
        trace("alias", {
          aliasSource: aliasResult.source,
          aliased: aliasResult.aliased,
          aliasHttpStatus: aliasResult.httpStatus ?? null,
        });
      }

      // Always run the verify retry loop on Restore, even when the
      // bridge call itself failed — the server's self-healing verifier
      // can still grant via a previously persisted alias.
      let verifySource: string | null = null;
      const v = await verifyWithRetry(traceId, traceStart, installId);
      verified = v.verified;
      verifySource = v.verifySource;
      const aliasGrantedFromServer = verified && verifySource === "alias";
      if (verified) {
        hapticNotify("SUCCESS");
      } else if (result.success) {
        hapticNotify("ERROR");
        const cause = await buildCauseString(aliasSourceForToast);
        setError(`${withVerifierSource(restoreFailureMessage(result.error ?? null))} ${cause}`);
      } else {
        hapticNotify("ERROR");
        // Plain-language only — never leak the raw bridge error string.
        // The raw error is already captured in the trace above for
        // server-side debugging.
        setError(restoreFailureMessage(result.error ?? null));
      }

      const verdictBadge = classifyVerdict({
        isNative,
        identityBlocked: false, // Restore is allowed even with logIn missing
        // BEFORE probe is sufficient — purchasePackage membership on
        // the wrapper does not change between two adjacent calls.
        bridgePurchasePackageMissing: bridgeProbe.methods.purchasePackage === "missing",
        purchaseError: result.error ?? null,
        capturedAnonId,
        aliasAttempted,
        aliasOk,
        verified,
        cancelled: false,
      });

      trace("final", {
        verdict: verified ? "granted" : "denied",
        reason: verified
          ? "verify_ok"
          : result.success
            ? "verify_failed"
            : `bridge_${result.error ?? "unknown"}`,
        verdictBadge,
        aliasGranted: aliasGrantedFromServer,
        verifySource,
        bridgeProbe: bridgeProbe.summary,
        bridgeProbeBefore: bridgeProbe,
      });

      if (verified) onPurchaseSuccess();

      // Fire-and-forget post-restore probe (same pattern as purchase
      // flow). Never gates unlock latency.
      void probeBridgeMethods()
        .then((bridgeProbeAfter) => {
          trace("probe-after", { bridgeProbeAfter });
        })
        .catch(() => {
          /* probe-after is best-effort */
        });
    } finally {
      endPurchaseFlight();
      setRestoring(false);
    }
  };

  const handleMaybeLater = () => {
    if (lockApp) return;
    hapticTap("SOFT");
    onClose();
  };

  const headline = t("paywall.headline");

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

            <div className="w-full flex flex-col gap-[2px] text-left text-base leading-tight mt-[26px]">
              {["feature_plans", "feature_snap", "feature_roadmap", "feature_insights"].map((key) => (
                <div key={key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" />
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
                <Button
                  className="w-full h-12 text-xl gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handlePurchase}
                  disabled={purchasing || restoring || subscribeBlockedByIdentity}
                  data-testid="button-paywall-subscribe"
                >
                  <Sparkles className="w-5 h-5" />
                  {purchasing || subscribeBlockedByIdentity
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
