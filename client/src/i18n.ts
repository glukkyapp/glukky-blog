import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

// Only the active locale is bundled at boot; zh-Hant and yue load on demand to shrink the cold-launch JS payload.
const VALID_LANGS = ["en", "zh-Hant", "yue"] as const;
type Lang = typeof VALID_LANGS[number];

type LocaleResource = Record<string, unknown>;
type LocaleModule = { default: LocaleResource };

const savedLang = (typeof localStorage !== "undefined"
  ? localStorage.getItem("glukky_preferred_lang")
  : "") || "";

function detectDeviceLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || "";
  if (lang.startsWith("zh")) return "zh-Hant";
  if (lang.startsWith("yue")) return "yue";
  return "en";
}

const initialLang: Lang = (VALID_LANGS as readonly string[]).includes(savedLang)
  ? (savedLang as Lang)
  : detectDeviceLang();

const loadedBundles = new Set<string>(["en"]);
const inflightBundles = new Map<string, Promise<void>>();

function loadBundle(lang: string): Promise<void> {
  if (loadedBundles.has(lang)) return Promise.resolve();
  const existing = inflightBundles.get(lang);
  if (existing) return existing;
  let p: Promise<LocaleModule>;
  if (lang === "zh-Hant") p = import("./locales/zh-Hant.json") as Promise<LocaleModule>;
  else if (lang === "yue") p = import("./locales/yue.json") as Promise<LocaleModule>;
  else return Promise.resolve();
  const wrapped = p.then((mod) => {
    i18n.addResourceBundle(lang, "translation", mod.default, true, true);
    loadedBundles.add(lang);
  });
  inflightBundles.set(lang, wrapped);
  return wrapped;
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

if (initialLang !== "en") {
  // Background-load the saved locale; EN remains as fallback until the chunk lands.
  void loadBundle(initialLang).then(() => {
    void i18n.changeLanguage(initialLang);
  });
}

i18n.on("languageChanged", (lang) => {
  if (!loadedBundles.has(lang)) {
    // Re-fire changeLanguage after the bundle lands so subscribers re-render with the resolved strings instead of staying on EN fallback.
    void loadBundle(lang).then(() => {
      if (i18n.language === lang) void i18n.changeLanguage(lang);
    });
  }
});

export default i18n;
