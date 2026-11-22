import { useEffect, useState } from "react";
import { Link } from "react-router";
import { conversions } from "../../../shared/conversions";
import styles from "./PageContent.module.css";
import { Trans, useTranslation } from "react-i18next";

export default function AboutPage() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function loadVersion() {
      try {
        const value = await window.easyConvert.getAppVersion();
        if (active) setVersion(value);
      } catch {
        if (active) setVersion(null);
      }
    }
    void loadVersion();
    return () => { active = false; };
  }, []);
  return (
    <article className={styles["page-content"]}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("about.eyebrow")}</p>
        <h1>{t("about.title")}</h1>
        <p className={styles.eyebrow}>{version ? t("about.version", { version }) : t("about.versionUnavailable")}</p>
        <p className={styles.lead}>{t("about.lead")}</p>
        <Link to="/" className={styles["primary-link"]}>
          {t("about.open")}
        </Link>
      </header>

      <section className={styles.card} aria-labelledby="about-how-it-works">
        <h2 id="about-how-it-works">{t("about.howTitle")}</h2>

        <ol className={styles.steps}>
          <li>{t("about.step1")}</li><li>{t("about.step2")}</li><li>{t("about.step3")}</li><li>{t("about.step4")}</li>
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="about-conversions">
        <h2 id="about-conversions">{t("about.conversionsTitle")}</h2>

        <ul className={styles["conversion-list"]}>
          {conversions.map((conversion) => (
            <li key={conversion.conversionType}>
              {conversion.sourceFormat.toUpperCase()}
              <span aria-hidden="true">→</span>
              {conversion.targetFormat.toUpperCase()}
            </li>
          ))}
        </ul>

        <p>
          {t("about.conversionsText")}
        </p>
      </section>

      <section className={styles.card} aria-labelledby="about-previews">
        <h2 id="about-previews">{t("about.previewsTitle")}</h2>

        <p>
          {t("about.previewsText")}
        </p>
      </section>

      <section className={styles.card} aria-labelledby="about-settings">
        <h2 id="about-settings">{t("about.settingsTitle")}</h2>

        <ul>
          <li>{t("about.setting1")}</li><li>{t("about.setting2")}</li><li>{t("about.setting3")}</li>
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="about-files">
        <h2 id="about-files">{t("about.filesTitle")}</h2>

        <p><Trans i18nKey="about.filesText" components={{ privacyLink: <Link to="/privacy" /> }} /></p>
      </section>

      <section className={styles.card} aria-labelledby="about-author">
        <h2 id="about-author">{t("about.authorTitle")}</h2>
        <p>{t("about.authorText")}</p>
        <div className={styles["author-links"]}>
          <a
            href="https://github.com/Jaroslaw-Baumgart"
            target="_blank"
            rel="noopener noreferrer"
            className={styles["secondary-link"]}
          >
            {t("about.authorGithub")}
          </a>
        </div>
      </section>
    </article>
  );
}
