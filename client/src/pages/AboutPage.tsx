import { Link } from "react-router";
import { conversions } from "../config/conversions";
import styles from "./PageContent.module.css";
import { Trans, useTranslation } from "react-i18next";

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <article className={styles["page-content"]}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("about.eyebrow")}</p>
        <h1>{t("about.title")}</h1>
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
    </article>
  );
}
