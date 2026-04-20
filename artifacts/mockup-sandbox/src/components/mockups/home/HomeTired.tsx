import { Target, Footprints, UtensilsCrossed, TrendingUp, Battery, Check, CheckCircle2, Home, Camera, CalendarDays, Lightbulb, User, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fbfbf3",
  green: "#5F9D7A",
  greenDeep: "#2F6B43",
  greenChip: "#d0f38f",
};

function NavBar() {
  const items: { Icon: LucideIcon; label: string; active?: boolean }[] = [
    { Icon: Home, label: "Home", active: true },
    { Icon: TrendingUp, label: "Roadmap" },
    { Icon: Camera, label: "Snap" },
    { Icon: CalendarDays, label: "Plan" },
    { Icon: Lightbulb, label: "Info" },
    { Icon: User, label: "Profile" },
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
          <Icon size={22} strokeWidth={active ? 2.5 : 2} />
          {active && <span className="text-[10px] font-medium leading-tight mt-0.5">{label}</span>}
        </div>
      ))}
    </nav>
  );
}

function Row({ icon: Icon, label, value, valueColor = COLORS.ink, badge }: { icon: LucideIcon; label: string; value: string; valueColor?: string; badge?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="w-4 h-4" style={{ color: COLORS.green }} />
      <span className="text-[13px] flex-1" style={{ color: COLORS.ink }}>{label}</span>
      {badge}
      <span className="text-[13px] font-semibold" style={{ color: valueColor }}>{value}</span>
    </div>
  );
}

export default function HomeTired() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="px-6 pt-7 pb-28 space-y-5 h-full overflow-y-auto">
        {/* Week header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" style={{ color: COLORS.green }} />
            <span className="text-[12px] uppercase tracking-wider font-semibold" style={{ color: COLORS.muted }}>Week 3 · Wednesday</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[44px] font-bold leading-none" style={{ color: COLORS.ink }}>Hi, Olivia 👋</p>
            <img src="/images/gift.png" alt="" className="w-14 h-14 shrink-0" />
          </div>
        </div>

        {/* Goal bubble */}
        <div
          className="rounded-2xl px-4 py-3"
          style={{ backgroundColor: COLORS.card, boxShadow: "0 2px 8px rgba(44,72,56,0.06)" }}
        >
          <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
            Remember your goal — to have better skin! Keep it up!
          </p>
        </div>

        {/* TODAY card */}
        <div className="rounded-3xl p-5 space-y-3" style={{ backgroundColor: "#fff", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
            <span className="font-semibold" style={{ color: COLORS.ink }}>Today</span>
            <span>— Wed, 2 Apr</span>
          </div>

          {/* Hydration callout */}
          <div className="rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: "#E6F1FA" }}>
            <span className="text-base">💧</span>
            <div className="flex-1">
              <p className="text-[13px] font-medium" style={{ color: "#1E5E8A" }}>
                We've reduced tomorrow's walk to 5 min. Stay hydrated and rest well!
              </p>
              <button className="text-[11px] mt-1 underline" style={{ color: "#1E5E8A" }}>Got it</button>
            </div>
          </div>

          {/* All checked-in banner */}
          <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: "#EAF7E2" }}>
            <CheckCircle2 className="w-5 h-5" style={{ color: COLORS.greenDeep }} />
            <span className="text-[13px] font-medium" style={{ color: COLORS.greenDeep }}>Today's check-in complete</span>
          </div>

          <div className="space-y-1">
            <Row icon={Footprints} label="Walk after dinner" value="Completed" badge={<Check className="w-4 h-4" style={{ color: COLORS.greenDeep }} />} valueColor={COLORS.greenDeep} />
            <Row icon={Footprints} label="Duration" value="10 min" />
            <Row icon={Battery} label="Feeling tired" value="Yes" valueColor="#B7791F" />
            <Row icon={UtensilsCrossed} label="Late dinner tactic (Fiber)" value="Followed" badge={<Check className="w-4 h-4" style={{ color: COLORS.greenDeep }} />} valueColor={COLORS.greenDeep} />
          </div>
        </div>

        {/* Weekly Calendar */}
        <div className="rounded-3xl p-5 space-y-3" style={{ backgroundColor: "#fff", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" style={{ color: COLORS.green }} />
            <span className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Weekly Calendar</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div key={d} className="text-[11px]" style={{ color: i === 2 ? COLORS.ink : COLORS.muted, fontWeight: i === 2 ? 700 : 400 }}>{d}</div>
            ))}
            {["10m ✓", "10m ✓", "10m ✓", "5m", "—", "—", "—"].map((v, i) => (
              <div
                key={i}
                className="text-[11px] py-1.5 rounded-lg"
                style={{
                  backgroundColor: i < 3 ? COLORS.greenChip : i === 3 ? "#FFF1D6" : "transparent",
                  color: i < 3 ? COLORS.greenDeep : i === 3 ? "#B7791F" : COLORS.muted,
                  fontWeight: 600,
                }}
              >
                {v}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#FBE8DA" }}>
            <UtensilsCrossed className="w-3.5 h-3.5" style={{ color: "#C45A2B" }} />
            <span className="text-[11px] font-medium" style={{ color: "#7A3413" }}>Tue · Late dinner ✓ Fiber</span>
          </div>
        </div>
      </div>
      <NavBar />
    </div>
  );
}
