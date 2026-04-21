import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import enLocale from "@client/locales/en.json";
import PaywallModal from "@client/components/paywall-modal";

const FAKE_PRICE_STRING = "HK$28.00";

class FakeNativelyPurchases {
  purchasePackage(_id: string, cb: (r: { cancelled?: boolean; error?: string }) => void) {
    cb({ cancelled: true });
  }
  restorePurchases(cb: (r: { error?: string }) => void) {
    cb({ error: "no_subscription" });
  }
  getCustomerInfo(cb: (r: null) => void) {
    cb(null);
  }
  getOfferings(cb: (r: { current: { monthly: { product: { priceString: string } } } }) => void) {
    cb({ current: { monthly: { product: { priceString: FAKE_PRICE_STRING } } } });
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { NativelyPurchases?: unknown }).NativelyPurchases =
    FakeNativelyPurchases as unknown as typeof window.NativelyPurchases;
}

const i18n = i18next.createInstance();
void i18n.init({
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: { en: { translation: enLocale } },
});

export default function PaywallScreen() {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (!ready) {
      void i18n.init().then(() => setReady(true));
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <div
      className="glukky-paywall-frame relative overflow-hidden"
      style={{
        width: 390,
        height: 844,
        fontFamily: "'Karla', 'Inter', system-ui, -apple-system, sans-serif",
        // Production theme variables (mirrored from client/src/index.css :root)
        ["--background" as string]: "23 36% 93%",
        ["--foreground" as string]: "168 30% 12%",
        ["--border" as string]: "160 15% 85%",
        ["--card" as string]: "0 0% 100%",
        ["--card-foreground" as string]: "168 30% 12%",
        ["--popover" as string]: "0 0% 100%",
        ["--popover-foreground" as string]: "168 30% 12%",
        ["--primary" as string]: "166 48% 35%",
        ["--primary-foreground" as string]: "0 0% 100%",
        ["--secondary" as string]: "150 18% 90%",
        ["--secondary-foreground" as string]: "168 30% 15%",
        ["--muted" as string]: "150 15% 92%",
        ["--muted-foreground" as string]: "168 10% 45%",
        ["--accent" as string]: "38 78% 56%",
        ["--accent-foreground" as string]: "30 60% 15%",
        ["--destructive" as string]: "0 65% 55%",
        ["--destructive-foreground" as string]: "0 0% 100%",
        ["--input" as string]: "160 15% 82%",
        ["--ring" as string]: "166 48% 35%",
        ["--radius" as string]: ".5rem",
        backgroundColor: "hsl(23 36% 93%)",
      }}
    >
      {/* Scope the modal's position:fixed to this 390x844 frame */}
      <style>{`
        .glukky-paywall-frame [data-testid="paywall-modal"] {
          position: absolute !important;
          inset: 0 !important;
        }
      `}</style>
      <I18nextProvider i18n={i18n}>
        <PaywallModal
          open={true}
          onClose={() => {}}
          onPurchaseSuccess={() => {}}
        />
      </I18nextProvider>
    </div>
  );
}
