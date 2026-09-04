import { useEffect, useState, useRef } from "react";
import i18n from "@/i18n";

// Preserve the existing minimum cold-launch duration after removing the tips.
const MIN_DURATION_MS = 14_000;
const LOADING_ANIMATION_URL = "/launch/har-gow-launch.mp4";

function isChineseLang(lang: string): boolean {
  return lang === "zh-Hant" || lang === "yue" || lang.startsWith("zh");
}

interface CubeLoadingScreenProps {
  onDismiss: () => void;
  authReady: boolean;
  preloadReady: boolean;
}

export default function CubeLoadingScreen({
  onDismiss,
  authReady,
  preloadReady,
}: CubeLoadingScreenProps) {
  const [lang] = useState(() => i18n.language || "en");
  const isZh = isChineseLang(lang);
  const [isChineseFontReady, setIsChineseFontReady] = useState(() =>
    typeof document !== "undefined" &&
    Boolean(document.fonts?.check('24px "Glukky Loading Chinese"', "載入中")),
  );

  const [minElapsed, setMinElapsed] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  // Minimum-duration gate.
  useEffect(() => {
    const remaining = Math.max(
      0,
      MIN_DURATION_MS - (Date.now() - startedAtRef.current),
    );
    const timer = setTimeout(() => setMinElapsed(true), remaining);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isZh || isChineseFontReady || !document.fonts) return;
    let active = true;
    void document.fonts
      .load('24px "Glukky Loading Chinese"', "載入中")
      .then(() => {
        if (active) setIsChineseFontReady(true);
      });
    return () => {
      active = false;
    };
  }, [isZh, isChineseFontReady]);

  // Dismiss when all three gates are true.
  useEffect(() => {
    if (authReady && preloadReady && minElapsed) {
      onDismiss();
    }
  }, [authReady, preloadReady, minElapsed, onDismiss]);

  return (
    <>
      <style>{`
        @keyframes ell-dot {
          0%, 100% { opacity: 0; }
          50%       { opacity: 1; }
        }
        .ell-dot { animation: ell-dot 1.2s ease-in-out infinite; }
        .ell-dot-1 { animation-delay: 0s; }
        .ell-dot-2 { animation-delay: 0.4s; }
        .ell-dot-3 { animation-delay: 0.8s; }
      `}</style>
      <div
        data-testid="cube-loading-screen"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100dvh",
          boxSizing: "border-box",
          backgroundColor: "#0D7E8F",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "calc(2rem + env(safe-area-inset-top))",
          paddingRight: "calc(2rem + env(safe-area-inset-right))",
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
          paddingLeft: "calc(2rem + env(safe-area-inset-left))",
          color: "#FEF2E0",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          zIndex: 9999,
        }}
      >
      <video
        src={LOADING_ANIMATION_URL}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label={isZh ? "載入中" : "Loading"}
        onLoadedMetadata={(event) => {
          const handoffTime = window.__launchVideoCurrentTime;
          if (typeof handoffTime === "number" && Number.isFinite(handoffTime)) {
            event.currentTarget.currentTime = handoffTime;
            delete window.__launchVideoCurrentTime;
          }
        }}
        style={{
          width: "18vw",
          maxWidth: 112,
          minWidth: 64,
          height: "auto",
          aspectRatio: "1 / 1",
          objectFit: "cover",
          clipPath: "circle(40% at 50% 50%)",
          backgroundColor: "#0D7E8F",
          display: "block",
          marginBottom: "0.75rem",
        }}
        data-testid="cube-loading-video"
      />
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <p
          data-testid="cube-loading-label"
          style={{
            fontFamily:
              isZh && isChineseFontReady
                ? '"Glukky Loading Chinese", serif'
                : undefined,
            fontSize: "1.5rem",
            color: "#FEF2E0",
            margin: 0,
            letterSpacing: "0.02em",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {isZh ? "載入中" : "Loading"}
          <span className="ell-dot ell-dot-1">.</span>
          <span className="ell-dot ell-dot-2">.</span>
          <span className="ell-dot ell-dot-3">.</span>
        </p>
      </div>
    </div>
    </>
  );
}
