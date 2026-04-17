interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes glukky-badge-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes glukky-shadow-pulse {
          0%, 100% { transform: scaleX(1); opacity: 0.35; }
          50% { transform: scaleX(0.78); opacity: 0.18; }
        }
        @keyframes glukky-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-10px); opacity: 1; }
        }
        @keyframes glukky-overlay-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .glukky-loading-overlay {
          animation: glukky-overlay-fade 0.18s ease-out forwards;
        }
        .glukky-loading-badge {
          animation: glukky-badge-breathe 2.4s ease-in-out infinite;
        }
        .glukky-loading-shadow {
          animation: glukky-shadow-pulse 2.4s ease-in-out infinite;
        }
        .glukky-loading-dot {
          animation: glukky-dot-bounce 1.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .glukky-loading-overlay,
          .glukky-loading-badge,
          .glukky-loading-shadow,
          .glukky-loading-dot {
            animation: none !important;
          }
        }
      `}</style>
      <div
        data-testid="loading-screen"
        className="glukky-loading-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            className="glukky-loading-badge"
            data-testid="loading-badge"
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              backgroundColor: "#F5EFE6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <svg
              width="52"
              height="58"
              viewBox="0 0 52 58"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M26 2 L48 10 V28 C48 42 38 52 26 56 C14 52 4 42 4 28 V10 Z"
                fill="#127843"
                stroke="#0e5f35"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M18 30 C18 24 22 20 26 20 C30 20 34 22 34 26 C34 30 30 31 26 31 C22 31 18 33 18 37 C18 41 22 43 26 43 C30 43 34 39 34 35"
                stroke="#F5EFE6"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          <div
            className="glukky-loading-shadow"
            style={{
              width: "70px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.35)",
              filter: "blur(3px)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "4px",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glukky-loading-dot"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#A8C8BC",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
