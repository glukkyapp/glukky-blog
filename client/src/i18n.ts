import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhHant from "./locales/zh-Hant.json";
import yue from "./locales/yue.json";

const VALID_LANGS = ["en", "zh-Hant", "yue"];
const savedLang = localStorage.getItem("glukky_preferred_lang") || "";
const initialLang = VALID_LANGS.includes(savedLang) ? savedLang : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-Hant": { translation: zhHant },
    yue: { translation: yue },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
