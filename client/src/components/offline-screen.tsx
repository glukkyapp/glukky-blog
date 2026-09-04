import { useTranslation } from "react-i18next";
import cubeLogoDataUrl from "@assets/cube.png?inline";

const CUBE_LOGO_URL = cubeLogoDataUrl;

export default function OfflineScreen() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="offline-screen"
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--brand-cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#173F46",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        zIndex: 2147483000,
      }}
    >
      <img
        src={CUBE_LOGO_URL}
        alt="Glukky"
        data-testid="img-offline-cube"
        style={{
          width: "20vw",
          maxWidth: 120,
          minWidth: 64,
          height: "auto",
          marginBottom: "2rem",
        }}
      />
      <h1
        data-testid="text-offline-title"
        style={{
          fontSize: "clamp(1.125rem, 4.5vw, 1.375rem)",
          fontWeight: 600,
          lineHeight: 1.3,
          margin: 0,
          marginBottom: "0.75rem",
          textAlign: "center",
          color: "#173F46",
        }}
      >
        {t("offline_title")}
      </h1>
      <p
        data-testid="text-offline-body"
        style={{
          fontSize: "clamp(0.875rem, 3.5vw, 1rem)",
          lineHeight: 1.5,
          margin: 0,
          marginBottom: "2rem",
          textAlign: "center",
          maxWidth: 320,
          color: "#173F46",
        }}
      >
        {t("offline_body")}
      </p>
      <button
        type="button"
        data-testid="button-offline-reload"
        onClick={() => window.location.reload()}
        style={{
          backgroundColor: "#0D7E8F",
          color: "#F3EAE5",
          border: "none",
          borderRadius: 999,
          padding: "0.875rem 2.25rem",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: "pointer",
          minWidth: 160,
          fontFamily: "inherit",
        }}
      >
        {t("offline_button")}
      </button>
    </div>
  );
}
