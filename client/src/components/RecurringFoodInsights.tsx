import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FoodFrequencyFood = {
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
  mealCount: number;
  sweetCategory: "sweet_drink" | "sweet_food" | null;
};

type FoodFrequencySummary = {
  totalMeals: number;
  eligible: boolean;
  foods: FoodFrequencyFood[];
  sweetSubtypes: Array<{ sweetCategory: "sweet_drink" | "sweet_food"; mealCount: number }>;
};

export function RecurringFoodInsights() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery<FoodFrequencySummary>({
    queryKey: ["/api/snap/food-frequency"],
    queryFn: async () => {
      const response = await fetch("/api/snap/food-frequency", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load recurring foods");
      return response.json();
    },
  });

  if (isLoading || !data?.eligible) return null;

  const language = i18n.language;
  const displayName = (food: FoodFrequencyFood) =>
    language === "yue" ? food.nameYue : language.startsWith("zh") ? food.nameZhHant : food.nameEn;
  const recurringFoods = data.foods.filter(food => food.mealCount > 1).slice(0, 5);

  return (
    <Card className="mb-5 border-[#DCE9D7] bg-[#F8FBF5]" data-testid="card-recurring-foods">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base text-[#214B36]">
          {t("food_frequency.title")}
        </CardTitle>
        <p className="text-xs text-[#6E8477]">
          {t("food_frequency.based_on", { count: data.totalMeals })}
        </p>
      </CardHeader>
      <CardContent className="pb-4">
        {recurringFoods.length > 0 ? (
          <div className="space-y-2" aria-label={t("food_frequency.title")}>
            {recurringFoods.map(food => (
              <div
                key={`${food.nameEn}-${food.nameZhHant}-${food.nameYue}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5"
                data-testid="recurring-food-row"
              >
                <span className="truncate text-sm font-medium text-[#214B36]">{displayName(food)}</span>
                <span className="shrink-0 text-xs text-[#6E8477]">
                  {t("food_frequency.meals", { count: food.mealCount })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6E8477]">{t("food_frequency.no_repeats")}</p>
        )}
        {data.sweetSubtypes.length > 0 && (
          <div className="mt-3 border-t border-[#DCE9D7] pt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-[#6E8477]">
              {t("food_frequency.subtypes_heading")}
            </p>
            <p className="text-sm text-[#355C43]">
              {data.sweetSubtypes.map(subtype =>
                t(`food_frequency.${subtype.sweetCategory}`, { count: subtype.mealCount })
              ).join(" · ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}