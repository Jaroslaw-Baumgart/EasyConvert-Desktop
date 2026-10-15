import { useEffect, useRef, useState, type Ref } from "react";
import type {
  ConvertedResult,
  ConvertedResults,
} from "../types/conversionResult";
import FilePreview from "./FilePreview";
import { createPreviewData } from "../utils/previewMapper";
import styles from "./DownloadSection.module.css";
import panelStyles from "./ConverterPanel.module.css";
import primaryActionStyles from "./PrimaryAction.module.css";
import { CheckIcon, DownloadIcon, FileIcon } from "./UiIcons";
import { useTranslation } from "react-i18next";
import { useObjectUrl } from "../hooks/useObjectUrl";

interface DownloadSectionProps {
  convertedResults: ConvertedResults;
  onDownload: (result: ConvertedResult) => void;
  onDownloadAll: () => void;
  isPreparingArchive: boolean;
  previewRef?: Ref<HTMLDivElement>;
  onPreviewReady?: () => void;
}

export default function DownloadSection({
  convertedResults,
  onDownload,
  onDownloadAll,
  isPreparingArchive,
  previewRef,
  onPreviewReady,
}: DownloadSectionProps) {
  const { t } = useTranslation();
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const [activeResultUrl, setActiveResultUrl] = useState(
    convertedResults[0].url,
  );

  useEffect(() => {
    downloadButtonRef.current?.focus();
  }, []);

  const activeResult =
    convertedResults.find((result) => result.url === activeResultUrl) ??
    convertedResults[0];

  const previewUrl = useObjectUrl(activeResult.file);
  const previewData = previewUrl
    ? createPreviewData(activeResult.file, previewUrl)
    : null;
  const targetFormat = activeResult.file.name.split(".").pop()?.toUpperCase();

  useEffect(() => {
    if (previewUrl) {
      onPreviewReady?.();
    }
  }, [onPreviewReady, previewUrl]);

  return (
    <div className={`${panelStyles.panel} ${styles["download-section"]}`}>
      <div className={styles["download-header"]}>
        <div className={styles["download-title"]}>
          <span className={styles["success-icon"]}>
            <CheckIcon />
          </span>
          <div>
            <h2 className={panelStyles.heading}>{t("download.title")}</h2>
            <p className={styles["success-message"]}>{t("download.complete")}</p>
          </div>
        </div>

        <div className={styles["download-actions"]}>
          <button
            ref={downloadButtonRef}
            type="button"
            className={`${primaryActionStyles.button} ${styles["download-btn"]}`}
            onClick={() => onDownload(activeResult)}
          >
            <DownloadIcon className={primaryActionStyles.icon} />
            {t("download.file")}
          </button>

          {convertedResults.length > 1 && (
            <button
              type="button"
              onClick={onDownloadAll}
              disabled={isPreparingArchive}
            >
              {isPreparingArchive ? t("download.preparing") : t("download.all")}
            </button>
          )}
        </div>
      </div>
      <div className={styles["result-details"]}>
        <FileIcon className={styles["result-file-icon"]} />
        <span className={styles["result-file-name"]}>{activeResult.file.name}</span>
        {targetFormat ? <span className={styles["format-badge"]}>{targetFormat}</span> : null}
      </div>
      {convertedResults.length > 1 && (
        <div
          className={styles["result-picker"]}
          aria-label={t("download.files")}
        >
          {convertedResults.map((result, index) => (
            <button
              key={result.url}
              type="button"
              aria-pressed={result.url === activeResult.url}
              onClick={() => setActiveResultUrl(result.url)}
            >
              {t("download.page", { index: index + 1 })}
            </button>
          ))}
        </div>
      )}
      {previewData && (
        <div ref={previewRef} data-testid="converted-file-preview">
          <FilePreview preview={previewData} />
        </div>
      )}
    </div>
  );
}
