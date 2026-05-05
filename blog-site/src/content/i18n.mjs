// Centralized strings for EN / ZH-Hant.
// Slugs are kept identical across both languages (English slugs, per spec —
// easier to type, link and analyze, and acceptable for the ZH side).

export const SITE_URL = "https://glukky.com";
// Placeholder until App Store URL + waitlist URL is confirmed by the user.
export const APP_STORE_URL = "https://apps.apple.com/app/idPLACEHOLDER";

export const LOCALES = ["en", "zh-Hant"];
export const DEFAULT_LOCALE = "en";

export const ui = {
  en: {
    htmlLang: "en",
    siteName: "Glukky",
    tagline: "Calm, food-aware support for blood sugar habits.",
    nav: {
      home: "Home",
      blog: "Articles",
      about: "About",
      app: "Get the app",
    },
    footer: {
      tagline:
        "Editorial guides on eating, walking and dinner timing for people with prediabetes or type 2 — written for Hong Kong and beyond.",
      sections: "Sections",
      languages: "Languages",
      english: "English",
      chinese: "繁體中文",
      disclaimer:
        "Glukky's articles are educational and lifestyle-focused. They are not medical advice, diagnosis, or treatment. Talk to your doctor about your own situation.",
      copyright: "© Glukky",
    },
    home: {
      eyebrow: "Glukky journal",
      heroTitle: "Steadier blood sugar starts with small, repeatable habits.",
      heroLead:
        "Plain-English guides on prediabetes diet, post-meal walking, dinner timing and lower-GI eating — with a Hong Kong lens. No fads, no fear, no hype.",
      heroPrimary: "Read the articles",
      heroSecondary: "About Glukky",
      featuredHeading: "Start here",
      clusterHeading: "Topics we cover",
      clusters: [
        {
          title: "Prediabetes diet",
          desc: "How to start, what to swap first, and what 'eating for blood sugar' actually means day to day.",
        },
        {
          title: "Post-meal walking",
          desc: "Why a short walk after eating helps, and how to make it a habit you keep.",
        },
        {
          title: "Dinner timing",
          desc: "When you eat may matter as much as what — practical evening routines.",
        },
        {
          title: "Lower-GI eating",
          desc: "Carbohydrate quality over carb-counting drama.",
        },
      ],
      ctaHeading: "Glukky, in your pocket",
      ctaBody:
        "Snap a photo of your meal, see a quick read, and build a calmer post-meal routine.",
      ctaButton: "Learn about the app",
    },
    blog: {
      title: "Articles",
      lead:
        "Short, practical guides on eating, walking and small daily habits that support blood sugar.",
      readArticle: "Read article →",
      backToBlog: "← Back to all articles",
      relatedHeading: "Related reading",
      faqHeading: "Frequently asked questions",
      sourcesHeading: "Sources",
      tocHeading: "On this page",
      breadcrumbHome: "Home",
      breadcrumbBlog: "Articles",
      switchLang: "繁體中文",
      switchLangAria: "Read this article in Traditional Chinese",
      ctaTitle: "Build the habit, not the spreadsheet",
      ctaBody:
        "Glukky helps you snap meals, walk after dinner, and notice patterns — without obsessing over numbers.",
      ctaButton: "See how Glukky works",
      published: "Published",
      updated: "Updated",
      readingMin: (m) => `${m} min read`,
    },
    about: {
      title: "About Glukky",
      lead:
        "Glukky is a calm, food-aware companion for people with prediabetes, type 2, or anyone trying to keep blood sugar more stable through everyday choices.",
      sections: [
        {
          h: "What we believe",
          p: "Most of the change happens at the dinner table and on a quiet walk afterwards. The rest is noise.",
        },
        {
          h: "What Glukky does",
          p: "Snap a meal photo and Glukky helps you read it — what's likely to spike, what to pair it with, what a steadier version might look like. Then it nudges a short post-meal walk and a sensible dinner time.",
        },
        {
          h: "Who it's for",
          p: "People recently told they're prediabetic, people with type 2 looking for a gentler day-to-day, and anyone in Hong Kong who wants to eat well without giving up congee, dim sum or cha chaan teng.",
        },
        {
          h: "What it isn't",
          p: "It is not a doctor, a diagnostic device, or a substitute for clinical care. It's a quiet, daily nudge in the right direction.",
        },
      ],
      ctaTitle: "Try Glukky",
      ctaButton: "See the app",
    },
    app: {
      title: "Glukky — the app",
      lead:
        "A calm habit loop: snap a meal, take a short walk, eat dinner a bit earlier. Glukky makes the loop easy to keep.",
      pillars: [
        {
          h: "AI food snap",
          p: "Take a photo of your plate. Glukky reads what's there and gives you a quick, plain-English take on how it might land — and what a steadier version could look like.",
        },
        {
          h: "Post-meal walk",
          p: "A gentle nudge for a short walk after the meals that matter. Small, doable, and surprisingly effective for many people.",
        },
        {
          h: "Dinner timing",
          p: "A simple evening rhythm so dinner doesn't end up at 10pm with leftover snacks. Your future self thanks you.",
        },
      ],
      screenshotsAlt:
        "Glukky app screenshots — home, food snap, walking nudge, dinner timing.",
      screenshotsCaption:
        "Glukky on iPhone — home, food snap, walking nudge, dinner timing.",
      ctaTitle: "Coming to the App Store",
      ctaBody:
        "Glukky is launching soon. Tap below to be notified when it's live.",
      ctaButton: "Get the app",
    },
  },
  "zh-Hant": {
    htmlLang: "zh-Hant-HK",
    siteName: "Glukky",
    tagline: "陪你建立穩定血糖的小習慣。",
    nav: {
      home: "首頁",
      blog: "文章",
      about: "關於 Glukky",
      app: "下載應用",
    },
    footer: {
      tagline:
        "為糖尿前期、二型糖尿患者及關注血糖健康人士而寫，從飲食、飯後散步、晚餐時間入手，立足香港。",
      sections: "目錄",
      languages: "語言",
      english: "English",
      chinese: "繁體中文",
      disclaimer:
        "Glukky 文章只屬生活及健康資訊參考，並非醫療建議、診斷或治療。如有疑問，請諮詢醫生。",
      copyright: "© Glukky",
    },
    home: {
      eyebrow: "Glukky 健康筆記",
      heroTitle: "穩定血糖，由可以日日做到的小習慣開始。",
      heroLead:
        "由糖尿前期飲食、飯後散步、晚餐時間到低 GI 食物，立足香港，講人話。冇炒作、冇恐嚇、冇流行語。",
      heroPrimary: "睇全部文章",
      heroSecondary: "了解 Glukky",
      featuredHeading: "推薦閱讀",
      clusterHeading: "我哋寫嘅題目",
      clusters: [
        {
          title: "糖尿前期飲食",
          desc:
            "由邊度入手？最先要轉嘅係咩？所謂「控糖飲食」其實日常點落手？",
        },
        {
          title: "飯後散步",
          desc:
            "為何一段短時間散步可以幫到血糖？點樣先可以持之以恆？",
        },
        {
          title: "晚餐時間",
          desc:
            "「幾時食」可能同「食乜」一樣重要 —— 實用嘅晚間生活節奏。",
        },
        {
          title: "低 GI 食物",
          desc: "與其執著計卡路里，不如諗清楚碳水化合物嘅質素。",
        },
      ],
      ctaHeading: "隨身帶住 Glukky",
      ctaBody: "影低餐單，睇個簡短嘅解讀，再養成飯後散步嘅習慣。",
      ctaButton: "了解 Glukky 應用程式",
    },
    blog: {
      title: "文章",
      lead: "簡短、實用嘅內容，講飲食、散步同日常小習慣，幫你穩定血糖。",
      readArticle: "睇文章 →",
      backToBlog: "← 返回所有文章",
      relatedHeading: "相關文章",
      faqHeading: "常見問題",
      sourcesHeading: "資料來源",
      tocHeading: "本文目錄",
      breadcrumbHome: "首頁",
      breadcrumbBlog: "文章",
      switchLang: "English",
      switchLangAria: "Read this article in English",
      ctaTitle: "建立習慣，唔需要再執表格",
      ctaBody:
        "Glukky 幫你影低餐單、提你飯後散步，慢慢留意身體嘅反應 —— 而唔使日日盯住數字。",
      ctaButton: "睇下 Glukky 點樣運作",
      published: "發佈日期",
      updated: "更新日期",
      readingMin: (m) => `閱讀約 ${m} 分鐘`,
    },
    about: {
      title: "關於 Glukky",
      lead:
        "Glukky 係一個關注血糖健康嘅日常拍檔，特別為糖尿前期、二型糖尿，或想穩定血糖嘅人而設。",
      sections: [
        {
          h: "我哋相信",
          p: "真正嘅改變，多數發生喺餐枱同飯後嘅一段短散步，其他都係雜訊。",
        },
        {
          h: "Glukky 做啲咩",
          p: "影低你嘅餐單，Glukky 幫你睇 —— 邊樣容易令血糖升、可以點樣搭配、更穩定嘅版本會係點。然後再提你飯後散散步、適時食晚餐。",
        },
        {
          h: "邊個適合用",
          p: "啱啱知道自己係糖尿前期、希望日常輕鬆啲嘅二型糖尿患者，或者係香港想食得健康，但唔想戒晒粥粉麵飯、點心、茶餐廳嘅人。",
        },
        {
          h: "唔係咩",
          p: "Glukky 唔係醫生、唔係診斷儀器、亦唔係臨床治療嘅替代品。佢只係日常之中，一個溫和嘅提醒。",
        },
      ],
      ctaTitle: "試下 Glukky",
      ctaButton: "睇下個 App",
    },
    app: {
      title: "Glukky 應用程式",
      lead:
        "一個輕鬆嘅習慣循環：影低餐單、飯後散步、早一啲食晚餐。Glukky 幫你持之以恆。",
      pillars: [
        {
          h: "AI 食物影相",
          p: "影低你個餐，Glukky 幫你解讀 —— 入面有啲乜、容易令血糖點變化、可以點樣食得更穩陣。",
        },
        {
          h: "飯後散步",
          p: "喺重要嘅一餐之後，溫和提你散下步。短、做得到，效果出乎意料咁好。",
        },
        {
          h: "晚餐時間",
          p: "建立簡單嘅晚間節奏，避免成日拖到夜晚十點先食晚飯，再加宵夜。將來嘅自己會多謝你。",
        },
      ],
      screenshotsAlt:
        "Glukky 應用程式介面截圖：首頁、影食物、散步提示、晚餐時間。",
      screenshotsCaption:
        "Glukky iPhone 介面：首頁、影食物、散步提示、晚餐時間。",
      ctaTitle: "即將上架 App Store",
      ctaBody: "Glukky 即將推出，按以下按鈕了解更多。",
      ctaButton: "下載 Glukky",
    },
  },
};

export function urlFor(locale, path) {
  const clean = String(path || "").replace(/^\/+|\/+$/g, "");
  if (locale === "en") return clean ? `/${clean}` : "/";
  return clean ? `/zh/${clean}` : "/zh/";
}

export function articleUrl(locale, slug) {
  return urlFor(locale, `blog/${slug}`);
}

export function blogIndexUrl(locale) {
  return urlFor(locale, "blog");
}

export function altLocale(locale) {
  return locale === "en" ? "zh-Hant" : "en";
}

export function fmtDate(iso, locale) {
  const d = new Date(iso);
  if (locale === "en") {
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function readingMinutes(text) {
  // Rough estimate: 200 wpm for English, 400 cpm for Chinese.
  const wordCount = (text.match(/\w+/g) || []).length;
  const cjkCount = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const minutes = Math.max(1, Math.round(wordCount / 200 + cjkCount / 400));
  return minutes;
}
