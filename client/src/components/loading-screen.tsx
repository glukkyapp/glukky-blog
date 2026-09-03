import { useEffect, useState } from "react";
import i18n from "@/i18n";

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  const [lang, setLang] = useState(() => i18n.language || "en");

  useEffect(() => {
    const handleLanguageChanged = (nextLang: string) => setLang(nextLang);
    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  if (!visible) return null;

  const isChinese = lang === "zh-Hant" || lang === "yue" || lang.startsWith("zh");

  return (
    <>
      <style>{`
        @keyframes cube-breathe {
          0%   { transform: scaleX(1.00) scaleY(1.00) translateY(0px); }
          30%  { transform: scaleX(1.04) scaleY(0.94) translateY(4px); }
          60%  { transform: scaleX(0.98) scaleY(1.02) translateY(-2px); }
          100% { transform: scaleX(1.00) scaleY(1.00) translateY(0px); }
        }
        @keyframes cube-shadow-pulse {
          0%   { transform: scaleX(1.00); opacity: 0.55; }
          30%  { transform: scaleX(1.20); opacity: 0.70; }
          60%  { transform: scaleX(0.90); opacity: 0.45; }
          100% { transform: scaleX(1.00); opacity: 0.55; }
        }
        @keyframes cube-dot-bounce {
          0%, 100% { transform: translateY(0);    opacity: 0.45; }
          40%      { transform: translateY(-5px); opacity: 1.00; }
        }
        @keyframes cube-overlay-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .cube-loading-overlay {
          animation: cube-overlay-fade 0.18s ease-out forwards;
        }
        .cube-loader-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }
        .cube-circle-holder {
          width: 120px;
          height: 120px;
          background: #F5EFE6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: cube-breathe 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          will-change: transform;
        }
        .cube-shadow {
          width: 80px;
          height: 12px;
          background: rgba(0,0,0,0.25);
          border-radius: 50%;
          animation: cube-shadow-pulse 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          will-change: transform, opacity;
          margin-top: -18px;
        }
        .cube-dots-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .cube-dot {
          width: 7px;
          height: 7px;
          background: #A8C8BC;
          border-radius: 50%;
          animation: cube-dot-bounce 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          will-change: transform, opacity;
        }
        .cube-dot:nth-child(2) { animation-delay: 0.18s; }
        .cube-dot:nth-child(3) { animation-delay: 0.36s; }
        @media (prefers-reduced-motion: reduce) {
          .cube-loading-overlay,
          .cube-circle-holder,
          .cube-shadow,
          .cube-dot {
            animation: none !important;
          }
        }
      `}</style>
      <div
        data-testid="loading-screen"
        className="cube-loading-overlay"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100dvh",
          boxSizing: "border-box",
          zIndex: 9998,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "env(safe-area-inset-top)",
          paddingRight: "env(safe-area-inset-right)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        <div className="cube-loader-wrap">
          <div className="cube-circle-holder">
            <svg
              width="66"
              height="66"
              viewBox="0 0 66 66"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="3D cube icon"
              role="img"
            >
              <path
                d="M33 14.2 C38.6 14.9, 44 16.5, 49.2 19.0
                   C49.8 19.3, 49.9 19.9, 49.3 20.3
                   L33.6 28.1
                   C33.2 28.35, 32.8 28.35, 32.4 28.1
                   L16.7 20.3
                   C16.1 19.9, 16.2 19.3, 16.8 19.0
                   C22 16.5, 27.4 14.9, 33 14.2 Z"
                fill="#A8C8BC"
              />
              <path
                d="M16.7 20.3
                   C16.2 20.0, 15.9 20.3, 15.9 20.9
                   L15.9 43.1
                   C15.9 43.6, 16.2 44.0, 16.7 44.3
                   L32.4 52.2
                   C32.8 52.4, 33 52.2, 33 51.8
                   L33 28.5
                   C33 28.35, 32.8 28.2, 32.4 28.0
                   L16.7 20.3 Z"
                fill="#9BBFB1"
              />
              <path
                d="M49.3 20.3
                   C49.8 20.0, 50.1 20.3, 50.1 20.9
                   L50.1 43.1
                   C50.1 43.6, 49.8 44.0, 49.3 44.3
                   L33.6 52.2
                   C33.2 52.4, 33 52.2, 33 51.8
                   L33 28.5
                   C33 28.35, 33.2 28.2, 33.6 28.0
                   L49.3 20.3 Z"
                fill="#88B4A5"
              />
            </svg>
          </div>
          <div className="cube-shadow" />
          <div className="cube-dots-row">
            <span className="cube-dot" />
            <span className="cube-dot" />
            <span className="cube-dot" />
          </div>
          <p
            data-testid="loading-screen-label"
            style={{
              fontFamily: isChinese
                ? '"LXGW WenKai TC", "PingFang TC", "Hiragino Sans GB", sans-serif'
                : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: "1.25rem",
              color: "#FFFFFF",
              margin: 0,
              letterSpacing: "0.02em",
              lineHeight: 1.3,
              textAlign: "center",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {isChinese ? "載入中" : "Loading"}
            <span aria-hidden="true">.</span>
            <span aria-hidden="true">.</span>
            <span aria-hidden="true">.</span>
          </p>
        </div>
      </div>
    </>
  );
}
