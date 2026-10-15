import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { limitPdfPages } from "./pdfLimits";
import { MAX_PDF_PAGES } from "./constants";

describe("PDF output page limit", () => {
  it("stops processing before an excessive number of pages is generated", () => {
    const document = new EventEmitter();
    limitPdfPages(document as PDFKit.PDFDocument);
    for (let index = 1; index < MAX_PDF_PAGES; index++) document.emit("pageAdded");
    expect(() => document.emit("pageAdded")).toThrow("processing limit");
  });
});
