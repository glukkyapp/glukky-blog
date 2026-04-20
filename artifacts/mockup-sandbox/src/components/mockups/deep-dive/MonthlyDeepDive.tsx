import { Footprints, TrendingUp, Check, Loader, Lock } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fff",
  hairline: "#EAE5D5",
  primary: "#2F6B43",
  green: "#5F9D7A",
  greenChip: "#d0f38f",
  amber: "#B7791F",
  blue: "#1E5E8A",
};

function StatRow({ label, value, valueColor = COLORS.ink, last }: { label: string; value: React.ReactNode; valueColor?: string; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: last ? "none" : `1px solid ${COLORS.hairline}` }}
    >
      <span className="text-[13px]" style={{ color: COLORS.muted }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: valueColor }}>{value}</span>
    </div>
  );
}

export default function MonthlyDeepDive() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="px-5 pt-7 pb-8 h-full overflow-y-auto space-y-4">
        {/* Heading */}
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          <h1 className="text-[24px] font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>April Deep Dive</h1>
        </div>
        <p className="text-[12px] -mt-2" style={{ color: COLORS.muted }}>Apr 1 – Apr 30</p>

        {/* Celebration banner */}
        <div className="rounded-2xl p-4 space-y-1" style={{ backgroundColor: "#FFF1D6" }}>
          <p className="text-[14px] font-semibold" style={{ color: "#7A4F00" }}>🎉 You completed your first month — great job, Olivia!</p>
          <p className="text-[12px]" style={{ color: "#7A4F00" }}>
            Piggy bank reward goal: <strong>"A new skincare mask set 🎁"</strong>
          </p>
        </div>

        {/* Walking card */}
        <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: COLORS.card, boxShadow: "0 2px 10px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.greenChip }}>
              <Footprints className="w-4 h-4" style={{ color: COLORS.primary }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Walking</p>
          </div>
          <div className="flex flex-col">
            <StatRow label="Total walks completed" value="14 of 17" />
            <StatRow label="Total active minutes" value="155 min" />
            <StatRow label="Longest streak" value="5 days in a row" valueColor={COLORS.primary} />
            <StatRow label="Tired days" value="3" valueColor={COLORS.amber} />
            <StatRow label="Reduced walks given" value="2" valueColor={COLORS.blue} last />
          </div>
          <p className="text-[12px] italic mt-1" style={{ color: COLORS.primary }}>
            "You showed up even on hard days. That matters more than speed."
          </p>
        </div>

        {/* Diet Progress card */}
        <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: COLORS.card, boxShadow: "0 2px 10px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.greenChip }}>
              <TrendingUp className="w-4 h-4" style={{ color: COLORS.primary }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Diet Progress</p>
          </div>
          <div className="flex flex-col">
            <StatRow
              label="Oily / Fried Food"
              value={<span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" style={{ color: COLORS.primary }} />Mastered (Week 3)</span>}
              valueColor={COLORS.primary}
            />
            <StatRow
              label="Sugary Food &amp; Drink"
              value={<span className="flex items-center gap-1"><Loader className="w-3.5 h-3.5" style={{ color: COLORS.amber }} />In progress</span>}
              valueColor={COLORS.amber}
            />
            <StatRow
              label="Late Dinner"
              value={<span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" style={{ color: COLORS.muted }} />Coming soon</span>}
              valueColor={COLORS.muted}
              last
            />
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-[12px] mb-1" style={{ color: COLORS.muted }}>
              <span>Tips followed this month</span>
              <span className="font-semibold" style={{ color: COLORS.ink }}>18/24 (75%)</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#EFEAD8" }}>
              <div className="h-full" style={{ width: "75%", backgroundColor: COLORS.primary }} />
            </div>
          </div>

          <div className="rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: "#F1F4ED" }}>
            <p className="text-[11px]" style={{ color: COLORS.muted }}>
              Current tip: <span style={{ color: COLORS.ink, fontWeight: 600 }}>"Choose sugar-free drink / Dilute juice 1:1 with water"</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
