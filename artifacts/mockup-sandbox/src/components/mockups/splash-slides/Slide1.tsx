export function Slide1() {
  const BG = "#fdfbee";
  const ACCENT = "#127843";
  const HEADLINE = "#214B36";
  const MUTED = "#6b7280";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: BG, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div
        className="relative w-full h-screen overflow-hidden flex flex-col"
        style={{ background: BG }}
        data-testid="splash-slide-1"
      >
        {/* Status bar */}
        <div
          className="absolute left-0 right-0 flex items-center justify-between"
          style={{
            top: 14,
            paddingLeft: 24,
            paddingRight: 24,
            zIndex: 4,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            pointerEvents: "none",
          }}
        >
          <span>9:41</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 16, height: 10, borderRadius: 2, background: "white", opacity: 0.95 }} />
            <span style={{ width: 14, height: 10, borderRadius: 2, background: "white", opacity: 0.85 }} />
            <span
              style={{
                width: 22,
                height: 11,
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.9)",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 1,
                  background: "white",
                  borderRadius: 1,
                }}
              />
            </span>
          </span>
        </div>

        {/* Notch / dynamic island */}
        <div
          className="absolute"
          style={{
            top: 11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 112,
            height: 26,
            borderRadius: 999,
            background: "#080808",
            zIndex: 5,
          }}
        />

        {/* Hero image */}
        <div
          className="relative"
          style={{
            height: "46%",
            borderBottomLeftRadius: 34,
            borderBottomRightRadius: 34,
            overflow: "hidden",
          }}
        >
          <img
            src="/__mockup/images/slide1_walk.png"
            alt="A short walk after dinner"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {/* Content */}
        <div
          className="flex-1 flex flex-col justify-between"
          style={{ padding: "28px 30px 24px" }}
        >
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: HEADLINE,
                lineHeight: 1.25,
                whiteSpace: "pre-line",
              }}
              data-testid="text-slide-headline"
            >
              {"Your blood sugar,\nin your hands"}
            </h2>
            <p
              style={{
                margin: "16px auto 0",
                maxWidth: "26ch",
                fontSize: 14,
                lineHeight: 1.5,
                color: MUTED,
              }}
              data-testid="text-slide-body"
            >
              A short walk after dinner is one of the most effective ways to keep blood sugar in check.
            </p>
          </div>

          {/* Footer: Skip | Dots | Next */}
          <div
            className="flex items-center justify-between"
            style={{ paddingTop: 20 }}
          >
            <button
              type="button"
              data-testid="button-skip"
              style={{
                border: 0,
                background: "transparent",
                color: HEADLINE,
                fontSize: 14,
                padding: 0,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Skip
            </button>

            <div className="flex items-center" style={{ gap: 8 }} data-testid="dots-progress">
              <span
                style={{
                  width: 26,
                  height: 8,
                  borderRadius: 999,
                  background: ACCENT,
                  transition: "width 0.25s ease, background 0.25s ease",
                }}
              />
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#e5e7eb" }} />
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#e5e7eb" }} />
            </div>

            <button
              type="button"
              data-testid="button-next"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 0,
                background: ACCENT,
                color: "white",
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 14px rgba(18,120,67,0.35)",
              }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Home indicator */}
        <div
          className="absolute"
          style={{
            left: "50%",
            bottom: 10,
            transform: "translateX(-50%)",
            width: 120,
            height: 5,
            borderRadius: 999,
            background: "#111",
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}
