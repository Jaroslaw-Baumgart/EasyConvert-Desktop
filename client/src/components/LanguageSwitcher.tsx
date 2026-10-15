import { useTranslation } from "react-i18next";
import styles from "./LanguageSwitcher.module.css";
import {
  isSupportedLanguage,
  languageStorageKey,
  type SupportedLanguage,
} from "../i18n";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
    try {
      window.localStorage.setItem(languageStorageKey, language);
    } catch {
      // The interface still works when storage is unavailable.
    }
  };

  return (
    <label className={styles.switcher}>
      <span className={styles.label}>{t("language.label")}</span>
      <select
        value={i18n.resolvedLanguage ?? "en"}
        onChange={(event) => {
          if (isSupportedLanguage(event.target.value)) {
            changeLanguage(event.target.value);
          }
        }}
      >
        <option value="en">{t("language.english")}</option>
        <option value="pl">{t("language.polish")}</option>
      </select>
    </label>
  );
}
