import { Link } from "react-router";
import styles from "./PageContent.module.css";
import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <article className={styles["page-content"]}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("privacy.eyebrow")}</p>
        <h1>{t("privacy.title")}</h1>
        <p className={styles.lead}>{t("privacy.lead")}</p>
      </header>

      <section className={styles.card} aria-labelledby="privacy-processing">
        <h2 id="privacy-processing">{t("privacy.processingTitle")}</h2>

        <p>
          {t("privacy.processingText")}
        </p>
      </section>

      <section className={styles.card} aria-labelledby="privacy-storage">
        <h2 id="privacy-storage">{t("privacy.storageTitle")}</h2>

        <ul>
          <li>{t("privacy.storage1")}</li><li>{t("privacy.storage2")}</li><li>{t("privacy.storage3")}</li><li>{t("privacy.storage4")}</li>
        </ul>
      </section>

      <section
        className={`${styles.card} ${styles.notice}`}
        aria-labelledby="privacy-sensitive-files"
      >
        <h2 id="privacy-sensitive-files">{t("privacy.sensitiveTitle")}</h2>

        <p>
          {t("privacy.sensitiveText")}
        </p>
      </section>

      <Link to="/" className={styles["secondary-link"]}>
        {t("privacy.back")}
      </Link>
    </article>
  );
}
