import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Salad } from "lucide-react";
import { hapticTap } from "@/lib/haptics";

const FOOD_SWITCH_SEEN_KEY = "food_switch_seen";

export function useFoodSwitchPopup() {
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    if (!localStorage.getItem(FOOD_SWITCH_SEEN_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(FOOD_SWITCH_SEEN_KEY, "true");
    setVisible(false);
  }, []);

  return { visible, trigger, dismiss };
}

interface FoodSwitchPopupProps {
  visible: boolean;
  onDismiss: () => void;
}

const TAB_KEYS = [
  "food_switch_popup.tab1",
  "food_switch_popup.tab2",
  "food_switch_popup.tab3",
  "food_switch_popup.tab4",
  "food_switch_popup.tab5",
];

const TAB_TITLE_KEYS = [
  "food_switch_popup.tab1_title",
  "food_switch_popup.tab2_title",
  "food_switch_popup.tab3_title",
  "food_switch_popup.tab4_title",
  "food_switch_popup.tab5_title",
];

export function FoodSwitchPopup({ visible, onDismiss }: FoodSwitchPopupProps) {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    if (visible) setTabIndex(0);
  }, [visible]);

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl p-0 overflow-hidden"
        aria-describedby={undefined}
        data-testid="dialog-food-switch-popup"
      >
        <div className="flex flex-col items-center gap-4 p-6 pb-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <Salad className="w-8 h-8 text-primary" />
          </div>

          <DialogTitle className="text-base font-semibold text-center leading-snug" data-testid="text-food-switch-tab-title">
            {t(TAB_TITLE_KEYS[tabIndex])}
          </DialogTitle>

          <p
            className="text-sm text-center text-muted-foreground leading-relaxed min-h-[56px]"
            data-testid="text-food-switch-tab-body"
          >
            {t(TAB_KEYS[tabIndex])}
          </p>

          <div className="flex items-center gap-2" data-testid="nav-food-switch-dots">
            {TAB_KEYS.map((_, i) => (
              <button
                key={i}
                onClick={() => setTabIndex(i)}
                data-testid={`dot-food-switch-${i}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === tabIndex
                    ? "bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Tab ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-2 w-full pt-1">
            {tabIndex < TAB_KEYS.length - 1 ? (
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setTabIndex((p) => p + 1)}
                data-testid="button-food-switch-next"
              >
                {t("info_card.next")}
              </Button>
            ) : null}
            <Button
              className="flex-1"
              onClick={() => { hapticTap("LIGHT"); onDismiss(); }}
              data-testid="button-food-switch-got-it"
            >
              {t("info_card.got_it")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
