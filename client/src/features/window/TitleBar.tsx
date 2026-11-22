import { useTranslation } from "react-i18next";
import { Minus, Square, X } from "lucide-react";
import styles from "./TitleBar.module.css";

export default function TitleBar() {
  const { t } = useTranslation();

  return (
    <div className={styles.bar}>
      <span className={styles.title}>EasyConvert</span>
      <div className={styles.controls}>
      <button
        type="button"
        aria-label={t("windowControls.minimize")}
        onClick={() => {
          void window.easyConvert.minimizeWindow().catch((error: unknown) => {
            console.error("Could not minimize the window.", error);
          });
        }}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("windowControls.maximize")}
        onClick={() => {
          void window.easyConvert
            .toggleMaximizeWindow()
            .catch((error: unknown) => {
              console.error("Could not toggle maximize the window.", error);
            });
        }}
      >
        <Square size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("windowControls.close")}
        onClick={() => {
          void window.easyConvert.closeWindow().catch((error: unknown) => {
            console.error("Could not close the window.", error);
          });
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>
      </div>
    </div>
  );
}
