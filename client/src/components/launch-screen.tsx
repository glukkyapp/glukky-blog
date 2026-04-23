import { useEffect } from "react";
import glukkyLogo from "@assets/Screenshot_2026-03-30_at_23.48.51_1774964683492.png";
import { preloadStage2Onboarding } from "@/lib/preload-assets";

interface LaunchScreenProps {
  visible: boolean;
}

export function LaunchScreen({ visible }: LaunchScreenProps) {
  useEffect(() => {
    preloadStage2Onboarding();
  }, []);

  return (
    <div
      data-testid="launch-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#244b73",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "all" : "none",
      }}
    >
      <img
        src={glukkyLogo}
        alt="Glukky"
        style={{
          width: "25vw",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
