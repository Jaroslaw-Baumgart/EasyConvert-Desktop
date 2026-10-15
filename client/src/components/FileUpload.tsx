import { useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  conversions,
  supportedSourceFormats,
  isSupportedSourceFormat,
} from "../config/conversions";
import styles from "./FileUpload.module.css";
import stateStyles from "./PreviewState.module.css";
import panelStyles from "./ConverterPanel.module.css";
import primaryActionStyles from "./PrimaryAction.module.css";
import { useTranslation } from "react-i18next";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const SUPPORTED_FORMATS_LABEL = supportedSourceFormats
  .map((format) => format.toUpperCase())
  .join(", ");

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_FILE_EXTENSIONS = supportedSourceFormats
  .map((format) => `.${format}`)
  .join(",");

const conversionGroups = supportedSourceFormats.map((sourceFormat) => ({
  sourceFormat,
  targetFormats: conversions
    .filter((conversion) => conversion.sourceFormat === sourceFormat)
    .map((conversion) => conversion.targetFormat),
}));

type UploadValidationError = "unsupported" | "tooLarge";

function validateFile(file: File): UploadValidationError | null {
  const lastDotIndex = file.name.lastIndexOf(".");

  const extension =
    lastDotIndex === -1 ? "" : file.name.slice(lastDotIndex + 1).toLowerCase();

  if (!isSupportedSourceFormat(extension)) {
    return "unsupported";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "tooLarge";
  }

  return null;
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<UploadValidationError | null>(null);

  const handleSelectedFile = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(selectedFile);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleSelectedFile(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleSelectedFile(droppedFile);
    }
  };

  return (
    <section
      aria-label={t("upload.label")}
      className={`${panelStyles.panel} ${styles["upload-section"]} ${
        isDragging ? styles.dragging : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label className={primaryActionStyles.button}>
        {t("upload.choose")}
        <input
          type="file"
          className={styles["file-input"]}
          onChange={handleFileChange}
          accept={ACCEPTED_FILE_EXTENSIONS}
        />
      </label>
      <p className={styles["drag-drop-hint"]}>{t("upload.dragHint")}</p>
      <p className={styles["upload-requirements"]}>
        {t("upload.maxSize", { size: MAX_FILE_SIZE_MB })}
      </p>

      <details className={styles["supported-conversions"]}>
        <summary>{t("upload.viewConversions")}</summary>

        <ul>
          {conversionGroups.map(({ sourceFormat, targetFormats }) => (
            <li key={sourceFormat}>
              <strong>{sourceFormat.toUpperCase()}</strong>
              <span>
                →{" "}
                {targetFormats.map((format) => format.toUpperCase()).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {error && (
        <p className={stateStyles["error-message"]} role="alert">
          {error === "unsupported"
            ? t("upload.unsupported", { formats: SUPPORTED_FORMATS_LABEL })
            : t("upload.tooLarge", { size: MAX_FILE_SIZE_MB })}
        </p>
      )}
    </section>
  );
}
