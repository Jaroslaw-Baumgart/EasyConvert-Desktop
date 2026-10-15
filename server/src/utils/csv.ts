import Papa from "papaparse";
import {
  MAX_CSV_CELL_CHARACTERS,
  MAX_CSV_COLUMNS,
  MAX_CSV_ROWS,
} from "./constants";

export type CsvRow = Record<string, string>;

export class CsvLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvLimitError";
  }
}

export function parseCsv(csvText: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let parseError: Error | undefined;

  Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    step: (result, parser) => {
      if (result.errors.length > 0) {
        parseError = new Error("Invalid CSV data.");
        parser.abort();
        return;
      }

      const headers = result.meta.fields ?? [];
      if (headers.length > MAX_CSV_COLUMNS) {
        parseError = new CsvLimitError(
          `CSV exceeds processing limits (${MAX_CSV_ROWS} rows, ${MAX_CSV_COLUMNS} columns).`,
        );
        parser.abort();
        return;
      }
      if (headers.some((header) => header.length > MAX_CSV_CELL_CHARACTERS)) {
        parseError = new CsvLimitError(
          `CSV cell exceeds the ${MAX_CSV_CELL_CHARACTERS}-character processing limit.`,
        );
        parser.abort();
        return;
      }
      if (rows.length >= MAX_CSV_ROWS) {
        parseError = new CsvLimitError(
          `CSV exceeds processing limits (${MAX_CSV_ROWS} rows, ${MAX_CSV_COLUMNS} columns).`,
        );
        parser.abort();
        return;
      }

      if (
        Object.values(result.data).some(
          (value) => value.length > MAX_CSV_CELL_CHARACTERS,
        )
      ) {
        parseError = new CsvLimitError(
          `CSV cell exceeds the ${MAX_CSV_CELL_CHARACTERS}-character processing limit.`,
        );
        parser.abort();
        return;
      }

      rows.push(result.data);
    },
  });

  if (parseError) {
    throw parseError;
  }

  return rows;
}
