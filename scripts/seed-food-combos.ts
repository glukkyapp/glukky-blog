import { db } from "../server/db";
import { ingredientVocabulary, foodCombos } from "../shared/schema";
import { eq } from "drizzle-orm";

const VOCAB: Array<{
  internalId: string;
  category: string;
  labelEn: string;
  labelZh: string;
  labelYue: string;
  aliases: string[];
}> = [
  { internalId: "small", category: "portion", labelEn: "Small", labelZh: "小", labelYue: "小", aliases: ["small", "小", "s"] },
  { internalId: "medium", category: "portion", labelEn: "Medium", labelZh: "中", labelYue: "中", aliases: ["medium", "中", "m"] },
  { internalId: "large", category: "portion", labelEn: "Large", labelZh: "大", labelYue: "大", aliases: ["large", "大", "l"] },

  { internalId: "soy_sauce", category: "sauce", labelEn: "Soy sauce", labelZh: "豉油", labelYue: "豉油", aliases: ["soy sauce", "soy", "豉油", "醬油"] },
  { internalId: "oyster_sauce", category: "sauce", labelEn: "Oyster sauce", labelZh: "蠔油", labelYue: "蠔油", aliases: ["oyster sauce", "蠔油"] },
  { internalId: "chili_oil", category: "sauce", labelEn: "Chili oil", labelZh: "辣油", labelYue: "辣油", aliases: ["chili oil", "辣油", "辣椒油"] },
  { internalId: "xo_sauce", category: "sauce", labelEn: "XO sauce", labelZh: "XO醬", labelYue: "XO醬", aliases: ["xo sauce", "xo醬", "xo"] },
  { internalId: "sweet_soy", category: "sauce", labelEn: "Sweet soy sauce", labelZh: "甜醬油", labelYue: "甜豉油", aliases: ["sweet soy", "甜醬油", "甜豉油"] },
  { internalId: "sesame_oil", category: "sauce", labelEn: "Sesame oil", labelZh: "麻油", labelYue: "麻油", aliases: ["sesame oil", "麻油"] },
  { internalId: "hoisin_sauce", category: "sauce", labelEn: "Hoisin sauce", labelZh: "海鮮醬", labelYue: "海鮮醬", aliases: ["hoisin", "海鮮醬", "hoisin sauce"] },
  { internalId: "condensed_milk", category: "sauce", labelEn: "Condensed milk", labelZh: "煉奶", labelYue: "煉奶", aliases: ["condensed milk", "煉奶", "淡奶"] },
  { internalId: "curry_sauce", category: "sauce", labelEn: "Curry sauce", labelZh: "咖喱汁", labelYue: "咖喱汁", aliases: ["curry sauce", "curry", "咖喱汁", "咖喱"] },
  { internalId: "satay_sauce", category: "sauce", labelEn: "Satay sauce", labelZh: "沙嗲醬", labelYue: "沙嗲醬", aliases: ["satay sauce", "satay", "沙嗲醬", "沙嗲"] },
  { internalId: "shrimp_paste", category: "sauce", labelEn: "Shrimp paste", labelZh: "蝦醬", labelYue: "蝦醬", aliases: ["shrimp paste", "蝦醬"] },
  { internalId: "chili_sauce", category: "sauce", labelEn: "Chili sauce", labelZh: "辣椒醬", labelYue: "辣椒醬", aliases: ["chili sauce", "辣椒醬", "辣醬"] },

  { internalId: "spring_onion", category: "topping", labelEn: "Spring onion", labelZh: "蔥", labelYue: "蔥", aliases: ["spring onion", "green onion", "蔥", "葱"] },
  { internalId: "fried_shallot", category: "topping", labelEn: "Fried shallot", labelZh: "炸蔥", labelYue: "炸蔥", aliases: ["fried shallot", "fried onion", "炸蔥"] },
  { internalId: "fried_egg", category: "topping", labelEn: "Fried egg", labelZh: "煎蛋", labelYue: "煎蛋", aliases: ["fried egg", "煎蛋", "荷包蛋"] },
  { internalId: "century_egg", category: "topping", labelEn: "Century egg", labelZh: "皮蛋", labelYue: "皮蛋", aliases: ["century egg", "皮蛋", "preserved egg"] },
  { internalId: "pork_floss", category: "topping", labelEn: "Pork floss", labelZh: "肉鬆", labelYue: "肉鬆", aliases: ["pork floss", "肉鬆"] },
  { internalId: "dried_shrimp", category: "topping", labelEn: "Dried shrimp", labelZh: "蝦米", labelYue: "蝦米", aliases: ["dried shrimp", "蝦米"] },
  { internalId: "pickled_veg", category: "topping", labelEn: "Pickled vegetables", labelZh: "酸菜", labelYue: "酸菜", aliases: ["pickled vegetables", "pickled veg", "酸菜", "榨菜"] },
  { internalId: "lettuce", category: "topping", labelEn: "Lettuce", labelZh: "生菜", labelYue: "生菜", aliases: ["lettuce", "生菜"] },
  { internalId: "chili_flakes", category: "topping", labelEn: "Chili flakes", labelZh: "辣椒碎", labelYue: "辣椒碎", aliases: ["chili flakes", "辣椒碎"] },
  { internalId: "white_pepper", category: "topping", labelEn: "White pepper", labelZh: "白胡椒", labelYue: "白胡椒", aliases: ["white pepper", "白胡椒"] },
  { internalId: "butter", category: "topping", labelEn: "Butter", labelZh: "牛油", labelYue: "牛油", aliases: ["butter", "牛油"] },
];

const COMBOS: Array<{
  foodName: string;
  foodNameEn: string | null;
  foodNameAliases: string[];
  defaultPortion: string;
  defaultSauces: string[];
  defaultToppings: string[];
  caloriesEstimate: number | null;
}> = [
  { foodName: "腩肉米線", foodNameEn: "Pork belly rice noodles", foodNameAliases: ["pork belly noodles", "腩肉米線", "腩米"], defaultPortion: "medium", defaultSauces: ["soy_sauce"], defaultToppings: ["spring_onion"], caloriesEstimate: 550 },
  { foodName: "叉燒飯", foodNameEn: "Char siu rice", foodNameAliases: ["char siu rice", "叉燒飯", "bbq pork rice"], defaultPortion: "medium", defaultSauces: ["sweet_soy"], defaultToppings: ["spring_onion"], caloriesEstimate: 650 },
  { foodName: "燒肉飯", foodNameEn: "Roast pork rice", foodNameAliases: ["roast pork rice", "燒肉飯", "siu yuk rice"], defaultPortion: "medium", defaultSauces: ["soy_sauce"], defaultToppings: ["spring_onion"], caloriesEstimate: 700 },
  { foodName: "雲吞麵", foodNameEn: "Wonton noodles", foodNameAliases: ["wonton noodles", "雲吞麵", "wanton noodles", "wonton mein"], defaultPortion: "medium", defaultSauces: [], defaultToppings: ["spring_onion"], caloriesEstimate: 400 },
  { foodName: "皮蛋瘦肉粥", foodNameEn: "Century egg congee", foodNameAliases: ["century egg and pork congee", "皮蛋瘦肉粥", "皮蛋粥"], defaultPortion: "medium", defaultSauces: ["sesame_oil"], defaultToppings: ["spring_onion", "century_egg"], caloriesEstimate: 300 },
  { foodName: "咖喱魚蛋", foodNameEn: "Curry fish balls", foodNameAliases: ["curry fish balls", "咖喱魚蛋", "咖哩魚蛋"], defaultPortion: "small", defaultSauces: ["curry_sauce"], defaultToppings: [], caloriesEstimate: 200 },
  { foodName: "菠蘿包", foodNameEn: "Pineapple bun", foodNameAliases: ["pineapple bun", "菠蘿包", "polo bun", "菠蘿油"], defaultPortion: "small", defaultSauces: [], defaultToppings: ["butter"], caloriesEstimate: 350 },
  { foodName: "蛋撻", foodNameEn: "Egg tart", foodNameAliases: ["egg tart", "蛋撻", "蛋塔", "dan tat"], defaultPortion: "small", defaultSauces: [], defaultToppings: [], caloriesEstimate: 200 },
  { foodName: "絲襪奶茶", foodNameEn: "HK milk tea", foodNameAliases: ["hong kong milk tea", "silk stocking milk tea", "絲襪奶茶", "港式奶茶", "奶茶"], defaultPortion: "medium", defaultSauces: ["condensed_milk"], defaultToppings: [], caloriesEstimate: 180 },
  { foodName: "腸粉", foodNameEn: "Cheung fun", foodNameAliases: ["cheung fun", "腸粉", "rice noodle roll", "rice roll"], defaultPortion: "medium", defaultSauces: ["soy_sauce", "sesame_oil"], defaultToppings: ["spring_onion"], caloriesEstimate: 250 },
  { foodName: "蝦餃", foodNameEn: "Har gow", foodNameAliases: ["har gow", "蝦餃", "shrimp dumpling"], defaultPortion: "small", defaultSauces: ["soy_sauce"], defaultToppings: [], caloriesEstimate: 200 },
  { foodName: "燒賣", foodNameEn: "Siu mai", foodNameAliases: ["siu mai", "燒賣", "shumai", "pork dumpling"], defaultPortion: "small", defaultSauces: ["soy_sauce", "chili_sauce"], defaultToppings: [], caloriesEstimate: 220 },
  { foodName: "煲仔飯", foodNameEn: "Claypot rice", foodNameAliases: ["claypot rice", "煲仔飯", "clay pot rice"], defaultPortion: "large", defaultSauces: ["soy_sauce"], defaultToppings: ["spring_onion"], caloriesEstimate: 750 },
  { foodName: "車仔麵", foodNameEn: "Cart noodles", foodNameAliases: ["cart noodles", "車仔麵", "che zai mein"], defaultPortion: "medium", defaultSauces: ["satay_sauce", "curry_sauce"], defaultToppings: [], caloriesEstimate: 500 },
  { foodName: "乾炒牛河", foodNameEn: "Dry-fried beef ho fun", foodNameAliases: ["beef ho fun", "dry fried ho fun", "乾炒牛河", "炒河粉"], defaultPortion: "medium", defaultSauces: ["soy_sauce"], defaultToppings: ["spring_onion"], caloriesEstimate: 650 },
];

async function seed() {
  console.log("Seeding ingredient vocabulary...");
  for (const v of VOCAB) {
    const [existing] = await db.select().from(ingredientVocabulary)
      .where(eq(ingredientVocabulary.internalId, v.internalId));
    if (!existing) {
      await db.insert(ingredientVocabulary).values(v);
      console.log(`  + ${v.internalId}`);
    } else {
      console.log(`  = ${v.internalId} (exists)`);
    }
  }

  console.log("\nSeeding food combos...");
  for (const c of COMBOS) {
    const [existing] = await db.select().from(foodCombos)
      .where(eq(foodCombos.foodName, c.foodName));
    if (!existing) {
      await db.insert(foodCombos).values(c);
      console.log(`  + ${c.foodName} (${c.foodNameEn})`);
    } else {
      console.log(`  = ${c.foodName} (exists)`);
    }
  }

  console.log("\nDone! Seeded", VOCAB.length, "vocabulary items and", COMBOS.length, "food combos.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
