import { useEffect, useState, useRef } from "react";
import i18n from "@/i18n";
import cubeGif from "@assets/1775145092706x746350477677953000_cyucyu_httpss.mj.rund0RUe8hVs_1776915386428.gif";

const TIPS_EN = [
  "Blood sugar swings can affect your mood and energy throughout the day.",
  "Keeping glucose stable helps your skin stay firm and clear.",
  "Your heart, eyes, kidneys, and brain — blood sugar affects them all.",
  "It's not just sweets — almost all foods raise your blood glucose after eating. What matters is how much and how fast.",
];

const TIPS_ZH = [
  "血糖波動會影響你一天的情緒和精力。",
  "保持血糖穩定，有助皮膚緊緻透亮。",
  "心臟、眼睛、腎臟、大腦——血糖能影響你全身。",
  "不只是甜食——幾乎所有食物都會令血糖上升。重要的是多少與速度。",
];

const TIP_INTERVAL_MS = 3500;
const FADE_MS = 400;
const MIN_DURATION_MS = TIP_INTERVAL_MS * 4;

const FONT_LINK_ID = "lxgw-wenkai-tc-subset";

function ensureChineseFontLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const subsetText = TIPS_ZH.join("");
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
  const tips = isZh ? TIPS_ZH : TIPS_EN;

  const [tipIndex, setTipIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  // Inject the LXGW WenKai TC subset font only when needed.
  useEffect(() => {
    if (isZh) ensureChineseFontLoaded();
  }, [isZh]);

  // Tip rotation: 3.5s interval, 0.4s fade, matches reference HTML.
  useEffect(() => {
    const interval = setInterval(() => {
      setHidden(true);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % tips.length);
        setHidden(false);
      }, FADE_MS);
    }, TIP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tips.length]);

  // Minimum-duration gate.
  useEffect(() => {
    const remaining = Math.max(
      0,
      MIN_DURATION_MS - (Date.now() - startedAtRef.current),
    );
    const t = setTimeout(() => setMinElapsed(true), remaining);
    return () => clearTimeout(t);
  }, []);

  // Dismiss when all three gates are true.
  useEffect(() => {
    if (authReady && preloadReady && minElapsed) {
      onDismiss();
    }
  }, [authReady, preloadReady, minElapsed, onDismiss]);

  return (
    <div
      data-testid="cube-loading-screen"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#F3EAE5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#0D2B1E",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        zIndex: 9999,
      }}
    >
      <img
        src={cubeGif}
        alt="Glukky"
        style={{
          width: "20vw",
          maxWidth: 120,
          minWidth: 64,
          height: "auto",
          marginBottom: "2.5rem",
        }}
        data-testid="cube-loading-gif"
      />
      <div style={{ maxWidth: 300, width: "100%", textAlign: "center" }}>
        <p
          data-testid="cube-loading-tip"
          style={{
            fontSize: "clamp(0.656rem, 2.625vw, 0.75rem)",
            lineHeight: 1.7,
            color: "#0D2B1E",
            fontWeight: 400,
            opacity: hidden ? 0 : 1,
            transform: hidden ? "translateY(6px)" : "translateY(0)",
            transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
            userSelect: "none",
            WebkitUserSelect: "none",
            fontFamily: isZh
              ? '"LXGW WenKai TC", serif'
              : undefined,
          }}
        >
          {tips[tipIndex]}
        </p>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: "0.875rem",
            justifyContent: "center",
          }}
          data-testid="cube-loading-dots"
        >
          {tips.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  i === tipIndex ? "#0D2B1E" : "rgba(13, 43, 30, 0.2)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
