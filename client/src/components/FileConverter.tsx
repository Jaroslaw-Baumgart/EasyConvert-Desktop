import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./FileConverter.module.css";
import stateStyles from "./PreviewState.module.css";
import panelStyles from "./ConverterPanel.module.css";
import type { ConversionOption, FileConverterProps } from "../types/converter";
import FileUpload from "./FileUpload";
import ConversionOptions from "./ConversionOptions";
import DownloadSection from "./DownloadSection";
import type { ConversionDefinition } from "../config/conversions";
import FilePreview from "./FilePreview";
import { createPreviewData } from "../utils/previewMapper";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { useConversion } from "../hooks/useConversion";
import type { ConversionSettings } from "../schemas/conversionSettings";
import type { ConvertedResult } from "../types/conversionResult";
import { useTranslation } from "react-i18next";

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
    selectFile,
    removeFile,
    convert,
    downloadConvertedFile,
    isPreparingArchive,
    downloadAllConvertedFiles,
  } = useConversion();

  const [hasFormError, setHasFormError] = useState(false);
  const error = conversionError ?? (hasFormError ? t("converter.uploadFirst") : null);

  const previewUrl = useObjectUrl(file);
  const availableOptions = getAvailableOptions(file, conversionOptions);
  const previewData =
    file && previewUrl ? createPreviewData(file, previewUrl) : null;

  const [selectedXlsxSheetName, setSelectedXlsxSheetName] = useState<
    string | undefined | null
  >(null);

  const convertedPreviewRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const previousErrorRef = useRef<string | null>(null);

  const scrollToConvertedPreview = useCallback(() => {
    convertedPreviewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    const isNewError = error !== null && previousErrorRef.current === null;

    previousErrorRef.current = error;

    if (isNewError) {
      errorRef.current?.focus();
    }
  }, [error]);

  const handleFileSelect = (selectedFile: File) => {
    setHasFormError(false);
    selectFile(selectedFile);
    setSelectedXlsxSheetName(null);
  };

  const handleFileRemove = () => {
    setHasFormError(false);
    removeFile();
    setSelectedXlsxSheetName(null);
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

  const handleDownloadBlob = (result: ConvertedResult) => {
    setHasFormError(false);
    downloadConvertedFile(result);
  };

  return (
    <div className={styles["converter-container"]}>
      {file && previewData ? (
        <div className={styles["conversion-workspace"]}>
          <section
            className={`${panelStyles.panel} ${styles["source-preview-section"]}`}
            aria-labelledby="source-preview-heading"
          >
            <h2
              id="source-preview-heading"
              className={panelStyles.heading}
            >
              {t("converter.preview")}
            </h2>

            <div className={styles["preview-file-actions"]}>
              <span className={styles["preview-file-name"]}>{file.name}</span>

              <button
                type="button"
                className={styles["remove-file-btn"]}
                onClick={handleFileRemove}
              >
                {t("converter.remove")}
              </button>
            </div>

            <div className={styles["file-preview"]}>
              <FilePreview
                preview={previewData}
                onXlsxSheetChange={setSelectedXlsxSheetName}
              />
            </div>
          </section>
          <aside className={styles["conversion-sidebar"]}>
            <ConversionOptions
              options={availableOptions}
              onConvert={handleConvert}
              isConverting={isConverting}
              selectedXlsxSheetName={selectedXlsxSheetName}
            />
          </aside>
        </div>
      ) : file ? (
        <p className={stateStyles["loading-message"]} role="status">
          {t("converter.preparing")}
        </p>
      ) : (
        <FileUpload onFileSelect={handleFileSelect} />
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

      {convertedResults && (
        <DownloadSection
          convertedResults={convertedResults}
          onDownload={handleDownloadBlob}
          isPreparingArchive={isPreparingArchive}
          onDownloadAll={downloadAllConvertedFiles}
          previewRef={convertedPreviewRef}
          onPreviewReady={scrollToConvertedPreview}
        />
      )}
    </div>
  );
}
