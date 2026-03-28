import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UtensilsCrossed } from "lucide-react";

export function useEatOutNonFocusPopup(userId: number | undefined) {
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    if (!userId) return;
    const key = `eat_out_nonfocus_seen_${userId}`;
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [userId]);

  const dismiss = useCallback(() => {
    if (userId) {
      const key = `eat_out_nonfocus_seen_${userId}`;
      localStorage.setItem(key, "true");
    }
    setVisible(false);
  }, [userId]);

  return { visible, trigger, dismiss };
}

interface EatOutNonFocusPopupProps {
  visible: boolean;
  onDismiss: () => void;
}

export function EatOutNonFocusPopup({ visible, onDismiss }: EatOutNonFocusPopupProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl p-0 overflow-hidden"
        aria-describedby={undefined}
        data-testid="dialog-eat-out-nonfocus-popup"
      >
        <div className="flex flex-col items-center gap-4 p-6 pb-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40">
            <UtensilsCrossed className="w-8 h-8 text-orange-500" />
          </div>

          <DialogTitle className="text-base font-semibold text-center leading-snug" data-testid="text-eat-out-nonfocus-title">
            {t("eat_out_nonfocus_popup.title")}
          </DialogTitle>

          <p
            className="text-sm text-center text-muted-foreground leading-relaxed"
            data-testid="text-eat-out-nonfocus-body"
          >
            {t("eat_out_nonfocus_popup.body")}
          </p>

          <Button
            className="w-full mt-1"
            onClick={onDismiss}
            data-testid="button-eat-out-nonfocus-got-it"
          >
            {t("info_card.got_it")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
