import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UtensilsCrossed, Candy } from "lucide-react";

export type AutoFocusPopupType = "no_struggles_eat_out" | "eat_out_no_days";

export function useAutoFocusPopup() {
  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<AutoFocusPopupType | null>(null);
  const [nextFocusName, setNextFocusName] = useState<string>("");
  const seenRef = useRef<Set<AutoFocusPopupType>>(new Set());

  const trigger = useCallback((popupType: AutoFocusPopupType, focusName?: string) => {
    if (seenRef.current.has(popupType)) return;
    setType(popupType);
    setNextFocusName(focusName || "");
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setType(prev => {
      if (prev) seenRef.current.add(prev);
      return prev;
    });
    setVisible(false);
  }, []);

  return { visible, type, nextFocusName, trigger, dismiss };
}

interface AutoFocusPopupProps {
  visible: boolean;
  type: AutoFocusPopupType | null;
  nextFocusName: string;
  onDismiss: () => void;
}

export function AutoFocusPopup({ visible, type, nextFocusName, onDismiss }: AutoFocusPopupProps) {
  const { t } = useTranslation();

  if (!type) return null;

  const isNoStruggle = type === "no_struggles_eat_out";
  const Icon = isNoStruggle ? UtensilsCrossed : Candy;
  const iconBg = isNoStruggle
    ? "bg-orange-100 dark:bg-orange-950/40"
    : "bg-amber-100 dark:bg-amber-950/40";
  const iconColor = isNoStruggle ? "text-orange-500" : "text-amber-500";

  const title = t(`auto_focus_popup.${type}_title`);
  const body = type === "eat_out_no_days"
    ? t("auto_focus_popup.eat_out_no_days_body", { name: nextFocusName })
    : t("auto_focus_popup.no_struggles_eat_out_body");

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl p-0 overflow-hidden"
        aria-describedby={undefined}
        data-testid={`dialog-auto-focus-popup-${type}`}
      >
        <div className="flex flex-col items-center gap-4 p-6 pb-5">
          <div className={`flex items-center justify-center w-16 h-16 rounded-full ${iconBg}`}>
            <Icon className={`w-8 h-8 ${iconColor}`} />
          </div>

          <DialogTitle
            className="text-base font-semibold text-center leading-snug"
            data-testid={`text-auto-focus-title-${type}`}
          >
            {title}
          </DialogTitle>

          <p
            className="text-sm text-center text-muted-foreground leading-relaxed"
            data-testid={`text-auto-focus-body-${type}`}
          >
            {body}
          </p>

          <Button
            className="w-full mt-1"
            onClick={onDismiss}
            data-testid={`button-auto-focus-got-it-${type}`}
          >
            {t("info_card.got_it")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
