import { parseXlsxFile, type XlsxSheet } from "../../utils/xlsx";
import { useState, useEffect } from "react";
import styles from "./XlsxPreview.module.css";
import tableStyles from "./DataTable.module.css";
import stateStyles from "../PreviewState.module.css";
import { useTranslation } from "react-i18next";

function XlsxSheetPreview({
  sheet,
  showName,
}: {
  sheet: XlsxSheet;
  showName: boolean;
}) {
  const { t } = useTranslation();
  const previewRows = sheet.rows;
  const columnCount = sheet.rows[0]?.length ?? 0;
  const totalRows = sheet.totalRows ?? sheet.rows.length;

  return (
    <section className={styles["xlsx-sheet-preview"]}>
      {showName && <h3>{sheet.name}</h3>}

      <div
        className={tableStyles["scroll-container"]}
        data-preview-kind="xlsx"
      >
        {sheet.rows.length === 0 ? (
          <p>{t("preview.sheetEmpty")}</p>
        ) : (
          <table className={tableStyles.table}>
            <thead>
              <tr>
                {Array.from({ length: columnCount }, (_, columnIndex) => (
                  <th key={columnIndex} scope="col">
                    {getColumnLabel(columnIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: columnCount }, (_, columnIndex) => (
                    <td key={columnIndex}>{row[columnIndex] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalRows > previewRows.length && (
        <p>
          {t("preview.showingRows", { shown: previewRows.length, total: totalRows })}
        </p>
      )}
    </section>
  );
}

export function XlsxPreview({
  file,
  onXlsxSheetChange,
}: {
  file: File;
  onXlsxSheetChange?: (sheetName: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [sheets, setSheets] = useState<XlsxSheet[]>([]);
  const [hasError, setHasError] = useState(false);
  const [isParsing, setIsParsing] = useState(true);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [isAllSheetsSelected, setIsAllSheetsSelected] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setIsParsing(true);
    setHasError(false);

    parseXlsxFile(file, controller.signal)
      .then((parsedSheets) => {
        if (!active) return;
        const initialSheetName = parsedSheets[0]?.name ?? "";

        setSheets(parsedSheets);
        setSelectedSheetName(initialSheetName);
        setIsAllSheetsSelected(false);
        onXlsxSheetChange?.(initialSheetName);
      })
      .catch(() => {
        if (!active) return;
        setHasError(true);
      })
      .finally(() => {
        if (!active) return;
        setIsParsing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [file, onXlsxSheetChange]);

  if (isParsing) {
    return <p role="status">{t("preview.xlsxLoading")}</p>;
  }

  if (hasError) {
    return (
      <p className={stateStyles["error-message"]} role="alert">
        {t("preview.xlsxError")}
      </p>
    );
  }

  const selectedSheet = sheets.find(
    (sheet) => sheet.name === selectedSheetName,
  );

  const previewSheets = isAllSheetsSelected
    ? sheets
    : selectedSheet
      ? [selectedSheet]
      : [];

  return (
    <div className={styles["xlsx-preview"]}>
      <div className={styles["xlsx-sheet-picker"]}>
        <span className={styles["xlsx-sheet-label"]}>{t("preview.sheet")}</span>
        <div className={styles["xlsx-sheet-buttons"]} role="group" aria-label={t("preview.sheets")}>
          {sheets.map((sheet) => (
            <button
              key={sheet.name}
              type="button"
              className={styles["xlsx-sheet-button"]}
              value={sheet.name}
              aria-pressed={
                !isAllSheetsSelected && sheet.name === selectedSheetName
              }
              onClick={() => {
                setIsAllSheetsSelected(false);
                setSelectedSheetName(sheet.name);
                onXlsxSheetChange?.(sheet.name);
              }}
            >
              {sheet.name}
            </button>
          ))}
          <button
            type="button"
            className={`${styles["xlsx-sheet-button"]} ${styles["xlsx-all-sheet-button"]}`}
            aria-pressed={isAllSheetsSelected}
            onClick={() => {
              setIsAllSheetsSelected(true);
              onXlsxSheetChange?.(undefined);
            }}
          >
            {t("preview.allSheets")}
          </button>
        </div>
      </div>
      {!isAllSheetsSelected && (
        <p className={styles["xlsx-dependency-notice"]} role="note">
          {t("preview.dependency")}
        </p>
      )}
      {previewSheets.map((sheet) => (
        <XlsxSheetPreview
          key={sheet.name}
          sheet={sheet}
          showName={isAllSheetsSelected}
        />
      ))}
      <p className={styles["xlsx-chart-notice"]} role="note">
        {t("preview.charts")}
      </p>
    </div>
  );
}

function getColumnLabel(index: number): string {
  let label = "";

  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(((value - 1) % 26) + 65) + label;
  }

  return label;
}
