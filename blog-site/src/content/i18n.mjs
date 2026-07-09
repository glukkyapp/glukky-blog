// Centralized strings for EN / ZH-Hant.
// Slugs are kept identical across both languages (English slugs, per spec —
// easier to type, link and analyze, and acceptable for the ZH side).

export const SITE_URL = "https://glukky.com";
// PLACEHOLDER — replace with the real App Store URL + waitlist URL before launch.
// Wired into every "Get the app" CTA so swapping it once updates the whole site.
export const APP_STORE_URL = "https://apps.apple.com/hk/app/glukky-diabetes-habit-coach/id6761914533";
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
      contact: "reach us by hello@glukky.com",
      disclaimer:
        "Glukky's articles are educational and lifestyle-focused. They are not medical advice, diagnosis, or treatment. Talk to your doctor about your own situation.",
      copyright: "© Glukky",
      privacy: "Privacy",
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
      contactIntro: "Have a question? Reach us at",
      ctaTitle: "Try Glukky",
      ctaButton: "See the app",
    },
    app: {
      title: "Build the habit, not the spreadsheet. Sugar management made easy.",
      heroH1: "Build the habit, not the spreadsheet.",
      heroH2: "Sugar management made easy.",
      lead:
        "Glukky is a calm, food-aware companion for people with prediabetes, type 2, or anyone trying to keep blood sugar more stable through everyday choices.",
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
      spotsNote: "Free to join · 20 spots only",
      joinLabel: null,
      joinHint: "",
    },
    privacy: {
      title: "Privacy Policy",
      description: "How Glukky collects, uses and protects your personal data.",
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
      tagline: "為糖尿前期、二型糖尿患者及關注血糖健康的人士而設。",
      sections: "目錄",
      languages: "語言",
      english: "English",
      chinese: "繁體中文",
      contact: "電郵hello@glukky.com了解更多",
      disclaimer:
        "Glukky 文章只屬生活及健康資訊參考，並非醫療建議、診斷或治療。如有疑問，請諮詢醫生。",
      copyright: "© Glukky",
      privacy: "私隱政策",
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
      ctaTitle: "Glukky AI小幫手助你管理日常",
      ctaBody:
        "每餐飯給你即時建議、提醒你飯後散步，每月回顧，不必再為數字緊張。",
      ctaButton: "了解 Glukky 的運作方式",
      published: "發佈日期",
      updated: "更新日期",
      readingMin: (m) => `閱讀時間約 ${m} 分鐘`,
    },
    about: {
      title: "關於 Glukky",
      lead:
        "Glukky 是一個關注血糖健康的日常夥伴應用程式，為關注血糖、希望控糖的人而設。",
      sections: [
        {
          h: "我們相信",
          p: "飲食和運動比你想像的更強大。",
        },
        {
          h: "Glukky 是什麼",
          p: "Glukky是一個手機應用程式，拍下你今天吃什麼，Glukky會即時幫你解讀 —— 哪些容易令血糖上升、怎樣吃會比較好、下次可以如何配搭。個人化每週計劃和飲食目標、獎勵系統。",
        },
        {
          h: "誰適合使用",
          p: "剛知道自己屬於糖尿前期、希望日常更輕鬆的二型糖尿患者，或在香港希望吃得健康、但又不想完全戒掉粥粉麵飯、點心、茶餐廳的人。",
        },
        {
          h: "免責聲明",
          p: "Glukky 不是醫生、不是診斷儀器，亦不能取代臨床治療。",
        },
      ],
      contactIntro: "有疑問？歡迎電郵",
      ctaTitle: "試用Glukky",
      ctaButton: "看看這個應用程式",
    },
    app: {
      title: "不再盯著數字，控糖變得簡單。",
      heroH1: "不再盯著數字，",
      heroH2: "控糖變得簡單。",
      lead:
        "每餐一張照片，找出什麼食物適合你，讓血糖變得穩定。所有功能免費使用。",
      pillars: [
        {
          h: "食物快拍",
          p: "拍攝或上傳餐點照片，立刻取得個人化的飲食建議。",
        },
        {
          h: "個人化食物血糖圖表",
          p: "每週顯示「本週最佳食物」與「本週最不利食物」，讓你知道吃什麼適合自己。",
        },
        {
          h: "每週飲食報告與分數",
          p: "依照你的飲食模式產生每週分數，建議下一週怎樣調整。",
        },
        {
          h: "健康資訊庫",
          p: "瀏覽搭配照片的飲食小提示與說明，文字淺白易懂，隨時打開即可查看，不需要再花時間上網搜尋。",
        },
      ],
      screenshotsAlt:
        "Glukky 應用程式介面截圖：食物快拍、飲食建議、每日進度、血糖規律、健康資訊。",
      screenshotsCaption:
        "Glukky 介面：食物快拍、飲食建議、每日進度、血糖規律、健康資訊。",
      screenslugs: ["01-v2", "02-v2", "03", "04", "05", "06", "07"],
      scenes: [
        { label: "食物快拍" },
        { label: "個人化控糖輕鬆管理" },
        { label: "拍下食物，即時獲得飲食建議" },
        { label: "個人化控糖建議，毋須煩惱計算卡路里" },
        { label: "每日進度一覽，掌握自己的控糖節奏" },
        { label: "一眼看清，哪些食物最升你的糖" },
        { label: "隨時重溫，簡單易明的控糖飲食貼士" },
      ],
      ctaTitle: "立即免費下載",
      ctaBody: "所有功能免費使用，無需訂閱。",
      ctaButton: "下載 Glukky",
      spotsNote: "",
      joinLabel: null,
      joinHint: "",
      footnote: {
        main: "Glukky 可免費下載，也可完全免費使用。本版本中的所有功能均無需訂閱或 App 內購買即可使用。",
        legal: [
          "Glukky 是一款生活型態與習慣養成工具，並非醫療器材，不提供任何醫療診斷或治療。請務必遵從你的醫護人員之專業建議。",
          "Glukky 使用 AI 提供個人化的生活與飲食建議，但這些內容並不能取代專業的醫療意見。",
        ],
      },
    },
    privacy: {
      title: "私隱政策",
      description: "How Glukky collects, uses and protects your personal data.",
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
