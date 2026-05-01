import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

type OfflineNotifier = () => void;
let offlineNotifier: OfflineNotifier | null = null;
let lastNotifiedAt: number | null = null;
const NOTIFY_DEBOUNCE_MS = 500;

export function registerOfflineNotifier(fn: OfflineNotifier | null) {
  offlineNotifier = fn;
}

function notifyNetworkFailure() {
  if (!offlineNotifier) return;
  const now = Date.now();
  if (lastNotifiedAt != null && now - lastNotifiedAt < NOTIFY_DEBOUNCE_MS) return;
  lastNotifiedAt = now;
  try {
    offlineNotifier();
  } catch {
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  if (e.name === "AbortError") return true;
  if (err instanceof TypeError && typeof e.message === "string" && /fetch|network/i.test(e.message)) return true;
  return false;
}

export async function timedFetch(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 25000, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  let externalAbort: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalAbort = () => controller.abort();
      externalSignal.addEventListener("abort", externalAbort);
    }
  }
  try {
    const res = await fetch(input, { ...rest, signal: controller.signal });
    return res;
  } catch (err) {
    if (isNetworkFailure(err)) {
      notifyNetworkFailure();
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
    if (externalSignal && externalAbort) {
      externalSignal.removeEventListener("abort", externalAbort);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  const res = await timedFetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    timeoutMs: options.timeoutMs ?? 25000,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  timeoutMs?: number;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, timeoutMs }) =>
  async ({ queryKey }) => {
    const res = await timedFetch(queryKey.join("/") as string, {
      credentials: "include",
      timeoutMs: timeoutMs ?? 25000,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
