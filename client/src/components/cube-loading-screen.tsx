import { useEffect, useState, useRef } from "react";
import i18n from "@/i18n";
import loadingAnimation from "@assets/loading_animation_1788501069963.mp4";

// Preserve the existing minimum cold-launch duration after removing the tips.
const MIN_DURATION_MS = 14_000;

const FONT_LINK_ID = "lxgw-wenkai-tc-subset";

function ensureChineseFontLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const subsetText = "載入中";
  const url =
    "https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&text=" +
    encodeURIComponent(subsetText) +
    "&display=swap";
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

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

  const [minElapsed, setMinElapsed] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  // Keep the Chinese font for the translated loading label.
  useEffect(() => {
    if (isZh) ensureChineseFontLoaded();
  }, [isZh]);

  // Minimum-duration gate.
  useEffect(() => {
    const remaining = Math.max(
      0,
      MIN_DURATION_MS - (Date.now() - startedAtRef.current),
    );
    const timer = setTimeout(() => setMinElapsed(true), remaining);
    return () => clearTimeout(timer);
  }, []);

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
          backgroundColor: "#FAF8EF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "calc(2rem + env(safe-area-inset-top))",
          paddingRight: "calc(2rem + env(safe-area-inset-right))",
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
          paddingLeft: "calc(2rem + env(safe-area-inset-left))",
          color: "#0D2B1E",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          zIndex: 9999,
        }}
      >
      <video
        src={loadingAnimation}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label="Glukky"
        style={{
          width: "18vw",
          maxWidth: 112,
          minWidth: 64,
          height: "auto",
          aspectRatio: "1 / 1",
          objectFit: "cover",
          backgroundColor: "#0D7D89",
          display: "block",
          marginBottom: "0.75rem",
        }}
        data-testid="cube-loading-video"
      />
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <p
          data-testid="cube-loading-label"
          style={{
            fontFamily: isZh ? '"LXGW WenKai TC", serif' : undefined,
            fontSize: "1.5rem",
            color: "rgba(13, 43, 30, 0.5)",
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
