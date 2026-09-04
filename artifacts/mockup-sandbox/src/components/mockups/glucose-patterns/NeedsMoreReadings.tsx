import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Info,
  X,
} from "lucide-react";
import "./_group.css";

type FoodPattern = {
  name: string;
  meals: number;
  eligible: number;
  needed: number;
  note: string;
  accent: string;
};

const foods: FoodPattern[] = [
  {
    name: "Wholegrain bread",
    meals: 26,
    eligible: 22,
    needed: 3,
    note: "Almost enough for a personal pattern",
    accent: "bg-[#d9e9df]",
  },
  {
    name: "Oatmeal",
    meals: 30,
    eligible: 8,
    needed: 17,
    note: "Some readings arrived outside the matching window",
    accent: "bg-[#f2e4c5]",
  },
];

function ProgressRing({ value, total }: { value: number; total: number }) {
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / total) * circumference;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0" aria-label={`${value} of ${total} eligible readings`}>
      <svg className="-rotate-90" width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
        <circle cx="34" cy="34" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[13px] font-bold text-foreground">
        {value}/{total}
      </span>
    </div>
  );
}

export function NeedsMoreReadings() {
  const [selected, setSelected] = useState<FoodPattern | null>(null);
  const [activeFood, setActiveFood] = useState(0);
  const food = foods[activeFood];

  return (
    <main className="foodsnap-glucose-patterns min-h-[100dvh] bg-[#fef2e0] pb-10 pt-5 text-foreground">
      <div className="mx-auto max-w-sm px-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-5 -ml-1 flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Back to FoodSnap"
        >
          <ChevronLeft size={17} /> Back
        </button>

        <header className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-primary">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
              <Check size={14} strokeWidth={3} />
            </span>
            Your readings
          </div>
          <h1 className="max-w-[300px] text-[28px] font-bold leading-[1.08] text-foreground">
            Your patterns are taking shape
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
            You have logged the food. We are waiting for a few more well-timed readings before showing a useful pattern.
          </p>
        </header>

        <section className="mb-5 rounded-2xl border border-primary/15 bg-card p-4 shadow-sm" aria-labelledby="progress-heading">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e7f0e8] text-primary">
              <Clock3 size={20} />
            </div>
            <div>
              <h2 id="progress-heading" className="text-sm font-bold">A little more time, not a problem</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                We need at least 25 eligible readings for each food. This keeps your results personal rather than noisy.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span>2 foods being followed</span>
            <span className="font-semibold text-primary">Keep logging as usual</span>
          </div>
        </section>

        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Recorded foods</p>
            <h2 className="mt-1 text-lg font-bold">Your reading progress</h2>
          </div>
          <button type="button" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="How reading progress works">
            <CircleHelp size={18} />
          </button>
        </div>

        <section className="space-y-3" aria-label="Foods awaiting enough readings">
          {foods.map((item, index) => (
            <button
              type="button"
              key={item.name}
              onClick={() => setSelected(item)}
              className={`group w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring ${index === activeFood ? "border-primary/35" : "border-border"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.accent} text-lg font-bold text-foreground`} aria-hidden="true">
                  {item.name === "Wholegrain bread" ? "W" : "O"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-[15px] font-bold">{item.name}</h3>
                    <ChevronRight size={17} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.meals} recorded meals · {item.note}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{item.eligible} eligible on-time readings</span>
                  <span className="text-muted-foreground">{item.needed} more needed</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(item.eligible / 25) * 100}%` }} />
                </div>
              </div>
            </button>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-dashed border-border bg-muted/35 p-4">
          <div className="flex gap-3">
            <Info size={18} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">What counts as eligible?</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                A reading counts when it is taken in the expected window after a meal. Delayed readings, or readings that cannot be matched to a meal, stay out of the pattern.
              </p>
              <p className="mt-3 text-xs font-semibold text-primary">No need to change what you eat or when you test.</p>
            </div>
          </div>
        </section>

        <section className="mt-6 border-t border-border/70 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Coming next</p>
              <p className="mt-1 text-sm font-semibold">Reading patterns will appear here</p>
            </div>
            <div className="flex gap-1.5" aria-label="Food progress carousel">
              {foods.map((item, index) => (
                <button key={item.name} type="button" onClick={() => setActiveFood(index)} className={`h-1.5 rounded-full transition-all ${index === activeFood ? "w-6 bg-primary" : "w-1.5 bg-border"}`} aria-label={`Show ${item.name} progress`} />
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-card px-3 py-3 text-xs text-muted-foreground shadow-sm">
            <span>{food.name}: {food.needed} more eligible readings</span>
            <button type="button" onClick={() => setSelected(food)} className="flex items-center gap-1 font-bold text-primary">Details <ArrowRight size={14} /></button>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`${selected.name} reading details`}>
          <section className="relative w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
            <button type="button" onClick={() => setSelected(null)} className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close details"><X size={18} /></button>
            <div className="flex items-center gap-3 pr-8">
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${selected.accent} text-xl font-bold`}>{selected.name[0]}</div>
              <div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-sm text-muted-foreground">{selected.meals} recorded meals</p></div>
            </div>
            <div className="mt-5 flex items-center gap-4 rounded-xl bg-muted/55 p-3">
              <ProgressRing value={selected.eligible} total={25} />
              <div><p className="text-sm font-bold">{selected.needed} more to go</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Only on-time readings matched to this food are included.</p></div>
            </div>
            <p className="mt-4 text-sm leading-5 text-muted-foreground">Once there are 25 eligible readings, FoodSnap will show this food in the measured patterns view. Until then, there is no impact level to interpret.</p>
            <button type="button" onClick={() => setSelected(null)} className="mt-5 flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">Got it</button>
          </section>
        </div>
      )}
    </main>
  );
}

export default NeedsMoreReadings;