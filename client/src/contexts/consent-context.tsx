import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

export type ConsentService = "posthog" | "onesignal" | "revenuecat" | "claude";

export type ConsentState = Record<ConsentService, boolean>;

const ALL_SERVICES: ConsentService[] = ["posthog", "onesignal", "revenuecat", "claude"];

const DEFAULT_STATE: ConsentState = {
  posthog: false,
  onesignal: false,
  revenuecat: false,
  claude: false,
};

interface ConsentContextValue {
  consentState: ConsentState;
  updateConsent: (service: ConsentService, value: boolean) => Promise<void>;
  bulkUpdateConsent: (decisions: Record<ConsentService, boolean>) => Promise<void>;
  isConsentLoaded: boolean;
  hasSubmittedConsent: boolean;
}

const ConsentContext = createContext<ConsentContextValue>({
  consentState: DEFAULT_STATE,
  updateConsent: async () => {},
  bulkUpdateConsent: async () => {},
  isConsentLoaded: false,
  hasSubmittedConsent: false,
});

export function useConsent(): ConsentContextValue {
  return useContext(ConsentContext);
}

interface ConsentProviderProps {
  children: ReactNode;
}

export function ConsentProvider({ children }: ConsentProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !authLoading && !!user;

  const [consentState, setConsentState] = useState<ConsentState>(DEFAULT_STATE);
  const [isConsentLoaded, setIsConsentLoaded] = useState(false);
  const [hasSubmittedConsent, setHasSubmittedConsent] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setConsentState(DEFAULT_STATE);
      setIsConsentLoaded(false);
      setHasSubmittedConsent(false);
      return;
    }
    let cancelled = false;
    fetch("/api/user/consent", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("consent fetch failed");
        return res.json();
      })
      .then((data: { consents: Record<string, boolean>; hasSubmitted: boolean }) => {
        if (cancelled) return;
        const next: ConsentState = { ...DEFAULT_STATE };
        for (const svc of ALL_SERVICES) {
          if (svc in data.consents) next[svc] = data.consents[svc];
        }
        setConsentState(next);
        setHasSubmittedConsent(data.hasSubmitted ?? false);
      })
      .catch(() => {
        if (!cancelled) {
          setConsentState(DEFAULT_STATE);
          setHasSubmittedConsent(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsConsentLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const updateConsent = async (service: ConsentService, value: boolean): Promise<void> => {
    setConsentState((prev) => ({ ...prev, [service]: value }));
    if (!hasSubmittedConsent) setHasSubmittedConsent(true);
    await apiRequest("POST", "/api/user/consent", [{ service, consented: value }]);
  };

  const bulkUpdateConsent = async (decisions: Record<ConsentService, boolean>): Promise<void> => {
    setConsentState({ ...decisions });
    setHasSubmittedConsent(true);
    const payload = (Object.entries(decisions) as [ConsentService, boolean][]).map(([service, consented]) => ({
      service,
      consented,
    }));
    await apiRequest("POST", "/api/user/consent", payload);
  };

  return (
    <ConsentContext.Provider value={{ consentState, updateConsent, bulkUpdateConsent, isConsentLoaded, hasSubmittedConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}
