import "../food-snap/_group.css";

export function HomeTired() {
  const primary = "#127843";
  const muted = "hsl(168 10% 45%)";
  const bg = "hsl(23 36% 93%)";

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const walkData = [
    { scheduled: true, done: true, tired: false, dur: 10 },
    { scheduled: true, done: true, tired: false, dur: 10 },
    { scheduled: true, done: true, tired: true, dur: 10 },
    { scheduled: false, done: false, tired: false, dur: 0 },
    { scheduled: true, done: false, tired: false, dur: 10 },
    { scheduled: false, done: false, tired: false, dur: 0 },
    { scheduled: false, done: false, tired: false, dur: 0 },
  ];

  const dinnerData = [
    { scheduled: false },
    { scheduled: true, success: true },
    { scheduled: false },
    { scheduled: true, success: false },
    { scheduled: true, success: null },
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

        <p style={{ fontSize: 16, fontWeight: 600 }}>Hi, Cynthia 👋</p>

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
              Remember your goal — <strong>have energy to play with my grandkids</strong>! Keep it up!
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
              padding: 12,
              backgroundColor: "#eff6ff",
              borderRadius: 8,
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
            <SummaryRow label="Diet tactic for Oily/Fried Food" value="Yes" positive />
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4M8 12h4M14 12h4M20 12h4" /><path d="M6 8l-2 4 2 4" /><path d="M18 8l2 4-2 4" />
            </svg>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Focus: Oily/Fried Food</p>
          </div>
          <p style={{ fontSize: 14, color: primary, fontWeight: 500 }}>
            "Try air-frying or baking instead of deep-frying when cooking at home"
          </p>
        </Card>

        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Weekly Calendar</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 12 }}>
              <div />
              {days.map(d => (
                <div key={d} style={{ fontWeight: 500, color: muted }}>{d}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "40px repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 12, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 500, textAlign: "right", paddingRight: 4 }}>Walk</div>
              {walkData.map((d, i) => (
                <div
                  key={i}
                  style={{
                    height: d.scheduled ? 40 : 28,
                    borderRadius: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: !d.scheduled ? "hsl(150 15% 92%)" :
                      (i <= 2) ? (d.done ? "#dcfce7" : "#fef2f2") :
                      "hsl(150 15% 92%)",
                    color: !d.scheduled ? muted :
                      (i <= 2) ? (d.done ? "#16a34a" : "#ef4444") :
                      muted,
                  }}
                >
                  {d.scheduled && i <= 2 ? (
                    <>
                      {d.done ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      <span style={{ fontSize: 9, lineHeight: 1, marginTop: 2 }}>{d.dur}m</span>
                    </>
                  ) : d.scheduled ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 5-6 3.51 0 4.97 3.28 5 6 .03 2.5-1 3.5-1 5.62V16" /><path d="M12 16v-2.38c0-2.12-1.03-3.12-1-5.62.03-2.72 1.49-6 5-6 3.51 0 4.97 3.28 5 6 .03 2.5-1 3.5-1 5.62V16" /><line x1="4" y1="18" x2="12" y2="18" /><line x1="12" y1="18" x2="20" y2="18" /></svg>
                      <span style={{ fontSize: 9, lineHeight: 1, marginTop: 2 }}>{d.dur}m</span>
                    </>
                  ) : null}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "40px repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 12, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 500, textAlign: "right", paddingRight: 4, lineHeight: 1.2 }}>Late Dinner</div>
              {dinnerData.map((d, i) => (
                <div
                  key={i}
                  style={{
                    height: 28,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: !d.scheduled ? "hsl(150 15% 92%)" :
                      d.success === true ? "#dcfce7" :
                      d.success === false ? "#fef2f2" :
                      "#fefce8",
                    color: !d.scheduled ? muted :
                      d.success === true ? "#16a34a" :
                      d.success === false ? "#ef4444" :
                      "#d97706",
                  }}
                >
                  {d.scheduled && d.success === true && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                  {d.scheduled && d.success === false && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  )}
                  {d.scheduled && d.success === null && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18" /><line x1="12" y1="2" x2="12" y2="6" /><path d="M18.36 5.64l-1.41 1.41" /><path d="M5.64 5.64l1.41 1.41" /></svg>
                  )}
                </div>
              ))}
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
