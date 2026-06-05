import { Home, Camera, Lightbulb, TrendingUp, Utensils, User, type LucideIcon } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fdfbee",
  green: "#5F9D7A",
  greenDeep: "#2F6B43",
  bubble: "#eef9d7",
};

function NavBar() {
  const items: { Icon: LucideIcon; label: string; active?: boolean }[] = [
    { Icon: Home, label: "主頁", active: true },
    { Icon: Utensils, label: "食物" },
    { Icon: Camera, label: "快拍" },
    { Icon: TrendingUp, label: "血糖" },
    { Icon: Lightbulb, label: "健康" },
    { Icon: User, label: "我的" },
  ];
  return (
    <nav
      className="absolute left-1/2 -translate-x-1/2 flex items-center px-2"
      style={{
        bottom: 16,
        width: "calc(100% - 32px)",
        maxWidth: 360,
        height: 58,
        backgroundColor: "rgba(187,222,214,0.85)",
        borderRadius: 160,
        boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
      }}
    >
      {items.map(({ Icon, label, active }) => (
        <div key={label} className="flex-1 flex flex-col items-center justify-center" style={{ color: "#0D5E4F" }}>
          <Icon size={active ? 22 : 20} strokeWidth={active ? 2.5 : 2} />
          {active && <span className="text-[11px] font-medium leading-tight mt-0.5">{label}</span>}
        </div>
      ))}
    </nav>
  );
}

function DailyTimeline() {
  const START = 6;
  const END = 24;
  const RANGE = END - START;
  const pct = (h: number) => `${((h - START) / RANGE) * 100}%`;

  const meals = [
    { hour: 8,    color: "#EAB308" },
    { hour: 13,   color: "#EF4444" },
    { hour: 21.5, color: "#EAB308" },
  ];

  const ticks = [6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="space-y-1.5">
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ backgroundColor: "#E6E1D4" }} />
        {meals.map(({ hour, color }, i) => (
          <div
            key={i}
            className="absolute w-3.5 h-3.5 rounded-full border-2 border-white"
            style={{ left: pct(hour), transform: "translateX(-50%)", backgroundColor: color, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
          />
        ))}
      </div>
      <div className="relative h-3">
        {ticks.map(h => (
          <span
            key={h}
            className="absolute text-[9px]"
            style={{ left: pct(h), transform: "translateX(-50%)", color: COLORS.muted }}
          >
            {h}時
          </span>
        ))}
      </div>
      <p className="text-[23px] mt-1" style={{ color: COLORS.muted }}>
        晚餐遲了吃，明天建議提早 😊
      </p>
    </div>
  );
}

function DonutChart({ size = 110 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.16;
  const circ = 2 * Math.PI * r;
  const segs = [
    { pct: 0.65, color: "#5F9D7A", offset: 0 },
    { pct: 0.25, color: "#EAB308", offset: 0.65 },
    { pct: 0.10, color: "#EF4444", offset: 0.90 },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      {segs.map(({ pct, color, offset }, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeDashoffset={-offset * circ}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, fontSize: size * 0.15, fontWeight: 700, fill: COLORS.ink }}>
        87分
      </text>
    </svg>
  );
}

export default function HomeTiredZhHant() {
  return (
    <div className="app-page-v2 relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        .goal-bubble { position: relative; background: ${COLORS.bubble}; border-radius: 20px; padding: 16px 18px; }
        .goal-bubble::after { content: ""; position: absolute; left: 28px; bottom: -9px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${COLORS.bubble}; filter: drop-shadow(0 2px 1px rgba(44,72,56,0.05)); }
        .pf { font-family: 'Playfair Display', serif; }
      `}</style>
      <div className="px-6 pt-14 pb-20 space-y-4 h-full overflow-y-auto">
        {/* Header */}
        <div>
          <h1 className="text-[26px] font-normal leading-tight" style={{ color: COLORS.ink }}>星期三</h1>
          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="pf text-[42px] font-bold leading-none flex-1 min-w-0 whitespace-nowrap" style={{ color: COLORS.ink, letterSpacing: "-0.02em" }}>你好，Olivia！</p>
            <img src={`${import.meta.env.BASE_URL}images/gift-prod.png`} alt="" className="w-16 h-16 shrink-0" />
          </div>
        </div>

        {/* Goal speech bubble */}
        <div>
          <div className="goal-bubble">
            <p className="text-[18px] leading-snug" style={{ color: COLORS.ink }}>
              記住你的目標——擁有<strong style={{ color: COLORS.ink }}>更好的皮膚</strong>！繼續加油！
            </p>
          </div>
        </div>

        {/* TODAY card */}
        <div className="rounded-[28px] p-[22px] space-y-3" style={{ backgroundColor: COLORS.card, boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2 text-[14px]" style={{ color: COLORS.muted, letterSpacing: "0.05em" }}>
            <span className="font-semibold text-[21px]" style={{ color: COLORS.ink }}>今天</span>
            <span>— 4月2日（三）</span>
          </div>
          <DailyTimeline />
        </div>

        {/* Weekly Report card */}
        <div className="rounded-[28px] p-[22px] space-y-3" style={{ backgroundColor: COLORS.card, boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="flex items-start gap-4">
            {/* Donut */}
            <div className="shrink-0">
              <DonutChart size={108} />
            </div>
            {/* Right column */}
            <div className="flex-1 space-y-2 pt-1">
              <p className="text-[25px] font-semibold" style={{ color: COLORS.ink }}>本週分數：<span style={{ color: COLORS.greenDeep }}>87分</span></p>
              <p className="text-[22px] leading-snug" style={{ color: COLORS.muted }}>
                觀察到你這星期的午餐吃了較多精製麵類，令血糖升高。
              </p>
              <p className="text-[22px] leading-snug" style={{ color: COLORS.muted }}>
                下星期午餐可選擇冬粉或蕎麥麵，少吃更好！
              </p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-[21px]" style={{ color: COLORS.muted }}>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#5F9D7A" }} />達標</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EAB308" }} />進步中</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EF4444" }} />需改善</span>
          </div>
        </div>
      </div>
      <NavBar />
    </div>
  );
}
