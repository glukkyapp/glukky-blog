import { useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import "./_group.css";

type Impact = "low" | "medium" | "high";
type Mode = "ai" | "actual";
type Food = { foodName: string; impact: Impact; snapCount?: number; lift?: number; highMeals?: number; totalMeals?: number };

const foods: Record<Mode, Record<Impact, Food[]>> = {
  ai: {
    low: [{ foodName: "Steamed fish with vegetables", impact: "low", snapCount: 14 }, { foodName: "Tofu and greens", impact: "low", snapCount: 9 }, { foodName: "Chicken salad", impact: "low", snapCount: 7 }],
    medium: [{ foodName: "Banana yoghurt bowl", impact: "medium", snapCount: 11 }, { foodName: "Chicken rice", impact: "medium", snapCount: 10 }],
    high: [{ foodName: "Char siu rice", impact: "high", snapCount: 16 }, { foodName: "Pineapple bun", impact: "high", snapCount: 8 }],
  },
  actual: {
    low: [{ foodName: "Steamed fish with vegetables", impact: "low", lift: 0.42, highMeals: 1, totalMeals: 8 }, { foodName: "Tofu and greens", impact: "low", lift: 0.61, highMeals: 1, totalMeals: 6 }],
    medium: [{ foodName: "Banana yoghurt bowl", impact: "medium", lift: 1.08, highMeals: 3, totalMeals: 7 }],
    high: [{ foodName: "Char siu rice", impact: "high", lift: 1.84, highMeals: 7, totalMeals: 9 }, { foodName: "Pineapple bun", impact: "high", lift: 1.56, highMeals: 4, totalMeals: 5 }],
  },
};

const impactClasses: Record<Impact, { badge: string; selected: string; unselected: string }> = {
  low: { badge: "bg-emerald-100 text-emerald-800", selected: "border-emerald-500 bg-emerald-500 text-white", unselected: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" },
  medium: { badge: "bg-amber-100 text-amber-800", selected: "border-amber-500 bg-amber-500 text-white", unselected: "border-amber-200 text-amber-700 hover:bg-amber-50" },
  high: { badge: "bg-red-100 text-red-800", selected: "border-red-500 bg-red-500 text-white", unselected: "border-red-200 text-red-700 hover:bg-red-50" },
};

function ImpactBadge({ impact }: { impact: Impact }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${impactClasses[impact].badge}`}>{impact[0].toUpperCase() + impact.slice(1)}</span>;
}

export function Current() {
  const [mode, setMode] = useState<Mode>("ai");
  const [impact, setImpact] = useState<Impact>("low");
  const [cardIndex, setCardIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const activeFoods = foods[mode][impact];
  const activeIndex = Math.min(cardIndex, activeFoods.length - 1);
  const activeFood = activeFoods[activeIndex];
  const matchingCount = activeFoods.length;
  const allFoods = useMemo(() => Object.values(foods).flatMap(group => Object.values(group).flat()).filter((food, i, list) => list.findIndex(item => item.foodName === food.foodName) === i), []);
  const suggestions = search.trim() ? allFoods.filter(food => food.foodName.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 4) : [];

  const select = (nextMode: Mode, nextImpact: Impact) => { setMode(nextMode); setImpact(nextImpact); setCardIndex(0); };
  const moveCard = (direction: -1 | 1) => setCardIndex(index => Math.max(0, Math.min(activeFoods.length - 1, index + direction)));
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;
    const distance = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (distance <= -40) moveCard(1);
    if (distance >= 40) moveCard(-1);
  };
  const detail = allFoods.find(food => food.foodName === selectedFood);

  return (
    <main className="foodsnap-glucose-patterns min-h-screen bg-background pb-28 pt-4 text-foreground">
      <div className="mx-auto max-w-sm px-4">
        <button type="button" onClick={() => window.history.back()} className="mb-4 -ml-1 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground" aria-label="Back to FoodSnap">
          <ChevronLeft size={16} /> Back
        </button>
        <header className="mb-5">
          <h1 className="text-xl font-bold text-foreground">Your glucose patterns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Discover which foods may have the biggest impact on your glucose.</p>
        </header>

        <section>
          <div className="mb-4 grid grid-cols-2 rounded-2xl bg-muted p-1" aria-label="Pattern type">
            {(["ai", "actual"] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => select(item, impact)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${mode === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{item === "ai" ? "FoodSnap estimates" : "Your readings"}</button>)}
          </div>
          <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Glucose impact">
            {(["low", "medium", "high"] as const).map(level => <button key={level} type="button" aria-pressed={impact === level} onClick={() => select(mode, level)} className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors ${impact === level ? impactClasses[level].selected : impactClasses[level].unselected}`}>
              <span className="block">{level[0].toUpperCase() + level.slice(1)}</span><span className="block text-[11px] opacity-80">{foods[mode][level].length}</span>
            </button>)}
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="food-search">Search your foods</label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input id="food-search" value={search} onChange={event => setSearch(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" placeholder="Try chicken rice" autoComplete="off" /></div>
            {search.trim() && <div className="mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {suggestions.map(suggestion => <button key={suggestion.foodName} type="button" className="block w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted" onClick={() => { setSelectedFood(suggestion.foodName); setSearch(""); }}>{suggestion.foodName}</button>)}
              {!suggestions.length && <p className="px-3 py-2.5 text-sm text-muted-foreground">No matching foods yet.</p>}
            </div>}
          </div>

          <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">8 more readings until your patterns are personalised.</p>
          <div aria-live="polite">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{mode === "ai" ? "Estimated food impact" : "Your measured impact"}</p><p className="text-xs text-muted-foreground">{matchingCount} matching foods</p></div>
            <div className="overflow-hidden" onPointerDown={event => { swipeStartX.current = event.clientX; }} onPointerUp={onPointerUp} onPointerCancel={() => { swipeStartX.current = null; }}>
              <article className="min-h-40 touch-pan-y rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-3"><div>{mode === "actual" && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Rank #{activeIndex + 1}</p>}<h2 className="text-lg font-bold text-foreground">{activeFood.foodName}</h2><p className="mt-1 text-sm text-muted-foreground">{mode === "ai" ? "Based on your FoodSnap history" : "Based on your glucose readings"}</p></div><ImpactBadge impact={impact} /></div>
                {mode === "actual" ? <div><p className="mb-3 text-sm text-muted-foreground">This food was more likely to be linked with a higher reading for you.</p><div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Relative impact</p><p className="text-2xl font-bold text-foreground">{activeFood.lift?.toFixed(2)}<span className="ml-0.5 text-sm font-medium">×</span></p></div><p className="text-sm text-muted-foreground">{activeFood.highMeals} of {activeFood.totalMeals} higher readings</p></div></div> : <p className="text-sm text-muted-foreground">Seen in {activeFood.snapCount} of your snaps</p>}
              </article>
              {activeFoods.length > 1 && <div className="mt-3 flex items-center justify-between"><button type="button" disabled={activeIndex === 0} onClick={() => moveCard(-1)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted disabled:opacity-40" aria-label="Previous food"><ChevronLeft size={18} /></button><p className="text-xs text-muted-foreground">{activeIndex + 1} / {activeFoods.length}</p><button type="button" disabled={activeIndex === activeFoods.length - 1} onClick={() => moveCard(1)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted disabled:opacity-40" aria-label="Next food"><ChevronRight size={18} /></button></div>}
            </div>
          </div>
        </section>
      </div>

      {selectedFood && detail && <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label={`${selectedFood} details`}><section className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"><button type="button" onClick={() => setSelectedFood(null)} className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Close"><X size={18} /></button><h2 className="pr-8 text-lg font-bold">{detail.foodName}</h2><p className="mt-1 text-sm text-muted-foreground">A summary of this food in your FoodSnap history.</p><div className="mt-5 flex items-center justify-between rounded-xl bg-muted/60 p-3"><div><p className="text-xs text-muted-foreground">Overall impact</p><div className="mt-1"><ImpactBadge impact={detail.impact} /></div></div><div className="text-right"><p className="text-xs text-muted-foreground">FoodSnaps</p><p className="text-lg font-bold text-foreground">{detail.snapCount ?? detail.totalMeals}</p></div></div><div className="mt-5"><p className="mb-2 text-sm font-semibold">Recent readings</p><ul className="space-y-2"><li className="flex justify-between rounded-xl border border-border px-3 py-2.5 text-sm"><span className="text-muted-foreground">12 Jan 2025</span><strong>7.1 mmol/L</strong></li><li className="flex justify-between rounded-xl border border-border px-3 py-2.5 text-sm"><span className="text-muted-foreground">4 Jan 2025</span><strong>6.8 mmol/L</strong></li></ul></div></section></div>}
    </main>
  );
}