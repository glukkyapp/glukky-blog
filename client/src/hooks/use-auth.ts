import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { endOneSignalSession, releaseOneSignalIdentity } from "@/lib/onesignal-identity";

interface AuthUser {
  id: string;
  email: string | null;
}

export const SESSION_HINT_KEY = "glukky_has_session";

async function fetchUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    await releaseOneSignalIdentity("auth_401");
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  // Keep the cold-launch session hint in sync with the verified auth
  // state. The cube loading screen reads this hint synchronously at
  // boot to decide whether to show.
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      localStorage.setItem(SESSION_HINT_KEY, "1");
    } else {
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  }, [user, isLoading]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await endOneSignalSession("logout_mutation", async () => {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      });
    },
    onSuccess: () => {
      localStorage.removeItem(SESSION_HINT_KEY);
      queryClient.clear();
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
