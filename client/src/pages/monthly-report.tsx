import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, TrendingUp, Dumbbell, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface TipPerformance {
  yes: number;
  no: number;
  noChance: number;
}

interface StruggleStatus {
  tips: string[];
  completed: boolean;
}

interface MonthlyReport {
  totalMinutes: number;
  tipPerformance: Record<string, TipPerformance>;
  struggleStatus: Record<string, StruggleStatus>;
  weeksAnalyzed: number;
}

export default function MonthlyReport() {
  const [activeCard, setActiveCard] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const { data, isLoading, error } = useQuery<MonthlyReport>({
    queryKey: ["/api/report/monthly", "0"],
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeCard < 2) setActiveCard(activeCard + 1);
      if (diff < 0 && activeCard > 0) setActiveCard(activeCard - 1);
    }
    touchStartX.current = null;
  };

  const goLeft = () => {
    if (activeCard > 0) setActiveCard(activeCard - 1);
  };

  const goRight = () => {
    if (activeCard < 2) setActiveCard(activeCard + 1);
  };

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-24" data-testid="loading-monthly-report">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-md w-2/3" />
          <div className="h-64 bg-muted rounded-md" />
        </div>
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
          Complete at least 4 weeks to see your monthly report
        </p>
      </div>
    );
  }

  const sortedTips = Object.entries(data.tipPerformance).sort(
    ([, a], [, b]) => a.yes - b.yes
  );
  const bestTipName = sortedTips.length > 0 ? sortedTips[sortedTips.length - 1][0] : null;

  const cardLabels = ["Diet Struggle Status", "Diet Tip Performance", "Physical Tank"];

  return (
    <div
      className="max-w-sm mx-auto px-4 pt-6 pb-24"
      data-testid="monthly-report-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <h1 className="text-xl font-bold mb-4" data-testid="text-monthly-title">Monthly Deep Dive</h1>

      <div className="flex items-center justify-between gap-2 mb-4">
        <Button
          size="icon"
          variant="ghost"
          onClick={goLeft}
          disabled={activeCard === 0}
          data-testid="button-prev-card"
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium text-muted-foreground" data-testid="text-card-label">
          {cardLabels[activeCard]}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={goRight}
          disabled={activeCard === 2}
          data-testid="button-next-card"
        >
          <ChevronRight />
        </Button>
      </div>

      {activeCard === 0 && (
        <Card data-testid="card-struggle-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
              <TrendingUp className="w-5 h-5" />
              Diet Struggle Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(data.struggleStatus).map(([struggle, info]) => (
              <div key={struggle} className="space-y-1" data-testid={`struggle-item-${struggle}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {info.completed && (
                    <Check className="w-4 h-4 text-green-500" data-testid={`icon-check-${struggle}`} />
                  )}
                  <span className={`font-medium ${info.completed ? "line-through text-muted-foreground" : ""}`}>
                    {struggle}
                  </span>
                </div>
                <ul className="ml-6 space-y-0.5">
                  {info.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground" data-testid={`tip-${struggle}-${i}`}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeCard === 1 && (
        <Card data-testid="card-tip-performance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
              <Award className="w-5 h-5" />
              Diet Tip Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTips.map(([tip, perf]) => (
              <div
                key={tip}
                className="flex items-center justify-between gap-2 flex-wrap"
                data-testid={`perf-item-${tip}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {tip === bestTipName && (
                    <Award className="w-4 h-4 text-yellow-500" data-testid={`icon-trophy-${tip}`} />
                  )}
                  {tip}
                </span>
                <span className="text-xs text-muted-foreground font-mono" data-testid={`perf-stats-${tip}`}>
                  {perf.yes}Y|{perf.no}N|{perf.noChance}NC
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeCard === 2 && (
        <Card data-testid="card-physical-tank">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
              <Dumbbell className="w-5 h-5" />
              Physical Tank
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <span className="text-5xl font-bold" data-testid="text-total-minutes">
              {data.totalMinutes}
            </span>
            <span className="text-sm text-muted-foreground" data-testid="text-minutes-label">
              total minutes
            </span>
            <span className="text-lg font-semibold" data-testid="text-avg-per-week">
              {Math.round(data.totalMinutes / data.weeksAnalyzed)} min/week avg
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center gap-2 mt-6" data-testid="dot-indicators">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => setActiveCard(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              activeCard === i ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            data-testid={`dot-indicator-${i}`}
          />
        ))}
      </div>
    </div>
  );
}
