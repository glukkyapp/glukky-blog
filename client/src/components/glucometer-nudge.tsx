import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function GlucometerNudge() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ showNudge: boolean }>({
    queryKey: ["/api/snap/nudge-status"],
    queryFn: async () => {
      const res = await fetch("/api/snap/nudge-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (data?.showNudge) setOpen(true);
  }, [data?.showNudge]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid="dialog-glucometer-nudge">
        <DialogHeader>
          <DialogTitle>{t("glucose.nudge_title")}</DialogTitle>
          <DialogDescription>{t("glucose.nudge_body")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button
            onClick={() => {
              setOpen(false);
              setLocation("/health-info");
            }}
            data-testid="button-glucometer-nudge-learn"
          >
            {t("glucose.nudge_learn")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-glucometer-nudge-skip"
          >
            {t("glucose.nudge_skip")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
