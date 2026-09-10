import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";

const LABEL_KEYS: Record<string, string> = {
  post_meal_walk: "home.daily_task_post_meal_walk",
  unsweetened_drink: "home.daily_task_unsweetened_drink",
  vegetable_dish: "home.daily_task_vegetable_dish",
  regular_mealtime: "home.daily_task_regular_mealtime",
};

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
    <section
      className="rounded-2xl border bg-card px-4 py-3 space-y-2"
      aria-label={t("home.daily_tasks_heading")}
      data-testid="daily-task-card"
    >
      <h2 className="font-semibold" style={{ color: "var(--brand-ink)" }}>
        {t("home.daily_tasks_heading")}
      </h2>
      {visibleTasks.map((taskId) => {
        const completed = data.completedTaskId === taskId;
        return (
          <label
            key={taskId}
            className="flex items-center gap-3 rounded-xl px-1 py-1.5"
            data-testid={`daily-task-${taskId}`}
          >
            <Checkbox
              checked={completed}
              disabled={Boolean(data.completedTaskId) || mutation.isPending}
              onCheckedChange={(checked) => checked && mutation.mutate(taskId)}
              aria-label={t(LABEL_KEYS[taskId] ?? taskId)}
            />
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
    </section>
  );
}