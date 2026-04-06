import "../food-snap/_group.css";
import { Check, X, Footprints, Soup } from "lucide-react";

export function HomeTired() {
  const primary = "#127843";
  const muted = "hsl(168 10% 45%)";
  const bg = "hsl(23 36% 93%)";

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const walkData = [
    { scheduled: true, done: true, tired: false, dur: 10 },
    { scheduled: true, done: true, tired: false, dur: 10 },
    { scheduled: true, done: true, tired: true, dur: 10 },
    { scheduled: true, done: false, tired: false, dur: 5 },
    { scheduled: false, done: false, tired: false, dur: 0 },
    { scheduled: false, done: false, tired: false, dur: 0 },
    { scheduled: false, done: false, tired: false, dur: 0 },
  ];

  const dinnerData: { scheduled: boolean; success?: boolean | null }[] = [
    { scheduled: false },
    { scheduled: true, success: true },
    { scheduled: true, success: null },
    { scheduled: false },
    { scheduled: false },
    { scheduled: false },
    { scheduled: false },
  ];

  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        backgroundColor: bg,
        fontFamily: "'Karla', 'Inter', sans-serif",
        color: "hsl(168 30% 12%)",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 384,
          margin: "0 auto",
          padding: "24px 16px 96px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Week 3 · Wednesday</span>
        </div>

        <p style={{ fontSize: 16, fontWeight: 600 }}>Hi, Olivia 👋</p>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/__mockup/images/gift.png"
            alt=""
            style={{ width: 96, height: 96, borderRadius: 8, flexShrink: 0 }}
          />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 8,
              backgroundColor: `${primary}0D`,
              border: `1px solid ${primary}33`,
              padding: "8px 12px",
            }}
          >
            <p style={{ fontSize: 14, color: `${primary}CC` }}>
              Remember your goal — <strong>to have better skin</strong>! Keep it up!
            </p>
          </div>
        </div>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: muted }}>
            <span style={{ fontWeight: 600, color: "hsl(168 30% 12%)" }}>TODAY</span> — Wed, 2 Apr
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: 18,
              backgroundColor: "#eff6ff",
              borderRadius: 12,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
              <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
            </svg>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#1d4ed8" }}>
                We've reduced tomorrow's walk to 5 min. Stay hydrated and rest well!
              </p>
              <button
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Got it
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#15803d" }}>Today's check-in complete</p>
            </div>

            <SummaryRow label="Walk after dinner" value="Completed" positive />
            <SummaryRow label="Duration" value="10 min" positive />
            <SummaryRow label="Feeling tired" value="Yes" positive={false} />
            <SummaryRow label="Late dinner tactic (Fiber)" value="Followed" positive />
          </div>
        </Card>

        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Weekly Calendar</p>
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-1 text-center text-xs">
              <div />
              {days.map(d => (
                <div key={d} className="font-medium text-muted-foreground">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">Walk</div>
              {walkData.map((d, i) => {
                const isPast = i <= 2;
                const answered = isPast && d.scheduled;
                return (
                  <div
                    key={i}
                    className={`rounded flex flex-col items-center justify-center ${
                      !d.scheduled ? "bg-muted h-7" :
                      answered && d.done ? "bg-green-100 text-green-600 h-10" :
                      answered && !d.done ? "bg-red-50 text-red-400 h-10" :
                      d.scheduled ? "bg-muted h-10" : "bg-muted h-7"
                    }`}
                  >
                    {answered && d.done ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span className="text-[9px] leading-none mt-0.5">{d.dur}m</span>
                      </>
                    ) : answered && !d.done ? (
                      <>
                        <X className="w-3 h-3" />
                        <span className="text-[9px] leading-none mt-0.5">{d.dur}m</span>
                      </>
                    ) : d.scheduled ? (
                      <>
                        <Footprints className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[9px] leading-none mt-0.5 text-muted-foreground">{d.dur}m</span>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">Late Dinner</div>
              {dinnerData.map((d, i) => {
                const isPast = i <= 2;
                const answered = isPast && d.scheduled && d.success !== null && d.success !== undefined;
                return (
                  <div
                    key={i}
                    className={`h-7 rounded flex flex-col items-center justify-center ${
                      !d.scheduled ? "bg-muted" :
                      answered && d.success ? "bg-green-100 text-green-600" :
                      answered && !d.success ? "bg-red-50 text-red-400" :
                      "bg-muted"
                    }`}
                  >
                    {!d.scheduled ? null :
                     answered && d.success ? <Check className="w-3 h-3" /> :
                     answered && !d.success ? <X className="w-3 h-3" /> :
                     <Soup className="w-3 h-3 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 pt-2 text-[10px] text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> Done</div>
              <div className="flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> Missed</div>
              <div className="flex items-center gap-1"><Footprints className="w-3 h-3" /> Planned walk</div>
              <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> Late dinner</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid hsl(160 15% 85%)",
        borderRadius: 8,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function SummaryRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid hsl(160 15% 90%)",
        fontSize: 14,
      }}
    >
      <span style={{ color: "hsl(168 10% 45%)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: positive ? "#16a34a" : "#ef4444" }}>{value}</span>
    </div>
  );
}
