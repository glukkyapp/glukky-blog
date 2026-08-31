import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwipeableFoodCard } from "@/components/SwipeableFoodCard";

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
  const [foodIndex, setFoodIndex] = useState(0);
  const { data, isLoading } = useQuery<FoodFrequencySummary>({
    queryKey: ["/api/snap/food-frequency"],
    queryFn: async () => {
      const response = await fetch("/api/snap/food-frequency", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load recurring foods");
      return response.json();
    },
  });

  const language = i18n.language;
  const displayName = (food: FoodFrequencyFood) =>
    language === "yue" ? food.nameYue : language.startsWith("zh") ? food.nameZhHant : food.nameEn;
  const topFoods = data?.foods?.filter(food => food.mealCount > 1).slice(0, 5) ?? [];
  const activeIndex = Math.min(foodIndex, Math.max(0, topFoods.length - 1));
  const activeFood = topFoods[activeIndex];

  useEffect(() => {
    setFoodIndex(0);
  }, [topFoods.length]);

  if (isLoading || !data?.eligible) return null;

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
          <div aria-label={t("food_frequency.title")}>
            <SwipeableFoodCard
              index={activeIndex}
              total={topFoods.length}
              onPrevious={() => setFoodIndex(current => Math.max(0, current - 1))}
              onNext={() => setFoodIndex(current => Math.min(topFoods.length - 1, current + 1))}
              nextCard={activeIndex < topFoods.length - 1 ? (
                <Card className="glucose-pattern-card border-[#DCE9D7] bg-[#F8FBF5]">
                  <CardContent className="flex items-center justify-between gap-3 px-3 py-3">
                    <span className="truncate text-sm font-medium text-[#214B36]">{displayName(topFoods[activeIndex + 1])}</span>
                    <span className="shrink-0 text-xs text-[#6E8477]">
                      {t("food_frequency.meals", { count: topFoods[activeIndex + 1].mealCount })}
                    </span>
                  </CardContent>
                </Card>
              ) : undefined}
            >
              <Card
                className="glucose-pattern-card is-active border-[#DCE9D7] bg-[#F8FBF5]"
                data-testid="recurring-food-card"
              >
                <CardContent className="flex items-center justify-between gap-3 px-3 py-3">
                  <span className="truncate text-sm font-medium text-[#214B36]">{displayName(activeFood)}</span>
                  <span className="shrink-0 text-xs text-[#6E8477]">
                    {t("food_frequency.meals", { count: activeFood.mealCount })}
                  </span>
                </CardContent>
              </Card>
            </SwipeableFoodCard>
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