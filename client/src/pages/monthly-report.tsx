import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell } from "recharts";
import {
  Dumbbell, Droplets, Apple, Flame, Cookie, Clock,
  UtensilsCrossed, ShoppingBag, Leaf, Check, Coffee, LucideIcon,
} from "lucide-react";

interface TipPerformance {
  yes: number;
  no: number;
  noChance: number;
}

interface StruggleStatus {
  tips: string[];
  completed: boolean;
}

export interface MonthlyReportData {
  totalMinutes: number;
  tipPerformance: Record<string, TipPerformance>;
  struggleStatus: Record<string, StruggleStatus>;
  weeksAnalyzed: number;
}

const STRUGGLE_NAMES: Record<string, string> = {
  sugary_food_drink: "Sugary Food & Drinks",
  oily_fried_food: "Oily/Fried Food",
  eat_out: "Eating Out",
  portions: "Portion Control",
  snacks: "Snacking",
};

const PIE_COLORS = ["#14A085", "#22c55e", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#ec4899"];

function getTipIcon(tip: string): LucideIcon {
  const lower = tip.toLowerCase();
  if (lower.includes("juice") || lower.includes("water") || lower.includes("dilute") || lower.includes("drink")) return Droplets;
  if (lower.includes("yogurt") || lower.includes("berr") || lower.includes("fruit") || lower.includes("dessert") || lower.includes("apple")) return Apple;
  if (lower.includes("fried") || lower.includes("oil") || lower.includes("steam") || lower.includes("grill")) return Flame;
  if (lower.includes("snack") || lower.includes("nuts") || lower.includes("edamame") || lower.includes("cookie")) return Cookie;
  if (lower.includes("dinner") || lower.includes("kitchen") || lower.includes("closure") || lower.includes("dusk")) return Clock;
  if (lower.includes("plate") || lower.includes("portion") || lower.includes("vegg") || lower.includes("sides") || lower.includes("method")) return UtensilsCrossed;
  if (lower.includes("decouple") || lower.includes("share") || lower.includes("takeaway") || lower.includes("eat out")) return ShoppingBag;
  if (lower.includes("coffee") || lower.includes("tea")) return Coffee;
  return Leaf;
}

export function MonthlyReportContent({ data, monthName }: { data: MonthlyReportData; monthName: string }) {
  const sortedTips = Object.entries(data.tipPerformance).sort(([, a], [, b]) => b.yes - a.yes);
  const tipsWithSuccess = sortedTips.filter(([, perf]) => perf.yes > 0);

  const pieData = tipsWithSuccess.map(([name, perf], i) => ({
    name,
    value: perf.yes,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold" data-testid="text-monthly-title">
        {monthName} Deep Dive
      </h1>

      <Card data-testid="card-diet-tips">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Diet Tips This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No diet tips tracked this month.</p>
          ) : (
            <>
              {pieData.length > 0 && (
                <div className="flex justify-center mb-5" data-testid="pie-chart-tips">
                  <PieChart width={180} height={180}>
                    <Pie
                      data={pieData}
                      cx={90}
                      cy={90}
                      outerRadius={85}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="white"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
              )}

              <div className="space-y-3">
                {sortedTips.map(([tip, perf]) => {
                  const Icon = getTipIcon(tip);
                  const pieEntry = pieData.find((p) => p.name === tip);
                  const color = pieEntry?.color ?? "#94a3b8";
                  const hasSuccess = perf.yes > 0;

                  return (
                    <div key={tip} className="flex items-start gap-2.5" data-testid={`tip-item-${tip}`}>
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: hasSuccess ? color + "25" : undefined }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{ color: hasSuccess ? color : undefined }}
                          data-testid={`tip-icon-${tip}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{tip}</p>
                        <p className="text-xs text-muted-foreground mt-0.5" data-testid={`tip-stats-${tip}`}>
                          {perf.yes > 0 ? `Followed ${perf.yes} ${perf.yes === 1 ? "day" : "days"}` : ""}
                          {perf.yes > 0 && perf.no > 0 ? " · " : ""}
                          {perf.no > 0 ? `Skipped ${perf.no}` : ""}
                          {(perf.yes > 0 || perf.no > 0) && perf.noChance > 0 ? " · " : ""}
                          {perf.noChance > 0 ? `Not possible ${perf.noChance}` : ""}
                          {perf.yes === 0 && perf.no === 0 && perf.noChance === 0 ? "Not tracked" : ""}
                          {perf.yes === 0 && perf.no === 0 && perf.noChance > 0 ? `Not possible ${perf.noChance} times` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-diet-struggles">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Diet Struggles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(data.struggleStatus).map(([struggle, info]) => {
            const name = STRUGGLE_NAMES[struggle] ?? struggle;
            const sortedStruggleTips = [...info.tips].sort((a, b) => {
              const aPerf = data.tipPerformance[a];
              const bPerf = data.tipPerformance[b];
              return (bPerf?.yes ?? 0) - (aPerf?.yes ?? 0);
            });

            return (
              <div key={struggle} data-testid={`struggle-${struggle}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {info.completed ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600" data-testid={`struggle-mastered-${struggle}`}>
                      <Check className="w-4 h-4" />
                      {name} — Mastered ✓
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                  )}
                </div>
                {sortedStruggleTips.length > 0 && (
                  <ul className="space-y-1.5 ml-1">
                    {sortedStruggleTips.map((tip) => {
                      const perf = data.tipPerformance[tip];
                      const Icon = getTipIcon(tip);
                      return (
                        <li key={tip} className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`struggle-tip-${tip}`}>
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1">{tip}</span>
                          {perf && perf.yes > 0 && (
                            <span className="text-xs text-primary font-medium" data-testid={`struggle-tip-yes-${tip}`}>
                              {perf.yes}× followed
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-testid="card-physical-tank">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            Physical Tank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold" data-testid="text-total-minutes">
            {data.totalMinutes} min
          </p>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-avg-per-week">
            {Math.round(data.totalMinutes / data.weeksAnalyzed)} min/week average over {data.weeksAnalyzed} weeks
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MonthlyReportPage() {
  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long" });

  const { data, isLoading, error } = useQuery<MonthlyReportData>({
    queryKey: ["/api/report/monthly", "0"],
  });

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24 space-y-4" data-testid="loading-monthly-report">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="error-monthly-report">
        <p className="text-muted-foreground text-center">Failed to load monthly report.</p>
      </div>
    );
  }

  if (data.weeksAnalyzed < 4) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="no-data-monthly-report">
        <p className="text-muted-foreground text-center text-lg">
          Complete at least 4 weeks to see your monthly report.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="monthly-report-page">
      <MonthlyReportContent data={data} monthName={monthName} />
    </div>
  );
}
