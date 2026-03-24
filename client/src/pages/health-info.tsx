import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { DIET_TIP_I18N_KEYS } from "@shared/schema";

const PLATE_METHOD_TIP = "Use the plate method (½ veggies, ¼ protein, ¼ carbs)";
const FOOD_SWITCH_TIP = "Switch to edamame or nuts";

function PlateMethodDetail({ t }: { t: (key: string, opts?: any) => string }) {
  return (
    <div className="mt-3 space-y-3 text-sm text-muted-foreground">
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

const FOOD_SWITCH_TABS = [
  { key: "edamame", labelKey: "health_info.food_switch_tab_edamame" },
  { key: "nuts", labelKey: "health_info.food_switch_tab_nuts" },
  { key: "why", labelKey: "health_info.food_switch_tab_why" },
  { key: "when", labelKey: "health_info.food_switch_tab_when" },
  { key: "tip", labelKey: "health_info.food_switch_tab_tip" },
];

function FoodSwitchDetail({ t }: { t: (key: string, opts?: any) => string }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="mt-3 space-y-3 text-sm text-muted-foreground">
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

interface DietTipAccordionProps {
  tipKey: string;
  tipLabel: string;
  t: (key: string, opts?: any) => string;
}

function DietTipAccordion({ tipKey, tipLabel, t }: DietTipAccordionProps) {
  const [open, setOpen] = useState(false);

  const renderDetail = () => {
    if (tipKey === PLATE_METHOD_TIP) return <PlateMethodDetail t={t} />;
    if (tipKey === FOOD_SWITCH_TIP) return <FoodSwitchDetail t={t} />;
    return (
      <p className="mt-3 text-sm text-muted-foreground">{t("health_info.tip_no_detail")}</p>
    );
  };

  const safeId = tipKey.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return (
    <div
      className="border border-border rounded-xl overflow-hidden"
      data-testid={`accordion-diet-tip-${safeId}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left bg-card hover:bg-muted/50 transition-colors"
        data-testid={`button-expand-diet-tip-${safeId}`}
      >
        <span className="text-sm font-medium">{tipLabel}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 bg-card">
          {renderDetail()}
        </div>
      )}
    </div>
  );
}

export default function HealthInfo() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<{ activeTips: string[] }>({
    queryKey: ["/api/health-info/diet-tips"],
  });

  const activeTips = data?.activeTips ?? [];

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
                <DietTipAccordion
                  key={tip}
                  tipKey={tip}
                  tipLabel={label}
                  t={t}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
