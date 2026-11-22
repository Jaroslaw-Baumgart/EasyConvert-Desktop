import { useState, useEffect } from "react";
import { readFileAsText } from "../../utils/fileUtils";
import styles from "./TextPreview.module.css";
import stateStyles from "../PreviewState.module.css";
import { useTranslation } from "react-i18next";

export function TextPreview({ file }: { file: File }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setHasError(false);
    setText("");

    readFileAsText(file)
      .then((content) => {
        if (active) {
          setText(content);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [file]);

  if (isLoading) {
    return (
      <p className={stateStyles["loading-message"]} role="status">
        {t("preview.textLoading")}
      </p>
    );
  }

  if (hasError) {
    return (
      <p className={stateStyles["error-message"]} role="alert">
        {t("preview.textError")}
      </p>
    );
  }

  return (
    <textarea
      readOnly
      aria-label={t("preview.label")}
      value={text}
      className={styles["text-preview"]}
      data-preview-kind="text"
    />
  );
}
