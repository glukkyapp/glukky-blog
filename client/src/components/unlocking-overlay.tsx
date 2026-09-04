import { useTranslation } from "react-i18next";
import "./unlocking-overlay.css";

// Branded overlay shown immediately after the RC paywall returns purchased/restored, while the server verify completes.
export default function UnlockingOverlay() {
  const { t } = useTranslation();
  return (
    <>
      <div
        data-testid="unlocking-overlay"
        className="unlock-cube-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          backgroundColor: "rgba(254, 242, 224, 0.96)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="unlock-cube-loader-wrap">
          <div className="unlock-cube-circle-holder">
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
                fill="#73B9C2"
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
                fill="#58AAB5"
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
                fill="#3D96A3"
              />
            </svg>
          </div>
          <div className="unlock-cube-shadow" />
          <div className="unlock-cube-dots-row">
            <span className="unlock-cube-dot" />
            <span className="unlock-cube-dot" />
            <span className="unlock-cube-dot" />
          </div>
          <p className="unlock-caption" data-testid="text-unlocking-caption">
            {t("paywall.unlocking_caption")}
          </p>
        </div>
      </div>
    </>
  );
}
