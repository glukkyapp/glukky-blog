import { queryClient } from "@/lib/queryClient";

const TODAY_LOCAL = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const PREFETCH_KEYS: (string | (string | number)[])[] = [
  "/api/profile",
  "/api/plan/current",
  "/api/gate-status",
  "/api/roadmap",
  "/api/piggybank",
  "/api/health-info/diet-tips",
];

let prefetchedForUser: string | null = null;

export function prefetchUserData(userId: string): void {
  if (prefetchedForUser === userId) return;
  prefetchedForUser = userId;

  const keys: (string | (string | number)[])[] = [
    ...PREFETCH_KEYS,
    ["/api/log", TODAY_LOCAL()],
  ];

  for (const key of keys) {
    const queryKey = Array.isArray(key) ? key : [key];
    queryClient.prefetchQuery({ queryKey }).catch(() => {});
  }
}

export function resetPrefetchUserData(): void {
  prefetchedForUser = null;
}
