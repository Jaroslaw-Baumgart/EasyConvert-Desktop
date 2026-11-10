import type {
  PdfPageOptions,
  PngToJpgOptions,
  XlsxToPdfOptions,
} from "./conversionOptions";

type WorkerPaths = {
  inputPath: string;
  outputPath: string;
};

export type WorkerConversionRequest = WorkerPaths &
  (
    | { conversion: "jpg-to-png" }
    | {
        conversion: "png-to-jpg";
        options: PngToJpgOptions;
      }
    | {
        conversion: "jpg-to-pdf";
        options: PdfPageOptions;
      }
    | { conversion: "pdf-to-jpg"; binDirectory: string }
    | { conversion: "pdf-to-txt"; binDirectory: string }
    | { conversion: "docx-to-pdf"; executablePath: string }
    | { conversion: "pptx-to-pdf"; executablePath: string }
    | {
        conversion: "txt-to-pdf";
        options: PdfPageOptions;
        fontPath: string;
      }
    | {
        conversion: "csv-to-pdf";
        options: PdfPageOptions;
        regularFontPath: string;
        boldFontPath: string;
      }
    | {
        conversion: "xlsx-to-pdf";
        options: XlsxToPdfOptions;
        executablePath: string;
      }
  );
