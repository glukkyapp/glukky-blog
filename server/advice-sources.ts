export interface AdviceSource {
  label: string;
  url: string;
}

const ALL_SOURCES: AdviceSource[] = [
  {
    label:
      "Nutrition Therapy for Adults With Diabetes or Prediabetes: Consensus Report – Diabetes Care 2019",
    url: "https://diabetesjournals.org/care/article/42/5/731/40480/Nutrition-Therapy-for-Adults-With-Diabetes-or",
  },
  {
    label: "Dietary Advice For Individuals with Diabetes – Endotext",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK279012/",
  },
];

const SUGAR_SOURCE: AdviceSource = {
  label:
    "Reducing free sugars intake in adults to reduce the risk of noncommunicable diseases (WHO)",
  url: "https://www.who.int/tools/elena/interventions/free-sugars-adults-ncds",
};

const FATS_SOURCE: AdviceSource = {
  label: "ADA – Lipid Management in Diabetes (2024)",
  url: "https://professional.diabetes.org/sites/dpro/files/2024-03/KDBH-LipidManagement.pdf",
};

type CategoryKey = "sugar" | "carbs" | "fibre" | "fats" | "sodium";

interface CategoryDef {
  keywords: string[];
  extra: AdviceSource | null;
}

export const KEYWORD_CATEGORY_MAP: Record<CategoryKey, CategoryDef> = {
  sugar: {
    keywords: [
      "sugar", "sugary", "sweet", "sweetened", "soda", "juice", "dessert",
      "candy", "glucose spike", "blood sugar",
      "糖", "含糖", "甜", "甜味", "甜食", "汽水", "汽水飲品", "汽水飲料",
      "果汁", "甜品", "甜點", "糖果", "血糖飆升", "血糖上升", "血糖高",
    ],
    extra: SUGAR_SOURCE,
  },
  carbs: {
    keywords: [
      "carb", "carbohydrate", "rice", "noodle", "bread", "pasta", "starchy",
      "refined", "white rice", "congee", "glycemic",
      "碳水", "碳水化合物", "飯", "米飯", "白飯", "白米", "麵", "麵條",
      "麵食", "麵包", "意粉", "意大利粉", "粉麵", "澱粉", "澱粉質",
      "精製", "精製穀物", "粥", "白粥", "升糖", "升糖指數", "升糖反應",
    ],
    extra: null,
  },
  fibre: {
    keywords: [
      "fiber", "fibre", "vegetable", "vegetables", "portion", "plate method",
      "纖維", "膳食纖維", "高纖", "蔬菜", "菜", "青菜", "非澱粉類蔬菜",
      "份量", "食物份量", "控制份量", "餐碟法", "餐盤法", "餐碟分配",
      "餐盤分配",
    ],
    extra: null,
  },
  fats: {
    keywords: [
      "fat", "fatty", "fried", "oily", "saturated", "cholesterol", "lipid",
      "triglyceride", "trans fat", "deep fried",
      "脂肪", "高脂", "肥膩", "肥", "油膩", "油炸", "炸物", "炸雞",
      "飽和脂肪", "膽固醇", "血脂", "血脂肪", "三酸甘油脂", "三酸甘油酯",
      "反式脂肪", "炸",
    ],
    extra: FATS_SOURCE,
  },
  sodium: {
    keywords: [
      "salt", "sodium", "soy sauce", "processed", "salty", "blood pressure",
      "hypertension", "preserved",
      "鹽", "食鹽", "鈉", "高鈉", "鹹", "重鹹", "豉油", "醬油",
      "加工食品", "加工肉", "加工食物", "血壓", "高血壓", "鹽分",
      "醃製", "醃製食品", "醃肉",
    ],
    extra: null,
  },
};

const TIEBREAK_ORDER: CategoryKey[] = ["sugar", "carbs", "fats", "sodium", "fibre"];

export function pickSources(adviceText: string): AdviceSource[] {
  const text = (adviceText || "").toLowerCase();
  const counts: Record<CategoryKey, number> = {
    sugar: 0, carbs: 0, fibre: 0, fats: 0, sodium: 0,
  };
  for (const cat of TIEBREAK_ORDER) {
    for (const kw of KEYWORD_CATEGORY_MAP[cat].keywords) {
      const needle = kw.toLowerCase();
      if (!needle) continue;
      let idx = 0;
      while ((idx = text.indexOf(needle, idx)) !== -1) {
        counts[cat] += 1;
        idx += needle.length;
      }
    }
  }

  let best: CategoryKey | null = null;
  for (const cat of TIEBREAK_ORDER) {
    if (counts[cat] <= 0) continue;
    if (best === null || counts[cat] > counts[best]) {
      best = cat;
    }
  }

  const result: AdviceSource[] = [...ALL_SOURCES];
  if (best) {
    const extra = KEYWORD_CATEGORY_MAP[best].extra;
    if (extra) result.push(extra);
  }
  return result.slice(0, 3);
}

export { ALL_SOURCES };
