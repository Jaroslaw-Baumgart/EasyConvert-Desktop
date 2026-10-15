import { NavLink, Outlet, useLocation } from "react-router";
import styles from "./AppLayout.module.css";
import ErrorBoundary from "../components/ErrorBoundary";
import { Suspense } from "react";
import ConverterLogo from "../components/ConverterLogo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className={styles["app-container"]}>
      <nav aria-label={t("navigation.label")} className={styles["app-nav"]}>
        <NavLink to="/" className={styles["brand-link"]}>
          <ConverterLogo />
          <span>{t("navigation.converter")}</span>
        </NavLink>

        <div className={styles["nav-tools"]}>
          <div className={styles["nav-links"]}>
            <NavLink to="/about" className={styles["nav-link"]}>
              {t("navigation.about")}
            </NavLink>
            <NavLink to="/privacy" className={styles["nav-link"]}>
              {t("navigation.privacy")}
            </NavLink>
          </div>
          <LanguageSwitcher />
        </div>
      </nav>
      <main>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<p role="status">{t("common.loadingPage")}</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
