import { useEffect, useRef, useState } from "react";
import styles from "./FileConverter.module.css";
import stateStyles from "../../preview/components/PreviewState.module.css";
import panelStyles from "../../../components/ConverterPanel.module.css";
import type { ConversionOption, FileConverterProps } from "../types/converter";
import FileUpload from "./FileUpload";
import ConversionOptions from "./ConversionOptions";
import DownloadSection from "./DownloadSection";
import type { ConversionDefinition } from "../../../../../shared/conversions";
import FilePreview from "../../preview/components/FilePreview";
import { createPreviewData } from "../../preview/utils/previewMapper";
import { useObjectUrl } from "../../preview/hooks/useObjectUrl";
import { useConversion } from "../hooks/useConversion";
import type { ConversionSettings } from "../schemas/conversionSettings";
import type { ConvertedResult } from "../types/conversionResult";
import { useTranslation } from "react-i18next";
import SaveNotification from "./SaveNotification";
import { FileInput, FileOutput, FileUp, ShieldCheck, Trash2 } from "lucide-react";

function getAvailableOptions(
  file: File | null,
  conversionOptions: readonly ConversionDefinition[],
): ConversionOption[] {
  if (!file) {
    return conversionOptions.map((option) => ({
      ...option,
      disabled: true,
    }));
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  return conversionOptions.map((option) => ({
    ...option,
    disabled: option.sourceFormat !== extension,
  }));
}

export default function FileConverter({
  conversionOptions,
}: FileConverterProps) {
  const { t } = useTranslation();
  const {
    file,
    convertedResults,
    conversionError,
    isConverting,
    isRemoving,
    selectFile,
    removeFile,
    convert,
    cancelConversion,
    downloadConvertedFile,
    isPreparingArchive,
    downloadAllConvertedFiles,
    isSaving,
    saveNotification,
    dismissSaveNotification,
  } = useConversion();

  const [hasFormError, setHasFormError] = useState(false);
  const error =
    conversionError ?? (hasFormError ? t("converter.uploadFirst") : null);

  const previewUrl = useObjectUrl(file);
  const availableOptions = getAvailableOptions(file, conversionOptions);
  const previewData =
    file && previewUrl ? createPreviewData(file, previewUrl) : null;

  const [selectedXlsxSheetName, setSelectedXlsxSheetName] = useState<
    string | undefined | null
  >(null);

  const [sourceForResults, setSourceForResults] = useState<typeof convertedResults>(null);
  const showResults = Boolean(convertedResults && sourceForResults !== convertedResults);
  const errorRef = useRef<HTMLDivElement>(null);
  const previousErrorRef = useRef<string | null>(null);

  useEffect(() => {
    const isNewError = error !== null && previousErrorRef.current === null;

    previousErrorRef.current = error;

    if (isNewError) {
      errorRef.current?.focus();
    }
  }, [error]);

  const handleFileSelect = (selectedFile: File, sourceId?: string) => {
    setSourceForResults(null);
    setHasFormError(false);
    selectFile(selectedFile, sourceId);
    setSelectedXlsxSheetName(null);
  };

  const handleFileRemove = (): void => {
    setHasFormError(false);
    void removeFile();
  };

  const handleConvert = async (
    option: ConversionOption,
    settings?: ConversionSettings,
  ) => {
    if (!file) {
      setHasFormError(true);
      return;
    }

    setHasFormError(false);
    await convert(option, settings);
  };

  const handleDownloadBlob = async (
    result: ConvertedResult,
    saveAs = false,
  ): Promise<void> => {
    setHasFormError(false);
    await downloadConvertedFile(result, saveAs);
  };

  return (
    <div className={styles["converter-container"]}>
      {file && previewData ? (
        <div className={styles["conversion-workspace"]}>
          <section
            className={`${panelStyles.panel} ${styles["source-preview-section"]}`}
            aria-labelledby="source-preview-heading"
          >
            <div className={styles["preview-switcher"]} role="group" aria-label={t("workspace.previewLabel")}>
              <button type="button" aria-pressed={!showResults} onClick={() => setSourceForResults(convertedResults)}>
                <FileInput size={16} aria-hidden="true" />{t("workspace.source")}
              </button>
              <button type="button" aria-pressed={showResults} disabled={!convertedResults} onClick={() => setSourceForResults(null)}>
                <FileOutput size={16} aria-hidden="true" />{t("workspace.result")}
              </button>
              <button
                type="button"
                className={styles["remove-file-btn"]}
                onClick={handleFileRemove}
                disabled={
                  isRemoving ||
                  isSaving ||
                  (window.easyConvert?.platform === "desktop" && isConverting)
                }
              >
                <Trash2 size={15} aria-hidden="true" />{t("converter.remove")}
              </button>
            </div>
            <h2 id="source-preview-heading" className={styles["visually-hidden"]}>{t("workspace.previewLabel")}</h2>
            <div className={styles["source-body"]} hidden={showResults}>

            <div className={styles["preview-file-actions"]}>
              <div className={styles["file-details"]}>
                <span className={styles["preview-file-name"]} title={file.name}>{file.name}</span>
                <span className={styles.metadata}>{file.name.split(".").pop()?.toUpperCase()}{" \u00b7 "}{new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(file.size / 1_000_000)} MB</span>
              </div>


            </div>

            <div className={styles["file-preview"]}>
              <FilePreview
                preview={previewData}
                onXlsxSheetChange={setSelectedXlsxSheetName}
              />
            </div>
            </div>
            {showResults && convertedResults && (
              <DownloadSection
                convertedResults={convertedResults}
                onDownload={handleDownloadBlob}
                isPreparingArchive={isPreparingArchive}
                onDownloadAll={downloadAllConvertedFiles}
                isSaving={isSaving}
                embedded
              />
            )}
          </section>
          <aside
            className={styles["conversion-sidebar"]}
            inert={isRemoving || isSaving}
          >
            <ConversionOptions
              options={availableOptions}
              onConvert={handleConvert}
              isConverting={isConverting}
              selectedXlsxSheetName={selectedXlsxSheetName}
            >
              {isConverting && (
                <button
                  type="button"
                  className={styles["cancel-conversion-btn"]}
                  onClick={cancelConversion}
                >
                  {t("common.cancel")}
                </button>
              )}
            </ConversionOptions>
          </aside>
        </div>
      ) : file ? (
        <p className={stateStyles["loading-message"]} role="status">
          {t("converter.preparing")}
        </p>
      ) : (
        <div className={styles["start-screen"]}>
          <FileUp size={38} strokeWidth={1.5} className={styles["start-icon"]} aria-hidden="true" />
          <h1>{t("workspace.chooseFile")}</h1>
          <FileUpload onFileSelect={handleFileSelect} />
          <p className={styles["local-note"]}><ShieldCheck size={16} aria-hidden="true" />{t("workspace.local")}</p>
        </div>
      )}

      {error && (
        <div
          ref={errorRef}
          className={stateStyles["error-message"]}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      )}

      {saveNotification && (
        <SaveNotification
          notification={saveNotification}
          onClose={dismissSaveNotification}
          onShowInFolder={() => window.easyConvert.showLastSavedFile()}
        />
      )}
    </div>
  );
}
