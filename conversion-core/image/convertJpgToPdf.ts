import type { PdfPageOptions } from "../../shared/conversionOptions";
import { validateImagePixels } from "./imageLimits";
import { writePdf } from "../pdf/writePdf";

export async function convertJpgToPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPageOptions,
): Promise<void> {
  await validateImagePixels(inputPath);
  await writePdf(outputPath, { autoFirstPage: false }, (doc) => {
    doc.addPage({ size: options.pageSize, layout: options.pageOrientation });
    const pageMargin = 36;
    const imageWidth = doc.page.width - pageMargin * 2;
    const imageHeight = doc.page.height - pageMargin * 2;
    doc.image(inputPath, pageMargin, pageMargin, {
      fit: [imageWidth, imageHeight],
      align: "center",
      valign: "center",
    });
  });
}
