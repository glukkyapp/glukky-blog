import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import glukkyLogo from "@assets/high-resolution-color-logo_1776593969022.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function readResetToken(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash).get("reset_token") || "";
}

export default function PasswordReset() {
  const { t } = useTranslation();
  const token = useMemo(readResetToken, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Strip the fragment before any later navigation or first-party error
    // handler can observe the full URL. The token remains only in React memory.
    if (window.location.hash) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError(t("password_reset.invalid_link"));
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError(t("password_reset.error_required"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("password_reset.error_mismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("password_reset.error_short"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.message || t("password_reset.invalid_link"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("landing.error_network"));
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <PageShell>
         <h1 className="text-xl font-semibold text-[var(--brand-ink)]">{t("password_reset.success_title")}</h1>
        <p className="text-sm text-muted-foreground text-center">{t("password_reset.success_body")}</p>
        <Button
          className="w-full text-white btn-pop"
           style={{ backgroundColor: "var(--brand-teal)", borderColor: "var(--brand-teal)" }}
          onClick={() => { window.location.assign("/?tab=login"); }}
          data-testid="button-reset-back-to-login"
        >
          {t("password_reset.back_to_login")}
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="text-center space-y-2">
         <h1 className="text-xl font-semibold text-[var(--brand-ink)]">{t("password_reset.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("password_reset.body")}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <input
          type="email"
          name="username"
          autoComplete="username"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          readOnly
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">{t("landing.password")}</Label>
          <Input
            id="reset-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            data-testid="input-reset-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm-password">{t("landing.confirm_password")}</Label>
          <Input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            data-testid="input-reset-confirm-password"
          />
        </div>
        {error && <p className="text-sm text-red-500" data-testid="text-reset-error">{error}</p>}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full text-white btn-pop"
           style={{ backgroundColor: "var(--brand-teal)", borderColor: "var(--brand-teal)" }}
          data-testid="button-reset-password"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("password_reset.submit")}
        </Button>
      </form>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-8 gap-6"
       style={{ backgroundColor: "var(--brand-cream)" }}
      data-testid="password-reset-page"
    >
      <img src={glukkyLogo} alt="Glukky" style={{ width: 240 }} />
      <div className="w-full max-w-sm flex flex-col items-center gap-5">{children}</div>
    </main>
  );
}