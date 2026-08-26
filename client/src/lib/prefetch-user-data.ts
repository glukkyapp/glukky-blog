import { queryClient } from "@/lib/queryClient";

const PREFETCH_KEYS: (string | (string | number)[])[] = [
  "/api/profile",
  "/api/gate-status",
  "/api/piggybank",
];

let prefetchedForUser: string | null = null;

export function prefetchUserData(userId: string): void {
  if (prefetchedForUser === userId) return;
  prefetchedForUser = userId;

  const keys: (string | (string | number)[])[] = [
    ...PREFETCH_KEYS,
  ];

  for (const key of keys) {
    const queryKey = Array.isArray(key) ? key : [key];
    queryClient.prefetchQuery({ queryKey }).catch(() => {});
  }
}

export function resetPrefetchUserData(): void {
  prefetchedForUser = null;
}
