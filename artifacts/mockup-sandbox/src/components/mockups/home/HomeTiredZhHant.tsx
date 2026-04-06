import "../food-snap/_group.css";
import { Check, X, Footprints, Soup } from "lucide-react";

export function HomeTiredZhHant() {
  const primary = "#127843";
  const muted = "hsl(168 10% 45%)";
  const bg = "hsl(23 36% 93%)";

  const days = ["一", "二", "三", "四", "五", "六", "日"];

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
          <span style={{ fontSize: 18, fontWeight: 700 }}>第3週 · 星期三</span>
        </div>

        <p style={{ fontSize: 16, fontWeight: 600 }}>你好，Olivia 👋</p>

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
              記住你的目標——<strong>擁有更好的皮膚</strong>！繼續加油！
            </p>
          </div>
        </div>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: muted }}>
            <span style={{ fontWeight: 600, color: "hsl(168 30% 12%)" }}>今天</span> — 4月2日（三）
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
              <p style={{ fontSize: 21, fontWeight: 500, color: "#1d4ed8" }}>
                明天的步行已減至5分鐘，記得多喝水、好好休息！
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
                知道了
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#15803d" }}>今天的簽到已完成</p>
            </div>

            <SummaryRow label="飯後散步" value="已完成" positive />
            <SummaryRow label="時長" value="10 分鐘" positive />
            <SummaryRow label="感覺疲倦" value="是" positive={false} />
            <SummaryRow label="晚餐策略（纖維）" value="已跟從" positive />
          </div>
        </Card>

        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>每週日曆</p>
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-1 text-center text-xs">
              <div />
              {days.map(d => (
                <div key={d} className="font-medium text-muted-foreground">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-8 gap-1 text-center text-xs items-center">
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1">步行</div>
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
              <div className="text-[10px] text-muted-foreground font-medium text-right pr-1 leading-tight">遲吃晚餐</div>
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
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> 完成</div>
              <div className="flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> 沒有做</div>
              <div className="flex items-center gap-1"><Footprints className="w-3 h-3" /> 計劃步行日子</div>
              <div className="flex items-center gap-1"><Soup className="w-3 h-3" /> 遲吃晚餐</div>
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
