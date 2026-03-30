import glukkyLogo from "@assets/Untitled_Artwork_15_1773938067836.png";

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
        backgroundColor: "hsl(170, 22%, 10%)",
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
          width: 200,
          objectFit: "contain",
        }}
      />
    </div>
  );
}
