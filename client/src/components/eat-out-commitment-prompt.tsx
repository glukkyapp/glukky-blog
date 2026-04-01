import { useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag } from "lucide-react";

export function useEatOutCommitmentPrompt() {
  const [visible, setVisible] = useState(false);
  const seenRef = useRef(false);

  const trigger = useCallback(() => {
    if (seenRef.current) return;
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    seenRef.current = true;
    setVisible(false);
  }, []);

  return { visible, trigger, dismiss };
}

interface EatOutCommitmentPromptProps {
  visible: boolean;
  eatOutFocusWeeks: number;
  onYes: () => void;
  onNo: () => void;
  isPending?: boolean;
}

export function EatOutCommitmentPrompt({ visible, eatOutFocusWeeks, onYes, onNo, isPending }: EatOutCommitmentPromptProps) {
  const { t } = useTranslation();
  const weeksRemaining = (eatOutFocusWeeks === 1 || eatOutFocusWeeks === 4) ? 2 : 1;

  return (
    <Dialog open={visible} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl p-0 overflow-hidden"
        aria-describedby={undefined}
        data-testid="dialog-eat-out-commitment-prompt"
        onPointerDownOutside={e => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 p-6 pb-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40">
            <ShoppingBag className="w-8 h-8 text-orange-500" />
          </div>

          <DialogTitle
            className="text-base font-semibold text-center leading-snug"
            data-testid="text-eat-out-commitment-title"
          >
            {t("eat_out_commitment_prompt.title")}
          </DialogTitle>

          <p
            className="text-sm text-center text-muted-foreground leading-relaxed"
            data-testid="text-eat-out-commitment-body"
          >
            {t("eat_out_commitment_prompt.body", { weeks: weeksRemaining })}
          </p>

          <div className="flex flex-col gap-2 w-full mt-1">
            <Button
              className="w-full"
              onClick={onYes}
              disabled={isPending}
              data-testid="button-eat-out-commitment-yes"
            >
              {isPending ? "…" : t("eat_out_commitment_prompt.yes")}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onNo}
              disabled={isPending}
              data-testid="button-eat-out-commitment-no"
            >
              {t("eat_out_commitment_prompt.no")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
