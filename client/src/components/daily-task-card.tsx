import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Footprints, Droplets, Salad, Clock3, CircleHelp } from "lucide-react";

const LABEL_KEYS: Record<string, string> = {
  post_meal_walk: "home.daily_task_post_meal_walk",
  unsweetened_drink: "home.daily_task_unsweetened_drink",
  vegetable_dish: "home.daily_task_vegetable_dish",
  regular_mealtime: "home.daily_task_regular_mealtime",
};
const TASK_ICONS = { post_meal_walk: Footprints, unsweetened_drink: Droplets, vegetable_dish: Salad, regular_mealtime: Clock3 };

type DailyTaskState = {
  localDate: string;
  tasks: string[];
  completedTaskId: string | null;
};

export function DailyTaskCard() {
  const { t } = useTranslation();
  const { data } = useQuery<DailyTaskState>({
    queryKey: ["/api/daily-task"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: (taskId: string) => apiRequest("POST", "/api/daily-task", { taskId }),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/daily-task"] });
      const previous = queryClient.getQueryData<DailyTaskState>(["/api/daily-task"]);
      queryClient.setQueryData<DailyTaskState>(["/api/daily-task"], (current) =>
        current ? { ...current, completedTaskId: taskId } : current
      );
      return { previous };
    },
    onError: (_error, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/daily-task"], context.previous);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/daily-task"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/piggybank"] }),
      ]);
    },
  });

  if (!data) return null;
  const visibleTasks = data.completedTaskId ? [data.completedTaskId] : data.tasks;

  return (
    <div
      className="rounded-2xl border bg-card px-4 py-3 space-y-2"
      data-testid="daily-task-card"
    >
      {visibleTasks.map((taskId) => {
        const completed = data.completedTaskId === taskId;
        return (
          <label
            key={taskId}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 ${
              completed ? "border-primary/30 bg-primary/5" : "border-card-border bg-card"
            }`}
            data-testid={`daily-task-${taskId}`}
          >
            <Checkbox checked={completed} disabled={Boolean(data.completedTaskId) || mutation.isPending}
              onCheckedChange={(checked) => checked && mutation.mutate(taskId)}
              aria-label={t(LABEL_KEYS[taskId] ?? taskId)} />
            {(() => { const Icon = TASK_ICONS[taskId as keyof typeof TASK_ICONS] ?? CircleHelp; return <Icon size={22} strokeWidth={completed ? 2.5 : 2} className={completed ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />; })()}
            <span className="text-sm" style={{ color: "var(--brand-ink)" }}>
              {t(LABEL_KEYS[taskId] ?? taskId)}
            </span>
          </label>
        );
      })}
      {data.completedTaskId && (
        <p className="text-sm font-semibold text-emerald-700" role="status">
          {t("home.daily_task_good_job")}
        </p>
      )}
    </div>
  );
}