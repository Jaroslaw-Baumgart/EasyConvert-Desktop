import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { limitPdfPages, MAX_PDF_PAGES } from "../../pdf/pdfLimits";

describe("PDF output page limit", () => {
  it("allows 500 pages and rejects the next page", () => {
    const document = new EventEmitter();
    limitPdfPages(document as PDFKit.PDFDocument);
    for (let index = 1; index < MAX_PDF_PAGES; index++) document.emit("pageAdded");
    expect(() => document.emit("pageAdded")).toThrow("500-page processing limit");
  });
});
