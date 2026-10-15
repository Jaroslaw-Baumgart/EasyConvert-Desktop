import * as XLSX from "xlsx";
import { Unzip, UnzipInflate } from "fflate";

export const XLSX_PREVIEW_ROW_LIMIT = 100;
export const XLSX_PREVIEW_SHEET_LIMIT = 20;
export const XLSX_PREVIEW_COLUMN_LIMIT = 50;
export const XLSX_PREVIEW_CELL_LIMIT = 100_000;
export const XLSX_PREVIEW_ARCHIVE_ENTRY_LIMIT = 500;
export const XLSX_PREVIEW_UNCOMPRESSED_SIZE_LIMIT = 50 * 1024 * 1024;

export type XlsxSheet = {
  name: string;
  rows: string[][];
  totalRows?: number;
};

const ZIP_END_OF_CENTRAL_DIRECTORY = 0x0605_4b50;
const ZIP_CENTRAL_DIRECTORY_ENTRY = 0x0201_4b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const ZIP_CENTRAL_DIRECTORY_ENTRY_SIZE = 46;
const ZIP_VALIDATION_CHUNK_SIZE = 64 * 1024;

export function validateXlsxArchive(
  buffer: ArrayBuffer,
  uncompressedSizeLimit = XLSX_PREVIEW_UNCOMPRESSED_SIZE_LIMIT,
) {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < ZIP_END_OF_CENTRAL_DIRECTORY_SIZE) {
    throw new Error("Invalid XLSX archive.");
  }

  const view = new DataView(buffer);
  const searchStart = Math.max(
    0,
    bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_SIZE - 0xffff,
  );
  let endOfDirectoryOffset = -1;

  for (
    let offset = bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_SIZE;
    offset >= searchStart;
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      endOfDirectoryOffset = offset;
      break;
    }
  }

  if (endOfDirectoryOffset === -1) {
    throw new Error("Invalid XLSX archive.");
  }

  const entryCount = view.getUint16(endOfDirectoryOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOfDirectoryOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(
    endOfDirectoryOffset + 16,
    true,
  );

  if (entryCount > XLSX_PREVIEW_ARCHIVE_ENTRY_LIMIT) {
    throw new Error("XLSX archive has too many files to preview.");
  }
  if (centralDirectoryOffset + centralDirectorySize > endOfDirectoryOffset) {
    throw new Error("Invalid XLSX archive directory.");
  }

  let offset = centralDirectoryOffset;
  let uncompressedSize = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + ZIP_CENTRAL_DIRECTORY_ENTRY_SIZE > bytes.length ||
      view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_ENTRY
    ) {
      throw new Error("Invalid XLSX archive entry.");
    }

    uncompressedSize += view.getUint32(offset + 24, true);
    if (uncompressedSize > uncompressedSizeLimit) {
      throw new Error("XLSX file is too large to preview.");
    }

    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset +=
      ZIP_CENTRAL_DIRECTORY_ENTRY_SIZE +
      fileNameLength +
      extraLength +
      commentLength;
  }

  let extractedSize = 0;
  const unzip = new Unzip((file) => {
    file.ondata = (error, data) => {
      if (error) {
        throw error;
      }

      extractedSize += data.length;
      if (extractedSize > uncompressedSizeLimit) {
        file.terminate();
        throw new Error("XLSX file is too large to preview.");
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);

  for (let offset = 0; offset < bytes.length; offset += ZIP_VALIDATION_CHUNK_SIZE) {
    const end = Math.min(offset + ZIP_VALIDATION_CHUNK_SIZE, bytes.length);
    unzip.push(bytes.subarray(offset, end), end === bytes.length);
  }
}

export function parseXlsxBuffer(buffer: ArrayBuffer): XlsxSheet[] {
  validateXlsxArchive(buffer);
  const workbook = XLSX.read(buffer, { type: "array" });

  if (workbook.SheetNames.length > XLSX_PREVIEW_SHEET_LIMIT) {
    throw new Error("XLSX file has too many sheets to preview.");
  }

  let previewCellCount = 0;

  return workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const range = worksheet["!ref"]
      ? XLSX.utils.decode_range(worksheet["!ref"])
      : undefined;
    const columnCount = range ? range.e.c - range.s.c + 1 : 0;
    const totalRows = range ? range.e.r - range.s.r + 1 : 0;

    if (columnCount > XLSX_PREVIEW_COLUMN_LIMIT) {
      throw new Error("XLSX sheet has too many columns to preview.");
    }

    previewCellCount +=
      Math.min(totalRows, XLSX_PREVIEW_ROW_LIMIT) * columnCount;
    if (previewCellCount > XLSX_PREVIEW_CELL_LIMIT) {
      throw new Error("XLSX preview exceeds processing limits.");
    }

    const previewRange = range && {
      s: range.s,
      e: {
        r: Math.min(range.e.r, range.s.r + XLSX_PREVIEW_ROW_LIMIT - 1),
        c: range.e.c,
      },
    };
    const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      range: previewRange,
    });

    return {
      name,
      rows,
      totalRows,
    };
  });
}
