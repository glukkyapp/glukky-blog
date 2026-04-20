import { Footprints, UtensilsCrossed, TrendingUp, Battery, Check, X, CheckCircle2, Home, Camera, CalendarDays, Soup, Activity, Droplets, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fbfbf3",
  green: "#5F9D7A",
  greenDeep: "#2F6B43",
  bubble: "#eef9d7",
};

function NavBar() {
  const items: { Icon: LucideIcon; label: string; active?: boolean }[] = [
    { Icon: Home, label: "Home", active: true },
    { Icon: TrendingUp, label: "Roadmap" },
    { Icon: Camera, label: "Snap" },
    { Icon: CalendarDays, label: "Plan" },
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
          {active && <span className="text-[11px] font-medium leading-tight mt-0.5">{label}</span>}
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

type CalCellState = "done" | "missed" | "scheduled" | "future" | "inactive";

function WalkCell({ state, dur }: { state: CalCellState; dur?: number }) {
  if (state === "inactive") return <div className="rounded bg-black/5 h-7" />;
  const cls =
    state === "done" ? "bg-green-100 text-green-600 h-10" :
    state === "missed" ? "bg-red-50 text-red-400 h-10" :
    state === "scheduled" ? "bg-black/5 h-10" : "bg-black/5 h-7";
  return (
    <div className={`rounded flex flex-col items-center justify-center ${cls}`} style={{ color: state === "done" ? "#16A34A" : state === "missed" ? "#F87171" : COLORS.muted }}>
      {state === "done" ? <Check className="w-3 h-3" /> :
       state === "missed" ? <X className="w-3 h-3" /> :
       state === "scheduled" ? <Footprints className="w-3 h-3" /> : null}
      {dur != null && (state === "done" || state === "missed" || state === "scheduled") && (
        <span className="text-[10px] leading-none mt-0.5">{dur} min</span>
      )}
    </div>
  );
}

function DinnerCell({ state }: { state: "done" | "missed" | "scheduled" | "tactic" | "none" }) {
  const cls =
    state === "done" ? "bg-green-100 text-green-600" :
    state === "missed" ? "bg-red-50 text-red-400" :
    state === "tactic" ? "bg-amber-50 text-amber-600" :
    state === "scheduled" ? "bg-black/5" : "bg-black/5";
  const color = state === "done" ? "#16A34A" : state === "missed" ? "#F87171" : state === "tactic" ? "#D97706" : COLORS.muted;
  return (
    <div className={`h-7 rounded flex items-center justify-center ${cls}`} style={{ color }}>
      {state === "done" ? <Check className="w-3 h-3" /> :
       state === "missed" ? <X className="w-3 h-3" /> :
       state === "tactic" ? <Soup className="w-3 h-3" /> :
       state === "scheduled" ? <Soup className="w-3 h-3" /> : null}
    </div>
  );
}

export default function HomeTired() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const walk: { state: CalCellState; dur?: number }[] = [
    { state: "done", dur: 10 },
    { state: "done", dur: 10 },
    { state: "done", dur: 10 },
    { state: "scheduled", dur: 5 },
    { state: "future" },
    { state: "future" },
    { state: "future" },
  ];
  const dinner: { state: "done" | "missed" | "scheduled" | "tactic" | "none" }[] = [
    { state: "none" },
    { state: "tactic" },
    { state: "done" },
    { state: "scheduled" },
    { state: "none" },
    { state: "none" },
    { state: "none" },
  ];

  return (
    <div className="app-page-v2 relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        .goal-bubble { position: relative; background: ${COLORS.bubble}; border-radius: 20px; padding: 16px 18px; }
        .goal-bubble::after { content: ""; position: absolute; left: 28px; bottom: -9px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${COLORS.bubble}; filter: drop-shadow(0 2px 1px rgba(44,72,56,0.05)); }
        .pf { font-family: 'Playfair Display', serif; }
      `}</style>
      <div className="px-6 pt-7 pb-28 space-y-4 h-full overflow-y-auto">
        {/* Header */}
        <div className="space-y-0.5">
          <h1 className="pf text-[26px] font-normal leading-tight" style={{ color: COLORS.ink }}>Wednesday</h1>
          <div className="flex items-center justify-between gap-3 -mt-1">
            <p className="pf text-[50px] font-bold leading-none flex-1 min-w-0" style={{ color: COLORS.ink, letterSpacing: "-0.02em" }}>Hi, Olivia!</p>
            <img src={`${import.meta.env.BASE_URL}images/gift-prod.png`} alt="" className="w-16 h-16 shrink-0" />
          </div>
        </div>

        {/* Goal speech bubble */}
        <div style={{ marginBottom: -6 }}>
          <div className="goal-bubble">
            <p className="text-[18px] leading-snug" style={{ color: COLORS.ink }}>
              Remember your goal — to have <strong style={{ color: COLORS.ink }}>better skin</strong>! Keep it up!
            </p>
          </div>
        </div>

        {/* TODAY card */}
        <div className="rounded-[28px] p-[22px] space-y-3" style={{ backgroundColor: COLORS.card, boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2 text-[14px] uppercase" style={{ color: COLORS.muted, letterSpacing: "0.05em" }}>
            <span className="font-semibold text-[21px]" style={{ color: COLORS.ink }}>TODAY</span>
            <span>— Wed, 2 Apr</span>
          </div>

          {/* Hydration callout (1.5x) */}
          <div className="rounded-lg p-3 flex items-start gap-2 bg-blue-50">
            <Droplets className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#3B82F6" }} />
            <div className="flex-1">
              <p className="text-[20px] font-medium leading-snug" style={{ color: "#1D4ED8" }}>
                We've reduced tomorrow's walk to 5 min. Stay hydrated and rest well!
              </p>
              <button className="text-[16px] mt-1 font-medium" style={{ color: "#2563EB" }}>Got it</button>
            </div>
          </div>

          {/* All checked-in */}
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
        <div className="rounded-[28px] p-[22px] space-y-3" style={{ backgroundColor: COLORS.card, boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" style={{ color: COLORS.green }} />
            <span className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Weekly calendar</span>
          </div>

          {/* Day header row */}
          <div className="grid gap-1 text-center text-xs" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
            <div />
            {days.map((d, i) => (
              <div key={d} className="font-medium" style={{ color: i === 2 ? COLORS.ink : COLORS.muted, fontWeight: i === 2 ? 700 : 500 }}>{d}</div>
            ))}
          </div>

          {/* Walk row */}
          <div className="grid gap-1 text-center text-xs items-center" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
            <div className="text-[12px] font-medium text-right pr-1" style={{ color: COLORS.muted }}>Walk</div>
            {walk.map((d, i) => <WalkCell key={i} state={d.state} dur={d.dur} />)}
          </div>

          {/* Late Dinner row */}
          <div className="grid gap-1 text-center text-xs items-center" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
            <div className="text-[12px] font-medium text-right pr-1 leading-tight" style={{ color: COLORS.muted }}>Late dinner</div>
            {dinner.map((d, i) => <DinnerCell key={i} state={d.state} />)}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 pt-2 text-[12px] flex-wrap" style={{ color: COLORS.muted }}>
            <div className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: "#16A34A" }} /> Done</div>
            <div className="flex items-center gap-1"><X className="w-3 h-3" style={{ color: "#F87171" }} /> Missed</div>
            <div className="flex items-center gap-1"><Footprints className="w-3 h-3" /> Planned walk</div>
            <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> Late dinner</div>
          </div>
        </div>
      </div>
      <NavBar />
    </div>
  );
}
