import { Footprints, UtensilsCrossed, Battery, Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fdfbee",
  green: "#5F9D7A",
  greenDeep: "#2F6B43",
  bubble: "#eef9d7",
};

function DailyTimeline() {
  const START = 6;
  const END = 24;
  const RANGE = END - START;
  const pct = (h: number) => `${((h - START) / RANGE) * 100}%`;

  const meals = [
    { hour: 8,    color: "#EAB308" }, // breakfast ~8am yellow
    { hour: 13,   color: "#EF4444" }, // lunch ~1pm red
    { hour: 21.5, color: "#EAB308" }, // dinner ~9:30pm yellow
  ];

  const ticks = [6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="space-y-1.5">
      {/* Bar + dots */}
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
      {/* Tick labels */}
      <div className="relative h-3">
        {ticks.map(h => (
          <span
            key={h}
            className="absolute text-[9px]"
            style={{ left: pct(h), transform: "translateX(-50%)", color: COLORS.muted }}
          >
            {h}
          </span>
        ))}
      </div>
      {/* Caption */}
      <p className="text-[13px] mt-1" style={{ color: COLORS.muted }}>
        Dinner was late — try eating earlier tomorrow! 😊
      </p>
    </div>
  );
}

function DonutChart({ size = 110 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.16;
  const circ = 2 * Math.PI * r;
  // green 65%, yellow 25%, red 10%
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
      {/* Centre text — counter-rotate */}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, fontSize: size * 0.16, fontWeight: 700, fill: COLORS.ink }}>
        87 pts
      </text>
    </svg>
  );
}

export default function HomeTired() {
  return (
    <div className="app-page-v2 relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        .goal-bubble { position: relative; background: ${COLORS.bubble}; border-radius: 20px; padding: 16px 18px; }
        .goal-bubble::after { content: ""; position: absolute; left: 28px; bottom: -9px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${COLORS.bubble}; filter: drop-shadow(0 2px 1px rgba(44,72,56,0.05)); }
        .pf { font-family: 'Playfair Display', serif; }
      `}</style>
      <div className="px-6 pt-14 pb-20 space-y-4 h-full overflow-y-auto">
        {/* Header */}
        <div className="space-y-0.5">
          <h1 className="text-[26px] font-normal leading-tight" style={{ color: COLORS.ink }}>Wednesday</h1>
          <div className="flex items-center justify-between gap-3 -mt-2">
            <p className="pf text-[50px] font-bold leading-none flex-1 min-w-0" style={{ color: COLORS.ink, letterSpacing: "-0.02em" }}>Hi, Olivia!</p>
            <img src={`${import.meta.env.BASE_URL}images/gift-prod.png`} alt="" className="w-16 h-16 shrink-0" />
          </div>
        </div>

        {/* Goal speech bubble */}
        <div>
          <div className="goal-bubble">
            <p className="text-[18px] leading-snug" style={{ color: COLORS.ink }}>
              Remember your goal — to have <strong style={{ color: COLORS.ink }}>better skin</strong>! Keep it up!
            </p>
          </div>
        </div>

        {/* TODAY card */}
        <div className="rounded-[28px] p-[22px] space-y-3" style={{ backgroundColor: COLORS.card, boxShadow: "0 8px 28px rgba(44,72,56,0.14)" }}>
          <div className="flex items-center gap-2 text-[14px] uppercase" style={{ color: COLORS.muted, letterSpacing: "0.05em" }}>
            <span className="font-semibold text-[21px]" style={{ color: COLORS.ink }}>TODAY</span>
            <span>— Wed, 2 Apr</span>
          </div>
          <DailyTimeline />
        </div>

        {/* Weekly Report card */}
        <div className="rounded-[28px] p-[22px] space-y-3" style={{ backgroundColor: COLORS.card, boxShadow: "0 8px 28px rgba(44,72,56,0.14)" }}>
          <div className="flex items-start gap-4">
            {/* Donut */}
            <div className="shrink-0">
              <DonutChart size={108} />
            </div>
            {/* Right column */}
            <div className="flex-1 space-y-2 pt-1">
              <p className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Weekly score: <span style={{ color: COLORS.greenDeep }}>87 pts</span></p>
              <p className="text-[12px] leading-snug" style={{ color: COLORS.muted }}>
                We noticed your lunches this week included more <strong style={{ color: COLORS.greenDeep }}>refined noodles</strong>, raising your blood sugar.
              </p>
              <p className="text-[12px] leading-snug" style={{ color: COLORS.muted }}>
                Next week, try <strong style={{ color: COLORS.greenDeep }}>glass noodles</strong> or <strong style={{ color: COLORS.greenDeep }}>soba</strong> for lunch — less is even better!
              </p>
            </div>
          </div>
          {/* Donut legend */}
          <div className="flex items-center gap-3 text-[11px]" style={{ color: COLORS.muted }}>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#5F9D7A" }} />On track</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EAB308" }} />Improving</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EF4444" }} />Needs work</span>
          </div>
        </div>
      </div>
    </div>
  );
}
