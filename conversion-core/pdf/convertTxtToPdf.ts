import { readFile } from "node:fs/promises";
import type { PdfPageOptions } from "../../shared/conversionOptions";
import { limitPdfPages } from "./pdfLimits";
import { writePdf } from "./writePdf";

export async function convertTxtToPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPageOptions,
  fontPath: string,
): Promise<void> {
  const text = await readFile(inputPath, "utf8");

  await writePdf(
    outputPath,
    {
      size: options.pageSize,
      layout: options.pageOrientation,
    },
    (doc) => {
      limitPdfPages(doc);
      doc.font(fontPath);
      doc.fontSize(12).text(text, { align: "left" });
    },
  );
}
