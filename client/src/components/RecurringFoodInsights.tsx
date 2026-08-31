import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FoodFrequencySummary = {
  totalMeals: number;
  eligible: boolean;
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
  if (categories.length === 0) return null;

  const highestMealCount = categories[0].mealCount;
  const categoryLabels = categories
    .filter(category => category.mealCount === highestMealCount)
    .map(category => t(`food_frequency.${category.key}`));
  const joinedCategories = language.startsWith("zh") || language === "yue"
    ? categoryLabels.join("、")
    : categoryLabels.length <= 1
      ? categoryLabels.join("")
      : categoryLabels.length === 2
        ? categoryLabels.join(" and ")
        : `${categoryLabels.slice(0, -1).join(", ")}, and ${categoryLabels[categoryLabels.length - 1]}`;

  return (
    <Card className="mb-5 border-[#DCE9D7] bg-[#F8FBF5]" data-testid="card-recurring-foods">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base text-[#214B36]">
          {t("food_frequency.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-sm text-[#355C43]" data-testid="food-frequency-favourite-category">
          {t("food_frequency.favourite_category", { categories: joinedCategories })}
        </p>
      </CardContent>
    </Card>
  );
}