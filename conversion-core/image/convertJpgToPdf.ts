import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import type { PdfPageOptions } from "../../shared/conversionOptions";
import { validateImagePixels } from "./imageLimits";

export async function convertJpgToPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPageOptions,
): Promise<void> {
  await validateImagePixels(inputPath);
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.addPage({ size: options.pageSize, layout: options.pageOrientation });
  const pageMargin = 36;
  const imageWidth = doc.page.width - pageMargin * 2;
  const imageHeight = doc.page.height - pageMargin * 2;
  doc.image(inputPath, pageMargin, pageMargin, {
    fit: [imageWidth, imageHeight],
    align: "center",
    valign: "center",
  });

  await new Promise<void>((resolve, reject) => {
    const stream = doc.pipe(createWriteStream(outputPath));
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.end();
  });
}
