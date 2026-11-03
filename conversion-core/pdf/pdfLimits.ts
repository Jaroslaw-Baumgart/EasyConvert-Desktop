export const MAX_PDF_PAGES = 100;

export function limitPdfPages(document: PDFKit.PDFDocument) {
  let pages = 1;
  document.on?.("pageAdded", () => {
    if (++pages > MAX_PDF_PAGES) {
      throw new Error(
        `PDF output exceeds the ${MAX_PDF_PAGES}-page processing limit.`,
      );
    }
  });
}
