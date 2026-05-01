import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PaywallExitWarningProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export default function PaywallExitWarning({ open, onStay, onLeave }: PaywallExitWarningProps) {
  const { t } = useTranslation();
  const actionTakenRef = useRef<"stay" | "leave" | null>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          actionTakenRef.current = null;
          return;
        }
        if (!open) return;
        const action = actionTakenRef.current;
        actionTakenRef.current = null;
        if (action !== null) return;
        onLeave();
      }}
    >
      <AlertDialogContent data-testid="dialog-paywall-exit-warning">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="text-paywall-exit-warning-title">
            {t("paywall.exit_warning_title")}
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="text-paywall-exit-warning-body">
            {t("paywall.exit_warning_body")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              actionTakenRef.current = "leave";
              onLeave();
            }}
            data-testid="button-paywall-exit-warning-leave"
          >
            {t("paywall.exit_warning_leave")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              actionTakenRef.current = "stay";
              onStay();
            }}
            data-testid="button-paywall-exit-warning-stay"
          >
            {t("paywall.exit_warning_stay")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
