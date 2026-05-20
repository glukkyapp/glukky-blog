import { useEffect, useState, useRef } from "react";
import i18n from "@/i18n";
import cubeGif from "@assets/gif_new_v2_1777639983811.gif";

const TIPS_EN: React.ReactNode[] = [
  "Exercising every day, but your doctor still says your blood sugar isn't where it should be?",
  <>Starting this week, try a <strong style={{ fontWeight: 700 }}>post-dinner walk</strong>. Just 10 minutes — more effective than you'd think.</>,
  <>Thousands of people are already using <strong style={{ fontWeight: 700 }}>Food Snap</strong>. Let AI give you one better dinner choice every night.</>,
  "One month from now, meet a better you.",
];

const TIPS_ZH_PLAIN = [
  "每天運動，但醫生仍然說你血糖不達標？",
  "這星期開始，做一次飯後散步吧。只需十分鐘，比你想像中的更有效。",
  "數以千計的人在使用食物快拍。讓AI每晚給你一個更好的晚餐選擇。",
  "一個月後，迎接煥然一新的你。",
];

const TIPS_ZH: React.ReactNode[] = [
  "每天運動，但醫生仍然說你血糖不達標？",
  <>這星期開始，做一次<strong style={{ fontWeight: 700 }}>飯後散步</strong>吧。只需十分鐘，比你想像中的更有效。</>,
  <>數以千計的人在使用<strong style={{ fontWeight: 700 }}>食物快拍</strong>。讓AI每晚給你一個更好的晚餐選擇。</>,
  "一個月後，迎接煥然一新的你。",
];

const TIP_INTERVAL_MS = 3500;
const FADE_MS = 400;
const MIN_DURATION_MS = TIP_INTERVAL_MS * 4;

const FONT_LINK_ID = "lxgw-wenkai-tc-subset";
const PLAYFAIR_LINK_ID = "playfair-display-font";

function ensureChineseFontLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const subsetText = TIPS_ZH_PLAIN.join("");
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

function ensurePlayfairLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(PLAYFAIR_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = PLAYFAIR_LINK_ID;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap";
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

  // Inject fonts: LXGW for Chinese, Playfair Display for English.
  useEffect(() => {
    if (isZh) ensureChineseFontLoaded();
    else ensurePlayfairLoaded();
  }, [isZh]);

  // Tip rotation: 3.5s interval, 0.4s fade, matches reference HTML.
  useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setHidden(true);
      fadeTimeout = setTimeout(() => {
        setTipIndex((i) => (i + 1) % tips.length);
        setHidden(false);
      }, FADE_MS);
    }, TIP_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, [tips.length]);

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
          backgroundColor: "#FAF8EF",
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
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <p
          data-testid="cube-loading-tip"
          style={{
            fontSize: "clamp(1.3rem, 5.25vw, 1.5rem)",
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
              : '"Playfair Display", Georgia, serif',
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
        <p
          data-testid="cube-loading-label"
          style={{
            fontFamily: isZh ? '"LXGW WenKai TC", serif' : undefined,
            fontSize: "1.5rem",
            color: "rgba(13, 43, 30, 0.5)",
            margin: "8px 0 0 0",
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
