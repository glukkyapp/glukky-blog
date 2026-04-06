import "../food-snap/_group.css";
import { Footprints, Check, X, TrendingUp, Lock } from "lucide-react";

export function MonthlyDeepDive() {
  const primary = "#127843";
  const bg = "hsl(23 36% 93%)";
  const muted = "hsl(168 10% 45%)";

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
          padding: "24px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700 }}>April Deep Dive</span>
        </div>
        <p style={{ fontSize: 13, color: muted, marginTop: -8 }}>Apr 1 – Apr 30</p>

        <div
          style={{
            background: `linear-gradient(135deg, ${primary}18, ${primary}08)`,
            border: `1px solid ${primary}33`,
            borderRadius: 12,
            padding: "14px 16px",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: primary }}>
            🎉 You completed your first month — great job, Olivia!
          </p>
          <p style={{ fontSize: 13, color: muted, marginTop: 8 }}>
            Piggy bank reward goal: "A new skincare mask set 🎁"
          </p>
        </div>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${primary}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Footprints style={{ width: 15, height: 15, color: primary }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Walking</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <StatRow label="Total walks completed" value="14 of 17" />
            <StatRow label="Total active minutes" value="155 min" />
            <StatRow label="Longest streak" value="5 days in a row" />
            <StatRow label="Tired days" value="3" />
            <StatRow label="Reduced walks given" value="2" last />
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Completion rate</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: primary }}>82%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, backgroundColor: "hsl(150 15% 90%)", overflow: "hidden" }}>
              <div style={{ width: "82%", height: "100%", borderRadius: 99, backgroundColor: primary }} />
            </div>
          </div>

          <p style={{ fontSize: 13, color: primary, fontStyle: "italic", marginTop: 4 }}>
            "You showed up even on hard days. That matters more than speed."
          </p>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${primary}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp style={{ width: 15, height: 15, color: primary }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Diet Progress</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid hsl(160 15% 90%)" }}>
              <span style={{ fontSize: 13, color: "hsl(168 30% 12%)" }}>Oily / Fried Food</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
                <Check style={{ width: 13, height: 13 }} /> Mastered (Week 3)
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid hsl(160 15% 90%)" }}>
              <span style={{ fontSize: 13, color: "hsl(168 30% 12%)" }}>Sugary Food & Drink</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
                🔄 In progress
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 13, color: "hsl(168 10% 55%)" }}>Late Dinner</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(168 10% 55%)", display: "flex", alignItems: "center", gap: 4 }}>
                <Lock style={{ width: 12, height: 12 }} /> Coming soon
              </span>
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Tips followed this month</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: primary }}>18 / 24 (75%)</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, backgroundColor: "hsl(150 15% 90%)", overflow: "hidden" }}>
              <div style={{ width: "75%", height: "100%", borderRadius: 99, backgroundColor: primary }} />
            </div>
          </div>

          <div style={{ backgroundColor: `${primary}08`, border: `1px solid ${primary}20`, borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: muted, marginBottom: 2 }}>Current tip</p>
            <p style={{ fontSize: 13, color: primary, fontWeight: 500 }}>
              "Choose sugar-free drink / Dilute juice 1:1 with water"
            </p>
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
        borderRadius: 12,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 0",
        borderBottom: last ? "none" : "1px solid hsl(160 15% 90%)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "hsl(168 10% 45%)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "hsl(168 30% 12%)" }}>{value}</span>
    </div>
  );
}
