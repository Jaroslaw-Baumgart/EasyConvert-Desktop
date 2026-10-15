import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import styles from "./WordPreview.module.css";
import stateStyles from "../PreviewState.module.css";
import { useTranslation } from "react-i18next";

export function WordPreview({ file }: { file: File }) {
  const { t } = useTranslation();
  const previewRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!previewRef.current) {
      return;
    }

    const container = previewRef.current;
    let active = true;

    setIsRendering(true);
    setHasError(false);

    renderAsync(file, container)
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsRendering(false);
        }
      });

    return () => {
      active = false;
    };
  }, [file]);

  return (
    <div className={styles["word-preview"]} data-preview-kind="word" aria-busy={isRendering}>
      {isRendering ? <p role="status">{t("preview.wordLoading")}</p> : null}

      {hasError ? (
        <p className={stateStyles["error-message"]} role="alert">
          {t("preview.wordError")}
        </p>
      ) : null}

      <div ref={previewRef} data-testid="docx-preview" />
    </div>
  );
}
