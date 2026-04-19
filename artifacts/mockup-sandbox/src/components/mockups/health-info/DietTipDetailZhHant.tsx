import { Camera, Calendar, Lightbulb, User } from "lucide-react";

export function DietTipDetailZhHant() {
  const bg = "hsl(23 36% 93%)";
  const primary = "#127843";
  const muted = "hsl(168 10% 45%)";
  const fg = "hsl(168 30% 12%)";

  const tips = [
    { src: "/__mockup/images/tip-juice.png",  bg: "linear-gradient(135deg, #bae6fd 0%, #67e8f9 100%)", label: "選擇無糖飲品 / 果汁加1:1清水稀釋" },
    { src: "/__mockup/images/tip-yogurt.png", bg: "linear-gradient(135deg, #fbcfe8 0%, #fda4af 100%)", label: "以無糖乳酪加漿果代替甜品" },
    { src: "/__mockup/images/tip-steam.png",  bg: "linear-gradient(135deg, #fed7aa 0%, #fcd34d 100%)", label: "先蒸後略煎" },
  ];
  const selectedIdx = 2;

  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        backgroundColor: bg,
        fontFamily: "'Karla', 'Inter', sans-serif",
        color: fg,
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 384, margin: "0 auto", padding: "24px 0 128px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px" }}>
          <img
            src="/__mockup/images/lightbulb-heading.png"
            alt=""
            style={{ width: 56, height: 56, flexShrink: 0 }}
          />
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.04em",
              margin: 0,
            }}
          >
            健康資訊
          </h1>
        </div>

        <p
          style={{
            fontSize: 14,
            color: muted,
            textAlign: "center",
            marginTop: 12,
            marginBottom: 24,
            padding: "0 20px",
            lineHeight: 1.6,
          }}
        >
          不記得飲食建議也不用擔心——你隨時可以回來重溫。
        </p>

        <section style={{ padding: "0 20px" }}>
          <h2
            style={{
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "0.04em",
              marginBottom: 16,
              margin: "0 0 16px",
            }}
          >
            飲食建議
          </h2>

          <div
            style={{
              display: "flex",
              gap: 18,
              overflowX: "auto",
              padding: "16px 4px 16px 4px",
              scrollbarWidth: "none",
            }}
          >
            {tips.map((tip, i) => {
              const selected = i === selectedIdx;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    width: 100,
                  }}
                >
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: tip.bg,
                      transform: selected ? "scale(1.05)" : "none",
                      boxShadow: selected
                        ? `0 0 0 2px white, 0 0 0 4px ${primary}`
                        : "none",
                      transition: "all 200ms",
                    }}
                  >
                    <img
                      src={tip.src}
                      alt={tip.label}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: "center",
                      lineHeight: 1.3,
                      maxWidth: 100,
                      color: selected ? fg : muted,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {tip.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, padding: "0 4px" }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              先蒸後略煎
            </p>
            <p style={{ fontSize: 16, color: muted, lineHeight: 1.7 }}>
              油炸食物含大量脂肪熱量，長期下來會導致體重增加——這是胰島素失效的主要成因。先蒸熟食物，之後只需短暫煎香，無需大量用油。
            </p>
          </div>
        </section>
      </div>

      <nav
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: 358,
          height: 58,
          backgroundColor: "rgba(187,222,214,0.85)",
          borderRadius: 160,
          boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 8px",
        }}
      >
        <NavTab Icon={Camera} active={false} />
        <NavTab Icon={Calendar} active={false} />
        <NavTab Icon={Lightbulb} active label="健康資訊" />
        <NavTab Icon={User} active={false} />
      </nav>
    </div>
  );
}

function NavTab({
  Icon,
  active,
  label,
}: {
  Icon: typeof Camera;
  active: boolean;
  label?: string;
}) {
  const color = "#0D5E4F";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color,
        flex: 1,
      }}
    >
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      {active && label && (
        <span style={{ fontSize: 12, fontWeight: 500, color, marginTop: 2, lineHeight: 1.1 }}>
          {label}
        </span>
      )}
    </div>
  );
}
