import "../food-snap/_group.css";
import { Footprints, Check, TrendingUp, Lock } from "lucide-react";

export function MonthlyDeepDive() {
  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        fontFamily: "'Karla', 'Inter', sans-serif",
      }}
      className="bg-background text-foreground overflow-x-hidden overflow-y-auto"
    >
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(152 73% 17%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          <span className="text-lg font-bold">April Deep Dive</span>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">Apr 1 – Apr 30</p>

        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-primary">
            🎉 You completed your first month — great job, Olivia!
          </p>
          <p className="text-sm text-muted-foreground">
            Piggy bank reward goal: "A new skincare mask set 🎁"
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Footprints className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Walking</p>
            </div>

            <div className="flex flex-col">
              <StatRow label="Total walks completed" value="14 of 17" />
              <StatRow label="Total active minutes" value="155 min" />
              <StatRow label="Longest streak" value="5 days in a row" />
              <StatRow label="Tired days" value="3" />
              <StatRow label="Reduced walks given" value="2" last />
            </div>

            <p className="text-sm text-primary italic">
              "You showed up even on hard days. That matters more than speed."
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Diet Progress</p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Oily / Fried Food</span>
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Mastered (Week 3)
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Sugary Food & Drink</span>
                <span className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                  🔄 In progress
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Late Dinner</span>
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Coming soon
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">Tips followed this month</span>
                <span className="text-xs font-bold text-primary">18 / 24 (75%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: "75%" }} />
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Current tip</p>
              <p className="text-sm text-primary font-medium">
                "Choose sugar-free drink / Dilute juice 1:1 with water"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-border"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
