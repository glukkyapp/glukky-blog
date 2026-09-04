import { TrendingUp } from "lucide-react";

const COLORS = {
  bg: "#fef2e0",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#ffffff",
  green: "#5F9D7A",
  greenDeep: "#2F6B43",
  red: "#EF4444",
  yellow: "#EAB308",
};

function SummaryCard({ label, food, color }: { label: string; food: string; color: string }) {
  return (
    <div
      className="flex-1 rounded-[20px] p-4 space-y-1"
      style={{ backgroundColor: COLORS.card, boxShadow: "0 4px 14px rgba(44,72,56,0.07)" }}
    >
      <p className="text-[18px] uppercase font-semibold tracking-wide" style={{ color: COLORS.muted }}>
        {label}
      </p>
      <p className="text-[27px] font-bold leading-snug" style={{ color }}>
        {food}
      </p>
    </div>
  );
}

type BarRow = { label: string; pct: number; color: string };

function BarChart({ rows }: { rows: BarRow[] }) {
  return (
    <div className="space-y-4">
      {rows.map(({ label, pct, color }) => (
        <div key={label} className="space-y-1.5">
          <p className="text-[25px] font-medium" style={{ color: COLORS.ink }}>{label}</p>
          <div className="h-5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEE8D8" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const bars: BarRow[] = [
  { label: "叉燒飯", pct: 88, color: COLORS.red },
  { label: "香蕉配無糖乳酪", pct: 52, color: COLORS.yellow },
  { label: "蒸魚配菜心", pct: 22, color: COLORS.green },
];

export default function GlucosePatternZhHant() {
  return (
    <div
      className="relative w-[390px] h-[844px] overflow-hidden"
      style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <div className="px-6 pt-14 pb-24 space-y-5 h-full overflow-y-auto">
        {/* Page title */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-7 h-7" style={{ color: COLORS.green }} strokeWidth={2.5} />
          <h1 className="text-[37px] font-bold leading-tight" style={{ color: COLORS.ink }}>
            血糖規律
          </h1>
        </div>

        {/* Top two cards */}
        <div className="flex gap-3">
          <SummaryCard label="最佳食物" food="白灼蝦" color={COLORS.greenDeep} />
          <SummaryCard label="最差食物" food="菠蘿包" color={COLORS.red} />
        </div>

        {/* Bar chart section */}
        <div>
          <p className="text-[23px] font-semibold mb-3" style={{ color: COLORS.muted }}>
            你的食物升糖排行榜
          </p>
          <div
            className="rounded-[24px] p-5"
            style={{ backgroundColor: COLORS.card, boxShadow: "0 4px 14px rgba(44,72,56,0.07)" }}
          >
            <BarChart rows={bars} />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[23px]" style={{ color: COLORS.muted }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.red }} />
            升糖高
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.yellow }} />
            中等
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.green }} />
            升糖低
          </span>
        </div>
      </div>
    </div>
  );
}
