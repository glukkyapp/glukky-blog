// Centralized strings for EN / ZH-Hant.
// Slugs are kept identical across both languages (English slugs, per spec —
// easier to type, link and analyze, and acceptable for the ZH side).

export const SITE_URL = "https://glukky.com";
// PLACEHOLDER — replace with the real App Store URL + waitlist URL before launch.
// Wired into every "Get the app" CTA so swapping it once updates the whole site.
export const APP_STORE_URL = "https://apps.apple.com/app/idPLACEHOLDER";
export const WAITLIST_URL = "https://glukky.com/app#waitlist";

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
        "Glukky app screenshots — food snap, diet advice, diet tip, monthly report, personalised weekly schedule.",
      screenshotsCaption:
        "Glukky on iPhone — food snap, diet advice, diet tip, monthly report, personalised weekly schedule.",
      scenes: [
        { label: "Food snap" },
        { label: "Diet advice" },
        { label: "Diet tip" },
        { label: "Monthly report" },
        { label: "Personalised weekly schedule" },
      ],
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
        "為糖尿前期、二型糖尿患者及關注血糖健康的人士而寫，從飲食、飯後散步、晚餐時間入手，立足香港。",
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
      heroTitle: "穩定血糖，由每日小習慣開始。",
      heroLead:
        "告訴你有關：糖尿前期飲食、飯後散步及晚餐時間的重要性、低 GI 食物及常見誤解。",
      heroPrimary: "閱讀全部文章",
      heroSecondary: "了解 Glukky",
      featuredHeading: "推薦閱讀",
      clusterHeading: "文章主題",
      clusters: [
        {
          title: "糖尿前期飲食",
          desc:
            "由何處入手？最先要改善的是什麼？所謂「控糖飲食」實際上如何做到？",
        },
        {
          title: "飯後散步",
          desc:
            "為何短暫的散步能夠改善血糖？如何持之以恆？",
        },
        {
          title: "晚餐時間",
          desc:
            "「何時吃」可能與「吃什麼」同樣重要 —— 實用的晚間生活節奏。",
        },
        {
          title: "低 GI 食物",
          desc: "與其執著計算卡路里，不如思考碳水化合物的質素。",
        },
      ],
      ctaHeading: "隨身帶著 Glukky",
      ctaBody: "拍下餐點，看一段簡短的解讀，再養成飯後散步的習慣。",
      ctaButton: "了解 Glukky 應用程式",
    },
    blog: {
      title: "文章",
      lead: "簡短、實用的內容，談飲食、散步與日常小習慣，幫你穩定血糖。",
      readArticle: "閱讀文章 →",
      backToBlog: "← 返回所有文章",
      relatedHeading: "相關文章",
      faqHeading: "常見問題",
      sourcesHeading: "資料來源",
      tocHeading: "本文目錄",
      breadcrumbHome: "首頁",
      breadcrumbBlog: "文章",
      switchLang: "English",
      switchLangAria: "Read this article in English",
      ctaTitle: "建立習慣，不必再翻查表格",
      ctaBody:
        "Glukky 幫你拍下餐點、提醒你飯後散步，慢慢留意身體的反應 —— 而不必每日盯著數字。",
      ctaButton: "了解 Glukky 的運作方式",
      published: "發佈日期",
      updated: "更新日期",
      readingMin: (m) => `閱讀約 ${m} 分鐘`,
    },
    about: {
      title: "關於 Glukky",
      lead:
        "Glukky 是一個關注血糖健康的日常夥伴，特別為糖尿前期、二型糖尿，或希望穩定血糖的人而設。",
      sections: [
        {
          h: "我們相信",
          p: "真正的改變，多數發生在餐桌上與飯後的一段短散步，其他都是雜訊。",
        },
        {
          h: "Glukky 做什麼",
          p: "拍下你的餐點，Glukky 幫你解讀 —— 哪些容易令血糖上升、可以如何搭配、更穩定的版本會是怎樣。然後再提醒你飯後散步、適時進食晚餐。",
        },
        {
          h: "誰適合使用",
          p: "剛知道自己屬於糖尿前期、希望日常更輕鬆的二型糖尿患者，或在香港希望吃得健康、但又不想完全戒掉粥粉麵飯、點心、茶餐廳的人。",
        },
        {
          h: "不是什麼",
          p: "Glukky 不是醫生、不是診斷儀器，亦不能取代臨床治療。它只是日常之中一個溫和的提醒。",
        },
      ],
      ctaTitle: "試試 Glukky",
      ctaButton: "看看這個應用",
    },
    app: {
      title: "Glukky 應用程式",
      lead:
        "一個輕鬆的習慣循環：拍下餐點、飯後散步、稍早吃晚餐。Glukky 幫你持之以恆。",
      pillars: [
        {
          h: "AI 食物拍照",
          p: "拍下你的餐點，Glukky 幫你解讀 —— 內容有什麼、會如何影響血糖、可以如何吃得更穩當。",
        },
        {
          h: "飯後散步",
          p: "在重要的一餐之後，溫和地提醒你散步。短、做得到，效果出乎意料地好。",
        },
        {
          h: "晚餐時間",
          p: "建立簡單的晚間節奏，避免常常拖到晚上十點才吃晚飯再加宵夜。將來的自己會感謝你。",
        },
      ],
      screenshotsAlt:
        "Glukky 應用程式介面截圖：食物快拍、即時建議、飲食貼士、每月報告、個人化計劃。",
      screenshotsCaption:
        "Glukky 介面：食物快拍、即時建議、飲食貼士、每月報告、個人化計劃。",
      scenes: [
        { label: "食物快拍" },
        { label: "即時建議" },
        { label: "飲食貼士" },
        { label: "每月報告" },
        { label: "個人化計劃" },
      ],
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
