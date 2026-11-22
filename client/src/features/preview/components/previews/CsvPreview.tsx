import { useState, useEffect } from "react";
import { parseCsvFile, type CsvRow } from "../../utils/csv";
import tableStyles from "./DataTable.module.css";
import stateStyles from "../PreviewState.module.css";
import { useTranslation } from "react-i18next";

export function CsvPreview({ file }: { file: File }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [hasError, setHasError] = useState(false);
  const [isParsing, setIsParsing] = useState(true);

  useEffect(() => {
    let active = true;
    setIsParsing(true);
    setHasError(false);
    setRows([]);

    parseCsvFile(file)
      .then((parsedRows) => {
        if (active) {
          setRows(parsedRows);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsParsing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [file]);

  if (isParsing) {
    return (
      <p className={stateStyles["loading-message"]} role="status" aria-live="polite">
        {t("preview.csvLoading")}
        <span className={stateStyles["loading-dots"]} aria-hidden="true" />
      </p>
    );
  }

  if (hasError) {
    return (
      <p className={stateStyles["error-message"]} role="alert">
        {t("preview.csvError")}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className={stateStyles["error-message"]} role="status">
        {t("preview.csvEmpty")}
      </p>
    );
  }

  const previewRows = rows.slice(0, 100);
  const headers = Object.keys(rows[0]);
  return (
    <div
      className={tableStyles["scroll-container"]}
      data-preview-kind="csv"
    >
      <table className={tableStyles.table}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header) => (
                <td key={header} title={row[header]}>
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > previewRows.length && (
        <p>
          {t("preview.showingRows", { shown: previewRows.length, total: rows.length })}
        </p>
      )}
    </div>
  );
}
