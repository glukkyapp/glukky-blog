import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FoodFrequencyFood = {
  nameEn: string;
  nameZhHant: string;
  nameYue: string;
  mealCount: number;
};

type FoodFrequencySummary = {
  totalMeals: number;
  eligible: boolean;
  foods: FoodFrequencyFood[];
  sweetSubtypes: Array<{ sweetCategory: "sweet_drink" | "sweet_food"; mealCount: number }>;
  carbCategories: Array<{
    carbCategory: "rice" | "noodles" | "bread" | "potatoes" | "other";
    mealCount: number;
  }>;
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
  const topFoods = data.foods.filter(food => food.mealCount > 1).slice(0, 5);
  const categories = [
    ...data.sweetSubtypes.map(category => ({
      key: category.sweetCategory,
      mealCount: category.mealCount,
    })),
    ...(data.carbCategories ?? []).map(category => ({
      key: category.carbCategory,
      mealCount: category.mealCount,
    })),
  ].sort((a, b) => b.mealCount - a.mealCount || a.key.localeCompare(b.key));
  const favouriteCategory = categories.length > 0
    ? t(`food_frequency.${categories[0].key}`)
    : null;
  if (topFoods.length === 0 && !favouriteCategory) return null;

  return (
    <>
      {topFoods.length > 0 && (
        <section className="mb-5" data-testid="card-recurring-foods">
          <h2 className="mb-3 text-base font-semibold text-[#214B36]">
            {t("food_frequency.title")}
          </h2>
          <div className="space-y-2" aria-label={t("food_frequency.title")}>
            {topFoods.map(food => (
              <Card
                key={`${food.nameEn}-${food.nameZhHant}-${food.nameYue}`}
                className="border-[#DCE9D7] bg-[#F8FBF5]"
                data-testid="recurring-food-card"
              >
                <CardContent className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="truncate text-sm font-medium text-[#214B36]">{displayName(food)}</span>
                  <span className="shrink-0 text-xs text-[#6E8477]">
                    {t("food_frequency.meals", { count: food.mealCount })}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      {favouriteCategory && (
        <Card className="mb-5 border-[#DCE9D7] bg-[#F8FBF5]" data-testid="card-favourite-category">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base text-[#214B36]">
              {t("food_frequency.favourite_category_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-[#355C43]" data-testid="food-frequency-favourite-category">
              {favouriteCategory}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}