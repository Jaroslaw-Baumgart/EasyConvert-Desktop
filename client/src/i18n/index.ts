import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { pl } from "./locales/pl";

export const languageStorageKey = "online-file-converter-language";
export const supportedLanguages = ["en", "pl"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export function isSupportedLanguage(
  language: string,
): language is SupportedLanguage {
  return supportedLanguages.includes(language as SupportedLanguage);
}

function getStoredLanguage() {
  try {
    const language = window.localStorage.getItem(languageStorageKey);
    return language && isSupportedLanguage(language) ? language : "en";
  } catch {
    return "en";
  }
}

function updateDocumentLanguage(language: string) {
  if (typeof document !== "undefined" && isSupportedLanguage(language)) {
    document.documentElement.lang = language;
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pl: { translation: pl } },
  lng: getStoredLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
}).then(() => updateDocumentLanguage(i18n.resolvedLanguage ?? "en"));

i18n.on("languageChanged", updateDocumentLanguage);

export default i18n;
