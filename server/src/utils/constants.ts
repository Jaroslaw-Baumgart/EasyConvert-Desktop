import path from "path";

export const OUTPUT_DIR = path.join(__dirname, "../../output");

export const LIBRE_OFFICE_PATH = process.env.LIBRE_OFFICE_PATH || path.join(
  __dirname,
  "../../../tools/libreoffice/program/soffice.com",
);

export const LIBRE_OFFICE_TIMEOUT_MS = 2 * 60 * 1000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_PDF_PAGES = 100;
export const MAX_OFFICE_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_OFFICE_ENTRIES = 2000;
export const MAX_CSV_ROWS = 10000;
export const MAX_CSV_COLUMNS = 50;
export const MAX_CSV_CELL_CHARACTERS = 50000;
