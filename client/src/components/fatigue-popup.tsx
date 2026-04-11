import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { hapticTap, hapticNotify } from "@/lib/haptics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface FatiguePopupProps {
  dayOfWeek: number;
  onClose: () => void;
}

export function FatiguePopup({ dayOfWeek, onClose }: FatiguePopupProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const respondMutation = useMutation({
    mutationFn: async (accept: boolean) => {
      const res = await apiRequest("POST", "/api/fatigue/respond", {
        accept,
        dayOfWeek,
      });
      return res.json();
    },
    onSuccess: (_, accept) => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      if (accept) {
        toast({
          title: "Rest day set",
          description: `${DAY_NAMES[dayOfWeek]} is now your rest day`,
        });
      }
      setOpen(false);
      onClose();
    },
    onError: () => {
      hapticNotify("ERROR");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); onClose(); } }}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-fatigue-title">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Fatigue Insight Detected
          </DialogTitle>
          <DialogDescription data-testid="text-fatigue-description">
            {DAY_NAMES[dayOfWeek]}s marked "Tired" 3 out of 3 weeks.
            Would you like to set {DAY_NAMES[dayOfWeek]} as a permanent rest day?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => { hapticTap("MEDIUM"); respondMutation.mutate(true); }}
            disabled={respondMutation.isPending}
            data-testid="button-accept-rest-day"
          >
            Yes - Set Rest Day
          </Button>
          <Button
            variant="outline"
            onClick={() => { hapticTap("MEDIUM"); respondMutation.mutate(false); }}
            disabled={respondMutation.isPending}
            data-testid="button-reject-rest-day"
          >
            No - Continue Tracking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
