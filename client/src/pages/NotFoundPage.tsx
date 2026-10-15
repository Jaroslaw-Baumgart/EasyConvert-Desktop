import { Link } from "react-router";
import styles from "./PageContent.module.css";
import { useTranslation } from "react-i18next";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <article className={styles["page-content"]}>
      <h1>{t("notFound.title")}</h1>
      <Link to="/">{t("privacy.back")}</Link>
    </article>
  );
}
