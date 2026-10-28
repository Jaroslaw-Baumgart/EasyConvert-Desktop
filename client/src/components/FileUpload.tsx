import { useRef, useState } from "react";
import type { DragEvent } from "react";
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
import { selectDesktopSource } from "../api/desktopSource";

interface FileUploadProps {
  onFileSelect: (file: File, sourceId?: string) => void;
}

const SUPPORTED_FORMATS_LABEL = supportedSourceFormats
  .map((format) => format.toUpperCase())
  .join(", ");

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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
  const selectionPendingRef = useRef(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const handleSelectedFile = (selectedFile: File, sourceId?: string) => {
    const validationError = validateFile(selectedFile);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(selectedFile, sourceId);
  };

  const handleNativeSelect = async (): Promise<void> => {
    if (selectionPendingRef.current) {
      return;
    }

    selectionPendingRef.current = true;
    setIsSelecting(true);
    setSelectionError(null);

    try {
      const result = await selectDesktopSource(window.easyConvert);

      if (!result) {
        return;
      }

      handleSelectedFile(result.file, result.source.sourceId);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Could not select a file.",
      );
    } finally {
      selectionPendingRef.current = false;
      setIsSelecting(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault();
    setIsDragging(false);
    if (selectionPendingRef.current || e.dataTransfer.files.length !== 1) {
      return;
    }
    const droppedFile = e.dataTransfer.files[0];
    const validationError = validateFile(droppedFile);

    if (validationError) {
      setError(validationError);
      return;
    }

    selectionPendingRef.current = true;
    setIsSelecting(true);
    setError(null);
    setSelectionError(null);

    try {
      const source = await window.easyConvert.selectDroppedSource(droppedFile);
      handleSelectedFile(droppedFile, source.sourceId);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Could not select a file.",
      );
    } finally {
      selectionPendingRef.current = false;
      setIsSelecting(false);
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
      <button
        type="button"
        className={primaryActionStyles.button}
        disabled={isSelecting}
        onClick={() => void handleNativeSelect()}
      >
        {t("upload.choose")}
      </button>
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
      {selectionError && (
        <p className={stateStyles["error-message"]} role="alert">
          {selectionError}
        </p>
      )}
    </section>
  );
}
