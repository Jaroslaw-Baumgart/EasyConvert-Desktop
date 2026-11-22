import { useEffect, useId, useRef, useState, type Ref } from "react";
import type {
  ConvertedResult,
  ConvertedResults,
} from "../types/conversionResult";
import FilePreview from "../../preview/components/FilePreview";
import { createPreviewData } from "../../preview/utils/previewMapper";
import styles from "./DownloadSection.module.css";
import panelStyles from "../../../components/ConverterPanel.module.css";
import primaryActionStyles from "../../../components/PrimaryAction.module.css";
import { Check as CheckIcon, Save as DownloadIcon, File as FileIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useObjectUrl } from "../../preview/hooks/useObjectUrl";

interface DownloadSectionProps {
  convertedResults: ConvertedResults;
  onDownload: (result: ConvertedResult, saveAs?: boolean) => Promise<void>;
  onDownloadAll: (saveAs?: boolean) => Promise<void>;
  isPreparingArchive: boolean;
  previewRef?: Ref<HTMLDivElement>;
  onPreviewReady?: () => void;
  isSaving: boolean;
  embedded?: boolean;
}

export default function DownloadSection({
  convertedResults,
  onDownload,
  onDownloadAll,
  isPreparingArchive,
  previewRef,
  onPreviewReady,
  isSaving,
  embedded = false,
}: DownloadSectionProps) {
  const { t } = useTranslation();
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const archiveMenuRef = useRef<HTMLDivElement>(null);
  const archiveMenuId = useId();
  const saveArchive = (saveAs: boolean) => {
    archiveMenuRef.current?.hidePopover();
    void onDownloadAll(saveAs);
  };
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
    <div className={`${embedded ? styles.embedded : panelStyles.panel} ${styles["download-section"]}`}>
      <div className={styles["download-header"]}>
        <div className={styles["download-title"]}>
          <span className={styles["success-icon"]}>
            <CheckIcon />
          </span>
          <div className={styles["result-summary"]}>
            <h2 className={embedded ? styles["result-file-name"] : panelStyles.heading} title={embedded ? activeResult.file.name : undefined}>
              {embedded ? activeResult.file.name : t("download.title")}
            </h2>
            <p className={styles["success-message"]}>
              {t("download.complete")}
            </p>
          </div>
        </div>

        <div className={styles["download-actions"]}>
          <button
            ref={downloadButtonRef}
            type="button"
            disabled={isSaving}
            className={`${primaryActionStyles.button} ${styles["download-btn"]}`}
            onClick={() => void onDownload(activeResult)}
          >
            <DownloadIcon className={primaryActionStyles.icon} />
            {t("download.save")}
          </button>
          <button
            type="button"
            onClick={() => void onDownload(activeResult, true)}
            disabled={isSaving}
          >
            {t("download.saveAs")}
          </button>
          {convertedResults.length > 1 && (
            <>
              <button
                type="button"
                popoverTarget={archiveMenuId}
                className={styles["archive-trigger"]}
                disabled={isPreparingArchive || isSaving}
              >
                {isPreparingArchive ? t("download.preparing") : t("download.all")}
                <span aria-hidden="true"> ▾</span>
              </button>
              <div
                ref={archiveMenuRef}
                id={archiveMenuId}
                popover="auto"
                role="group"
                aria-label={t("download.archiveActions")}
                className={styles["archive-menu"]}
              >
                <button
                  type="button"
                  disabled={isPreparingArchive || isSaving}
                  onClick={() => saveArchive(false)}
                >
                  {t("download.save")}
                </button>
                <button
                  type="button"
                  disabled={isPreparingArchive || isSaving}
                  onClick={() => saveArchive(true)}
                >
                  {t("download.saveAs")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {!embedded && <div className={styles["result-details"]}>
        <FileIcon className={styles["result-file-icon"]} />
        <span className={styles["result-file-name"]} title={activeResult.file.name}>
          {activeResult.file.name}
        </span>
        {targetFormat ? (
          <span className={styles["format-badge"]}>{targetFormat}</span>
        ) : null}
      </div>}
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
