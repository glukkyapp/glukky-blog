import "../food-snap/_group.css";
import { Footprints, Check, TrendingUp, Lock } from "lucide-react";

export function MonthlyDeepDiveZhHant() {
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
          <span className="text-lg font-bold">四月深度回顧</span>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">4月1日 – 4月30日</p>

        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-primary">
            🎉 你完成了第一個月——做得好，Olivia！
          </p>
          <p className="text-sm text-muted-foreground">
            獎勵目標：「新護膚面膜套裝 🎁」
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Footprints className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">步行</p>
            </div>

            <div className="flex flex-col">
              <StatRow label="完成步行總數" value="14 / 17" />
              <StatRow label="總活動分鐘" value="155 分鐘" />
              <StatRow label="最長連續" value="連續5天" />
              <StatRow label="疲倦日數" value="3" />
              <StatRow label="減量步行次數" value="2" last />
            </div>

            <p className="text-sm text-primary italic">
              「你即使疲倦也堅持了，這比速度更重要。」
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">飲食進度</p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">油炸食物</span>
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> 已掌握（第3週）
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">甜食及飲料</span>
                <span className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                  🔄 進行中
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">遲吃晚餐</span>
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> 即將開始
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">本月完成貼士</span>
                <span className="text-xs font-bold text-primary">18 / 24 (75%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: "75%" }} />
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">目前貼士</p>
              <p className="text-sm text-primary font-medium">
                「選擇無糖飲品/果汁加1:1清水稀釋」
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
