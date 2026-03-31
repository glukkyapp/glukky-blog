import glukkyLogo from "@assets/Screenshot_2026-03-30_at_23.48.51_1774964683492.png";

interface SplashScreenProps {
  visible: boolean;
}

export function SplashScreen({ visible }: SplashScreenProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#244b73",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
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
