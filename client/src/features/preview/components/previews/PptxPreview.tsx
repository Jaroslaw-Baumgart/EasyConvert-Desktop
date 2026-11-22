import { useState, useEffect } from "react";
import { getSlides, loadPresentation } from "@office-kit/pptx";
import { renderSlideToSvg } from "@office-kit/pptx-preview";
import styles from "./PptxPreview.module.css";
import stateStyles from "../PreviewState.module.css";
import { useTranslation } from "react-i18next";

export function PptxPreview({ file }: { file: File }) {
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [slideUrls, setSlideUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    let objectUrls: string[] = [];

    const renderPreview = async () => {
      setIsRendering(true);
      setHasError(false);
      setSlideUrls([]);

      try {
        const bytes = await file.arrayBuffer();
        const presentation = await loadPresentation(bytes);
        const slides = getSlides(presentation);

        if (slides.length === 0) {
          throw new Error("Presentation has no slides");
        }

        for (const slide of slides) {
          const svg = renderSlideToSvg(presentation, slide);
          objectUrls.push(URL.createObjectURL(
            new Blob([svg], { type: "image/svg+xml" }),
          ));
        }

        if (active) {
          setSlideUrls(objectUrls);
        } else {
          objectUrls.forEach((url) => URL.revokeObjectURL(url));
        }
      } catch {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls = [];
        if (active) {
          setHasError(true);
        }
      } finally {
        if (active) {
          setIsRendering(false);
        }
      }
    };

    void renderPreview();

    return () => {
      active = false;

      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file]);

  return (
    <div className={styles["pptx-preview"]} data-preview-kind="pptx" aria-busy={isRendering}>
      {isRendering ? <p role="status">{t("preview.pptxLoading")}</p> : null}

      {hasError ? (
        <p className={stateStyles["error-message"]} role="alert">
          {t("preview.pptxError")}
        </p>
      ) : null}
      {slideUrls.map((slideUrl, index) => (
        <img
          key={slideUrl}
          className={styles["pptx-slide-preview"]}
          src={slideUrl}
          alt={t("preview.slideAlt", { index: index + 1 })}
        />
      ))}
    </div>
  );
}
