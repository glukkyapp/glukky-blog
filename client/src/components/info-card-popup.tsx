import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function useInfoCard(id: string) {
  const key = `glukky_card_${id}_seen`;
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    localStorage.setItem(key, "true");
    setVisible(false);
  }, [key]);

  return { visible, trigger, dismiss };
}

interface InfoCardPopupProps {
  visible: boolean;
  onDismiss: () => void;
  icon: React.ElementType;
  titleKey: string;
  panelKeys: string[];
  testId?: string;
}

export function InfoCardPopup({
  visible,
  onDismiss,
  icon: Icon,
  titleKey,
  panelKeys,
  testId,
}: InfoCardPopupProps) {
  const { t } = useTranslation();
  const [panelIndex, setPanelIndex] = useState(0);

  useEffect(() => {
    if (visible) setPanelIndex(0);
  }, [visible]);

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl p-0 overflow-hidden"
        data-testid={testId || "dialog-info-card"}
      >
        <div className="flex flex-col items-center gap-4 p-6 pb-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <Icon className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-base font-semibold text-center leading-snug" data-testid="text-info-card-title">
            {t(titleKey)}
          </h2>

          <p
            className="text-sm text-center text-muted-foreground leading-relaxed min-h-[56px]"
            data-testid="text-info-card-panel"
          >
            {t(panelKeys[panelIndex])}
          </p>

          {panelKeys.length > 1 && (
            <div className="flex items-center gap-2" data-testid="nav-info-card-dots">
              {panelKeys.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPanelIndex(i)}
                  data-testid={`dot-info-card-${i}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === panelIndex
                      ? "bg-primary"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Panel ${i + 1}`}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2 w-full pt-1">
            {panelIndex < panelKeys.length - 1 ? (
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setPanelIndex((p) => p + 1)}
                data-testid="button-info-card-next"
              >
                {t("info_card.next")}
              </Button>
            ) : null}
            <Button
              className="flex-1"
              onClick={onDismiss}
              data-testid="button-info-card-got-it"
            >
              {t("info_card.got_it")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
