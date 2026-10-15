import { useEffect, useState } from "react";
import styles from "./ImagePreview.module.css";
import stateStyles from "../PreviewState.module.css";
import { useTranslation } from "react-i18next";

export function ImagePreview({ url }: { url: string }) {
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <p className={stateStyles["error-message"]} role="alert">
        {t("preview.imageError")}
      </p>
    );
  }

  return (
    <img
      src={url}
      alt={t("preview.imageAlt")}
      onError={() => setHasError(true)}
      className={styles["preview-image"]}
      data-preview-kind="image"
    />
  );
}
