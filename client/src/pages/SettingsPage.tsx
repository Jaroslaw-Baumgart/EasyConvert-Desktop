import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Check, FolderOpen, Languages, Palette, RotateCcw, Save, Settings } from "lucide-react";
import type { AppSettings } from "../../../shared/desktopContract";
import { isSupportedLanguage } from "../i18n";
import styles from "./SettingsPage.module.css";
import { applySettings } from "../utils/applySettings";

const accents = [
  { value: "blue", swatch: "#2563eb" },
  { value: "purple", swatch: "#7c3aed" },
  { value: "pink", swatch: "#db2777" },
  { value: "red", swatch: "#dc2626" },
  { value: "orange", swatch: "#ea580c" },
  { value: "green", swatch: "#16a34a" },
  { value: "teal", swatch: "#0d9488" },
  { value: "gray", swatch: "#64748b" },
  { value: "black", swatch: "#171717" },
  { value: "white", swatch: "#ffffff" },
] as const;

type Feedback = "saved" | "defaultsReady" | "saveError" | "outputDirectoryError" | "resetError";

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [operation, setOperation] = useState<"save" | "folder" | "reset" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let active = true;
    void window.easyConvert.getSettings().then(
      (settings) => { if (active) setDraft(settings); },
      () => { if (active) setLoadFailed(true); },
    );
    return () => { active = false; };
  }, []);

  if (loadFailed) return <p role="alert">{t("settings.loadError")}</p>;
  if (draft === null) return <p role="status">{t("common.loadingPage")}</p>;
  const isError = feedback === "saveError" || feedback === "outputDirectoryError" || feedback === "resetError";

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <span className={styles.headerIcon}><Settings size={24} aria-hidden="true" /></span>
        <div><h1>{t("settings.title")}</h1><p>{t("settings.description")}</p></div>
      </header>
      <form onChange={() => setFeedback(null)} onSubmit={async (event) => {
        event.preventDefault();
        if (operation !== null) return;
        setOperation("save");
        setFeedback(null);
        try {
          await window.easyConvert.saveSettings(draft);
          await applySettings(draft);
          setFeedback("saved");
        } catch { setFeedback("saveError"); }
        finally { setOperation(null); }
      }}>
        <fieldset className={styles.formBody} disabled={operation !== null}>
          <div className={styles.sections}>
          <section className={styles.card} aria-labelledby="settings-appearance">
            <h2 id="settings-appearance"><Palette size={19} aria-hidden="true" />{t("settings.appearance")}</h2>
            <div className={styles.row}>
              <label htmlFor="settings-theme">{t("settings.theme")}</label>
              <select id="settings-theme" value={draft.theme} onChange={(event) => {
                const theme = event.target.value;
                if (theme === "light" || theme === "dark") setDraft({ ...draft, theme });
              }}>
                <option value="light">{t("settings.themeLight")}</option>
                <option value="dark">{t("settings.themeDark")}</option>
              </select>
            </div>
            <fieldset className={styles.accentField}>
              <legend>{t("settings.accentColor")}</legend>
              <div className={styles.accents}>
                {accents.map(({ value, swatch }) => (
                  <label key={value} className={styles.accent}>
                    <input type="radio" name="accentColor" value={value} checked={draft.accentColor === value}
                      onChange={() => setDraft({ ...draft, accentColor: value })} />
                    <span className={styles.swatch} style={{ backgroundColor: swatch, color: value === "white" ? "#0f172a" : "#fff" }}>
                      {draft.accentColor === value && <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
                    </span>
                    <span>{t(`settings.accents.${value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
          <section className={styles.card} aria-labelledby="settings-language-heading">
            <div className={styles.row}>
              <label id="settings-language-heading" className={styles.settingLabel} htmlFor="settings-language"><Languages size={18} aria-hidden="true" />{t("settings.interfaceLanguage")}</label>
              <select id="settings-language" value={draft.language} onChange={(event) => {
                const language = event.target.value;
                if (isSupportedLanguage(language)) setDraft({ ...draft, language });
              }}>
                <option value="en">{t("settings.languageEnglish")}</option>
                <option value="pl">{t("settings.languagePolish")}</option>
              </select>
            </div>
          </section>
          <section className={styles.card} aria-labelledby="settings-folder-heading">
            <div className={styles.folderSetting}>
            <label id="settings-folder-heading" className={styles.settingLabel} htmlFor="settings-output-directory"><FolderOpen size={18} aria-hidden="true" />{t("settings.outputDirectory")}</label>
            <div>
            <p className={styles.folderLabel}>{t("settings.folderDescription")}</p>
            <div className={styles.folderRow}>
              <input readOnly id="settings-output-directory" value={draft.outputDirectory} title={draft.outputDirectory} />
              <button type="button" onClick={async () => {
                setOperation("folder");
                setFeedback(null);
                try {
                  const directory = await window.easyConvert.selectOutputDirectory();
                  if (directory !== null) setDraft((current) => current && { ...current, outputDirectory: directory });
                } catch { setFeedback("outputDirectoryError"); }
                finally { setOperation(null); }
              }}><FolderOpen size={16} aria-hidden="true" />{t("settings.changeFolder")}</button>
            </div>
            </div>
            </div>
          </section>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.reset} onClick={async () => {
              setOperation("reset");
              setFeedback(null);
              try {
                setDraft(await window.easyConvert.getDefaultSettings());
                setFeedback("defaultsReady");
              } catch { setFeedback("resetError"); }
              finally { setOperation(null); }
            }}><RotateCcw size={16} aria-hidden="true" />{t("settings.factoryDefaults")}</button>
            <div className={styles.saveActions}>
              <button type="button" onClick={() => navigate("/")}>{t("common.cancel")}</button>
              <button type="submit" className={styles.save}><Save size={17} aria-hidden="true" />{operation === "save" ? t("settings.saving") : t("settings.save")}</button>
            </div>
          </div>
        </fieldset>
      </form>
      {feedback && <p role={isError ? "alert" : "status"} className={`${styles.feedback} ${isError ? styles.error : styles.success} ${feedback === "saved" ? styles.savedFeedback : ""}`}>{t(`settings.${feedback}`)}</p>}
    </article>
  );
}
