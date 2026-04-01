import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

const PLATE_METHOD_TIP_KEY = "Use the plate method (½ veggies, ¼ protein, ¼ carbs)";
const FOOD_SWITCH_TIP_KEY = "Food Switch";

const TIP_DETAIL_KEY_MAP: Record<string, string | null> = {
  "Dilute juice 1:1 with water": "diet_tip.dilute_juice_desc",
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

const FOOD_SWITCH_TABS = [
  { key: "legumes",      labelKey: "food_switch_popup.tab2_title", contentKey: "food_switch_popup.tab2" },
  { key: "vegetables",   labelKey: "food_switch_popup.tab3_title", contentKey: "food_switch_popup.tab3" },
  { key: "whole_grains", labelKey: "food_switch_popup.tab4_title", contentKey: "food_switch_popup.tab4" },
];

function PlateMethodDetail({ t }: { t: (key: string, opts?: any) => string }) {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
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
    <div className="space-y-3 text-sm text-muted-foreground">
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

interface DietTipRowProps {
  tipKey: string;
  tipLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  t: (key: string, opts?: any) => string;
}

function DietTipRow({ tipKey, tipLabel, isOpen, onToggle, t }: DietTipRowProps) {
  const safeId = tipKey.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  let detailContent: React.ReactNode;
  if (tipKey === PLATE_METHOD_TIP_KEY) {
    detailContent = <PlateMethodDetail t={t} />;
  } else if (tipKey === FOOD_SWITCH_TIP_KEY) {
    detailContent = <FoodSwitchDetail t={t} />;
  } else {
    const detailKey = TIP_DETAIL_KEY_MAP[tipKey];
    detailContent = (
      <p className="text-sm text-muted-foreground">
        {detailKey ? t(detailKey) : t("health_info.tip_no_detail")}
      </p>
    );
  }

  return (
    <div
      className="border border-border rounded-lg overflow-hidden bg-card cursor-pointer hover:border-primary/50 transition-colors"
      data-testid={`row-diet-tip-${safeId}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="text-sm font-medium">{tipLabel}</span>
        <div
          className="ml-2 shrink-0 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          data-testid={`chevron-diet-tip-${safeId}`}
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      {isOpen && (
        <div className="px-3 pb-3" data-testid={`detail-diet-tip-${safeId}`}>
          {detailContent}
        </div>
      )}
    </div>
  );
}

export default function HealthInfo() {
  const { t } = useTranslation();
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ activeTips: string[] }>({
    queryKey: ["/api/health-info/diet-tips"],
  });

  const activeTips = data?.activeTips ?? [];

  function handleToggle(tip: string) {
    setExpandedTip(prev => (prev === tip ? null : tip));
  }

  return (
    <div className="max-w-sm sm:max-w-none mx-auto px-4 pt-6 pb-32" data-testid="page-health-info">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-xl font-semibold" data-testid="text-health-info-title">
          {t("health_info.title")}
        </h1>
      </div>

      <section data-testid="section-diet-advice">
        <h2 className="text-base font-semibold mb-3" data-testid="text-diet-advice-heading">
          {t("health_info.diet_advice_heading")}
        </h2>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-14 bg-muted rounded-lg" />
            <div className="h-14 bg-muted rounded-lg" />
          </div>
        ) : activeTips.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-muted-foreground"
            data-testid="text-no-diet-advice"
          >
            {t("health_info.no_advice_yet")}
          </motion.p>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {activeTips.map(tip => {
              const i18nKey = DIET_TIP_I18N_KEYS[tip];
              const label = i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
              return (
                <DietTipRow
                  key={tip}
                  tipKey={tip}
                  tipLabel={label}
                  isOpen={expandedTip === tip}
                  onToggle={() => handleToggle(tip)}
                  t={t}
                />
              );
            })}
          </motion.div>
        )}
      </section>
    </div>
  );
}
