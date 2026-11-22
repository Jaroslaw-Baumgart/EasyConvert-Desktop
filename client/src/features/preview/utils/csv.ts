import Papa from "papaparse";

export type CsvRow = Record<string, string>;

export function parseCsvFile(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,

      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error("Invalid CSV data."));
          return;
        }

        resolve(result.data);
      },

      error: () => {
        reject(new Error("Invalid CSV data."));
      },
    });
  });
}
