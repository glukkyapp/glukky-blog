import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

const PLATE_METHOD_TIP_KEY = "Use the plate method (½ veggies, ¼ protein, ¼ carbs)";
const FOOD_SWITCH_TIP_KEY = "Food Switch";

const TIP_DETAIL_KEY_MAP: Record<string, string | null> = {
  "Choose sugar-free drink / Dilute juice 1:1 with water": "diet_tip.dilute_juice_desc",
  "Swap dessert for plain yogurt + berries": "diet_tip.swap_dessert_desc",
  "Steam your food first, then sear briefly": "diet_tip.steam_then_sear_desc",
  "Choose grilled over fried": "diet_tip.grilled_over_fried_desc",
  "Decouple (eat at home first, socialize out)": "diet_tip.decouple_desc",
  "Share main dishes": "diet_tip.share_mains_desc",
  "Swap sides for vegetables": "diet_tip.swap_sides_veggies_desc",
  "Use the plate method (½ veggies, ¼ protein, ¼ carbs)": null,
  "Kitchen Closure after dinner": "diet_tip.kitchen_closure_desc",
  "Switch to edamame or nuts": "diet_tip.switch_edamame_nuts_desc",
  "Food Switch": null,
};

const TIP_GRADIENTS: Record<string, string> = {
  "Choose sugar-free drink / Dilute juice 1:1 with water": "from-sky-200 to-cyan-300",
  "Swap dessert for plain yogurt + berries": "from-pink-200 to-rose-300",
  "Steam your food first, then sear briefly": "from-orange-200 to-amber-300",
  "Choose grilled over fried": "from-red-200 to-orange-300",
  "Decouple (eat at home first, socialize out)": "from-violet-200 to-purple-300",
  "Share main dishes": "from-emerald-200 to-teal-300",
  "Swap sides for vegetables": "from-lime-200 to-green-300",
  "Use the plate method (½ veggies, ¼ protein, ¼ carbs)": "from-amber-200 to-yellow-300",
  "Kitchen Closure after dinner": "from-indigo-200 to-blue-300",
  "Switch to edamame or nuts": "from-teal-200 to-emerald-300",
  "Food Switch": "from-fuchsia-200 to-pink-300",
};

const FOOD_SWITCH_TABS = [
  { key: "legumes",      labelKey: "food_switch_popup.tab2_title", contentKey: "food_switch_popup.tab2" },
  { key: "vegetables",   labelKey: "food_switch_popup.tab3_title", contentKey: "food_switch_popup.tab3" },
  { key: "whole_grains", labelKey: "food_switch_popup.tab4_title", contentKey: "food_switch_popup.tab4" },
];

function PlateMethodDetail({ t }: { t: (key: string, opts?: any) => string }) {
  return (
    <div className="space-y-3 text-base text-muted-foreground">
      <p>{t("health_info.plate_method_desc")}</p>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="rounded-lg bg-green-100 dark:bg-green-950/40 p-3 flex flex-col items-center gap-1">
          <span className="text-green-700 dark:text-green-300 font-semibold text-base">½</span>
          <span className="text-green-700 dark:text-green-300 text-xs font-medium text-center">{t("health_info.plate_veggies")}</span>
        </div>
        <div className="rounded-lg bg-amber-100 dark:bg-amber-950/40 p-3 flex flex-col items-center gap-1">
          <span className="text-amber-700 dark:text-amber-300 font-semibold text-base">¼</span>
          <span className="text-amber-700 dark:text-amber-300 text-xs font-medium text-center">{t("health_info.plate_protein")}</span>
        </div>
        <div className="rounded-lg bg-blue-100 dark:bg-blue-950/40 p-3 flex flex-col items-center gap-1">
          <span className="text-blue-700 dark:text-blue-300 font-semibold text-base">¼</span>
          <span className="text-blue-700 dark:text-blue-300 text-xs font-medium text-center">{t("health_info.plate_carbs")}</span>
        </div>
      </div>
      <p>{t("health_info.plate_method_tip")}</p>
    </div>
  );
}

function FoodSwitchDetail({ t }: { t: (key: string, opts?: any) => string }) {
  const [activeTab, setActiveTab] = useState(0);
  const [direction, setDirection] = useState(1);

  function handleTabChange(i: number) {
    setDirection(i > activeTab ? 1 : -1);
    setActiveTab(i);
  }

  return (
    <div className="space-y-3 text-base text-muted-foreground">
      <p>{t("food_switch_popup.tab1")}</p>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {FOOD_SWITCH_TABS.map((tab, i) => (
          <button
            key={tab.key}
            onClick={(e) => { e.stopPropagation(); handleTabChange(i); }}
            data-testid={`tab-food-switch-${tab.key}`}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === i
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.p
            key={activeTab}
            custom={direction}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -20 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="leading-relaxed"
            data-testid={`text-food-switch-content-${FOOD_SWITCH_TABS[activeTab].key}`}
          >
            {t(FOOD_SWITCH_TABS[activeTab].contentKey)}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TipCircle({
  tipKey,
  label,
  isSelected,
  onSelect,
}: {
  tipKey: string;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const safeId = tipKey.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const gradient = TIP_GRADIENTS[tipKey] || "from-gray-200 to-gray-300";

  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-2 shrink-0 snap-start"
      data-testid={`circle-diet-tip-${safeId}`}
      style={{ width: "100px" }}
    >
      <div
        className={`w-[100px] h-[100px] rounded-full bg-gradient-to-br ${gradient} transition-all duration-200 ${
          isSelected
            ? "ring-2 ring-primary ring-offset-2 scale-105"
            : "hover:scale-105"
        }`}
      />
      <span
        className={`text-xs font-medium text-center leading-tight line-clamp-2 max-w-[100px] ${
          isSelected ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export default function HealthInfo() {
  const { t } = useTranslation();
  const [selectedTip, setSelectedTip] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ activeTips: string[] }>({
    queryKey: ["/api/health-info/diet-tips"],
  });

  const activeTips = data?.activeTips ?? [];

  function handleSelect(tip: string) {
    setSelectedTip(prev => (prev === tip ? null : tip));
  }

  function renderDetail(tipKey: string) {
    if (tipKey === PLATE_METHOD_TIP_KEY) {
      return <PlateMethodDetail t={t} />;
    }
    if (tipKey === FOOD_SWITCH_TIP_KEY) {
      return <FoodSwitchDetail t={t} />;
    }
    const detailKey = TIP_DETAIL_KEY_MAP[tipKey];
    return (
      <p className="text-base text-muted-foreground">
        {detailKey ? t(detailKey) : t("health_info.tip_no_detail")}
      </p>
    );
  }

  return (
    <div className="max-w-sm sm:max-w-none mx-auto px-4 pt-4 pb-32" data-testid="page-health-info">
      <div
        className="relative w-full h-44 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #a8b5a0 0%, #c2b9a7 50%, #d4cfc4 100%)",
        }}
        data-testid="hero-health-info"
      >
        <h1
          className="text-2xl font-bold text-white drop-shadow-md text-center px-6"
          data-testid="text-health-info-title"
        >
          {t("health_info.title")}
        </h1>
      </div>

      <p
        className="text-sm text-muted-foreground mb-6 px-1"
        data-testid="text-health-info-subtitle"
      >
        {t("health_info.subtitle")}
      </p>

      <section data-testid="section-diet-advice">
        <h2 className="text-base font-semibold mb-4" data-testid="text-diet-advice-heading">
          {t("health_info.diet_advice_heading")}
        </h2>

        {isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-pulse" style={{ width: "100px" }}>
                <div className="w-[100px] h-[100px] rounded-full bg-muted" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : activeTips.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="text-base text-muted-foreground"
            data-testid="text-no-diet-advice"
          >
            {t("health_info.no_advice_yet")}
          </motion.p>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1"
              style={{
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {activeTips.map(tip => {
                const i18nKey = DIET_TIP_I18N_KEYS[tip];
                const label = i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
                return (
                  <TipCircle
                    key={tip}
                    tipKey={tip}
                    label={label}
                    isSelected={selectedTip === tip}
                    onSelect={() => handleSelect(tip)}
                  />
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {selectedTip && (
                <motion.div
                  key={selectedTip}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 px-1"
                  data-testid={`detail-diet-tip-${selectedTip.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                >
                  {renderDetail(selectedTip)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
