import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { hapticTap } from "@/lib/haptics";

export interface InfoSheetConfig {
  title: string;
  body: React.ReactNode;
}

interface InfoSheetProps {
  open: boolean;
  onClose: () => void;
  config: InfoSheetConfig | null;
}

export function InfoSheet({ open, onClose, config }: InfoSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl pb-8"
        aria-describedby={undefined}
        data-testid="sheet-info"
      >
        <SheetHeader className="mb-4">
          <SheetTitle data-testid="text-info-sheet-title">
            {config?.title ?? ""}
          </SheetTitle>
        </SheetHeader>
        <div data-testid="content-info-sheet">
          {config?.body}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function useInfoSheet() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<InfoSheetConfig | null>(null);

  function openSheet(cfg: InfoSheetConfig) {
    hapticTap("SOFT");
    setConfig(cfg);
    setOpen(true);
  }

  function closeSheet() {
    hapticTap("SOFT");
    setOpen(false);
  }

  return { open, config, openSheet, closeSheet };
}
