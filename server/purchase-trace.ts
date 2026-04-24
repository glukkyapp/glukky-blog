// In-memory ring buffer of recent in-app purchase attempts. The paywall
// posts one event per phase to /api/diag/purchase-trace; the diag
// endpoint /api/diag/rc-state surfaces the trace back so the user can
// see exactly which phase failed without needing the dev panel.
//
// Bounded both per-user (PER_USER_MAX) and globally (GLOBAL_MAX) so a
// runaway client cannot exhaust server memory.

export interface PurchaseTraceEvent {
  phase: string;
  t: number;
  data: Record<string, unknown>;
}

export interface PurchaseTrace {
  id: string;
  userId: string;
  startedAt: number;
  events: PurchaseTraceEvent[];
  clientOfferingIdentifiers: string[];
  clientPackageIdentifiers: string[];
}

const PER_USER_MAX = 5;
const GLOBAL_MAX = 200;
const MAX_EVENTS_PER_TRACE = 40;

const traces = new Map<string, PurchaseTrace>();
const insertionOrder: string[] = [];

function gcGlobal(): void {
  while (insertionOrder.length > GLOBAL_MAX) {
    const evictId = insertionOrder.shift();
    if (evictId) traces.delete(evictId);
  }
}

function gcPerUser(userId: string): void {
  const all = Array.from(traces.values()).filter((t) => t.userId === userId);
  if (all.length <= PER_USER_MAX) return;
  all.sort((a, b) => a.startedAt - b.startedAt);
  const toEvict = all.slice(0, all.length - PER_USER_MAX);
  for (const tr of toEvict) {
    traces.delete(tr.id);
    const idx = insertionOrder.indexOf(tr.id);
    if (idx >= 0) insertionOrder.splice(idx, 1);
  }
}

export function appendTraceEvent(
  id: string,
  userId: string,
  event: PurchaseTraceEvent,
  extras?: {
    clientOfferingIdentifiers?: string[];
    clientPackageIdentifiers?: string[];
  },
): PurchaseTrace | null {
  let trace = traces.get(id);
  if (!trace) {
    trace = {
      id,
      userId,
      startedAt: Date.now(),
      events: [],
      clientOfferingIdentifiers: [],
      clientPackageIdentifiers: [],
    };
    traces.set(id, trace);
    insertionOrder.push(id);
    gcPerUser(userId);
    gcGlobal();
  }
  // Defence in depth: a different signed-in user must not be able to
  // append to a trace started by someone else, even if they guess the id.
  if (trace.userId !== userId) return null;
  if (trace.events.length < MAX_EVENTS_PER_TRACE) {
    trace.events.push(event);
  }
  if (extras?.clientOfferingIdentifiers && extras.clientOfferingIdentifiers.length > 0) {
    trace.clientOfferingIdentifiers = extras.clientOfferingIdentifiers.slice(0, 16);
  }
  if (extras?.clientPackageIdentifiers && extras.clientPackageIdentifiers.length > 0) {
    trace.clientPackageIdentifiers = extras.clientPackageIdentifiers.slice(0, 16);
  }
  return trace;
}

export function getTracesForUser(userId: string, limit = PER_USER_MAX): PurchaseTrace[] {
  const all = Array.from(traces.values()).filter((t) => t.userId === userId);
  all.sort((a, b) => b.startedAt - a.startedAt);
  return all.slice(0, limit);
}

export function _clearAllTracesForTests(): void {
  traces.clear();
  insertionOrder.length = 0;
}
