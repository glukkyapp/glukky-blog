import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, Lightbulb } from "lucide-react";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";
import { InfoSheet, useInfoSheet } from "@/components/info-sheet";

const PLATE_METHOD_TIP_KEY = "Use the plate method (½ veggies, ¼ protein, ¼ carbs)";
const FOOD_SWITCH_TIP_KEY = "Switch to edamame or nuts";
const FOOD_SWITCH_TIP_KEY2 = "Food Switch";

const TIP_DETAIL_KEY_MAP: Record<string, string | null> = {
  "Dilute juice 1:1 with water": "health_info.tip_detail_dilute_juice",
  "Swap dessert for plain yogurt + berries": "health_info.tip_detail_swap_dessert",
  "Steam your food first, then sear briefly": "health_info.tip_detail_steam_then_sear",
  "Choose grilled over fried": "health_info.tip_detail_grilled_over_fried",
  "Decouple (eat at home first, socialize out)": "health_info.tip_detail_decouple",
  "Share main dishes": "health_info.tip_detail_share_mains",
  "Swap sides for vegetables": "health_info.tip_detail_swap_sides_veggies",
  "Use the plate method (½ veggies, ¼ protein, ¼ carbs)": null,
  "Kitchen Closure after dinner": "health_info.tip_detail_kitchen_closure",
  "Switch to edamame or nuts": null,
  "Food Switch": "health_info.tip_detail_food_switch",
};

const FOOD_SWITCH_TABS = [
  { key: "edamame", labelKey: "health_info.food_switch_tab_edamame" },
  { key: "nuts", labelKey: "health_info.food_switch_tab_nuts" },
  { key: "why", labelKey: "health_info.food_switch_tab_why" },
  { key: "when", labelKey: "health_info.food_switch_tab_when" },
  { key: "tip", labelKey: "health_info.food_switch_tab_tip" },
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

  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>{t("health_info.food_switch_desc")}</p>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {FOOD_SWITCH_TABS.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(i)}
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
      <p className="leading-relaxed" data-testid={`text-food-switch-content-${FOOD_SWITCH_TABS[activeTab].key}`}>
        {t(`health_info.food_switch_content_${FOOD_SWITCH_TABS[activeTab].key}`)}
      </p>
    </div>
  );
}

interface DietTipRowProps {
  tipKey: string;
  tipLabel: string;
  onInfo: () => void;
}

function DietTipRow({ tipKey, tipLabel, onInfo }: DietTipRowProps) {
  const safeId = tipKey.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return (
    <div
      className="border border-border rounded-xl overflow-hidden bg-card"
      data-testid={`row-diet-tip-${safeId}`}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="text-sm font-medium">{tipLabel}</span>
        <button
          onClick={onInfo}
          className="shrink-0 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          data-testid={`button-info-diet-tip-${safeId}`}
          aria-label={tipLabel}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function HealthInfo() {
  const { t } = useTranslation();
  const sheet = useInfoSheet();

  const { data, isLoading } = useQuery<{ activeTips: string[] }>({
    queryKey: ["/api/health-info/diet-tips"],
  });

  const activeTips = data?.activeTips ?? [];

  function openTipSheet(tipKey: string, tipLabel: string) {
    let body: React.ReactNode;
    if (tipKey === PLATE_METHOD_TIP_KEY) {
      body = <PlateMethodDetail t={t} />;
    } else if (tipKey === FOOD_SWITCH_TIP_KEY || tipKey === FOOD_SWITCH_TIP_KEY2) {
      body = <FoodSwitchDetail t={t} />;
    } else {
      const detailKey = TIP_DETAIL_KEY_MAP[tipKey];
      body = (
        <p className="text-sm text-muted-foreground">
          {detailKey ? t(detailKey) : t("health_info.tip_no_detail")}
        </p>
      );
    }

    sheet.openSheet({ title: tipLabel, body });
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
            <div className="h-14 bg-muted rounded-xl" />
            <div className="h-14 bg-muted rounded-xl" />
          </div>
        ) : activeTips.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-diet-advice">
            {t("health_info.no_advice_yet")}
          </p>
        ) : (
          <div className="space-y-3">
            {activeTips.map(tip => {
              const i18nKey = DIET_TIP_I18N_KEYS[tip];
              const label = i18nKey ? t(i18nKey, { defaultValue: tip }) : tip;
              return (
                <DietTipRow
                  key={tip}
                  tipKey={tip}
                  tipLabel={label}
                  onInfo={() => openTipSheet(tip, label)}
                />
              );
            })}
          </div>
        )}
      </section>

      <InfoSheet open={sheet.open} onClose={sheet.closeSheet} config={sheet.config} />
    </div>
  );
}
