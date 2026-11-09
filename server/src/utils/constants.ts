import path from "path";

export const OUTPUT_DIR = path.join(__dirname, "../../output");

export const LIBRE_OFFICE_PATH =
  process.env.LIBRE_OFFICE_PATH ||
  path.join(__dirname, "../../../tools/libreoffice/program/soffice.com");

export const LIBRE_OFFICE_TIMEOUT_MS = 2 * 60 * 1000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export { MAX_IMAGE_PIXELS } from "../../../conversion-core/image/imageLimits";
export { MAX_PDF_PAGES } from "../../../conversion-core/pdf/pdfLimits";
export {
  MAX_OFFICE_UNCOMPRESSED_BYTES,
  MAX_OFFICE_ENTRIES,
} from "../../../conversion-core/office/officeLimits";
export const MAX_CSV_ROWS = 10000;
export const MAX_CSV_COLUMNS = 50;
export const MAX_CSV_CELL_CHARACTERS = 50000;
