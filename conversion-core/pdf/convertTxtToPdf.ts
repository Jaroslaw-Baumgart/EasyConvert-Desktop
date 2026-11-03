import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import type { PdfPageOptions } from "../../shared/conversionOptions";
import { limitPdfPages } from "./pdfLimits";

export async function convertTxtToPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPageOptions,
  fontPath: string,
): Promise<void> {
  const text = await readFile(inputPath, "utf8");

  const doc = new PDFDocument({
    size: options.pageSize,
    layout: options.pageOrientation,
  });
  limitPdfPages(doc);
  doc.font(fontPath);
  doc.fontSize(12).text(text, { align: "left" });
  await new Promise<void>((resolve, reject) => {
    const stream = doc.pipe(createWriteStream(outputPath));
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.end();
  });
}
