import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("client/src/index.css", "utf8");
const home = readFileSync("client/src/pages/home.tsx", "utf8");
const dailyTask = readFileSync("client/src/components/daily-task-card.tsx", "utf8");
const snap = readFileSync("client/src/pages/snap.tsx", "utf8");
const popup = readFileSync("client/src/components/snap-advice-popup.tsx", "utf8");

assert.match(css, /\.app-page-v2\s*\{[^}]*background:\s*hsl\(var\(--background\)\)/s);
assert.match(css, /\.app-page-v2 \.shadcn-card\s*\{[^}]*background-color:\s*hsl\(var\(--card\)\)[^}]*border-color:\s*hsl\(var\(--card-border\)\)/s);
assert.doesNotMatch(css, /\.app-page-v2 \.shadcn-card \.border/);
assert.doesNotMatch(css, /\.shadcn-card\.is-(alert|emphasis|calendar)/);
assert.match(css, /\[role="dialog"\][^{]*\{[^}]*background-color:\s*hsl\(var\(--popover\)\)/s);

assert.match(home, /hargawmascot_1789835862050\.png/);
assert.match(home, /id="daily-habit-heading"/);
assert.match(home, /<DailyTaskCard \/>/);
assert.doesNotMatch(dailyTask, /home\.daily_tasks_heading/);
assert.doesNotMatch(dailyTask, /<section/);

for (const step of ["upload", "labeling", "meal-select", "review", "advising", "advice"]) {
  const state = step.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(snap, new RegExp(`step === "${state}"[\\s\\S]*?snap-state-card`));
}
assert.doesNotMatch(snap, /brand-cream-muted/);
assert.match(popup, /snap-advice-dialog/);

console.log("Task 981 visual contract passed");