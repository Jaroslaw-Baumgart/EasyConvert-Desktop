import { describe, expect, it } from "vitest";
import type { WorkerConversionRequest } from "../../shared/workerContract";
import { parseWorkerRequest } from "../worker/parseWorkerRequest";

const paths = { inputPath: "C:/input/source", outputPath: "C:/output/result" };
const page = { pageSize: "A3", pageOrientation: "landscape" } as const;
const requests: WorkerConversionRequest[] = [
  { ...paths, conversion: "jpg-to-png" },
  { ...paths, conversion: "png-to-jpg", options: { quality: 72, backgroundColor: "#123456" } },
  { ...paths, conversion: "jpg-to-pdf", options: page },
  { ...paths, conversion: "pdf-to-jpg", binDirectory: "C:/tools/poppler/bin" },
  { ...paths, conversion: "pdf-to-txt", binDirectory: "C:/tools/poppler/bin" },
  { ...paths, conversion: "docx-to-pdf", executablePath: "C:/tools/soffice.com" },
  { ...paths, conversion: "pptx-to-pdf", executablePath: "C:/tools/soffice.com" },
  { ...paths, conversion: "txt-to-pdf", options: page, fontPath: "C:/fonts/regular.ttf" },
  { ...paths, conversion: "csv-to-pdf", options: page, regularFontPath: "C:/fonts/regular.ttf", boldFontPath: "C:/fonts/bold.ttf" },
  { ...paths, conversion: "xlsx-to-pdf", options: { ...page, sheetName: " Łódź & Koszty " }, executablePath: "C:/tools/soffice.com" },
];

describe("parseWorkerRequest", () => {
  it.each(requests)("parses $conversion and keeps only its allowed fields", (request) => {
    const input = {
      ...request,
      sourceId: "not-needed-by-worker",
      extra: true,
      ...("options" in request ? { options: { ...request.options, extra: true } } : {}),
    };
    const result = parseWorkerRequest(input);
    expect(result).toEqual(request);
    expect(result).not.toBe(input);
    if ("options" in result && "options" in input) {
      expect(result.options).not.toBe(input.options);
    }
  });

  it("accepts XLSX without a sheet selection", () => {
    expect(parseWorkerRequest({ ...paths, conversion: "xlsx-to-pdf", options: page, executablePath: "soffice.com" }))
      .toEqual({ ...paths, conversion: "xlsx-to-pdf", options: page, executablePath: "soffice.com" });
  });

  it.each([null, undefined, [], "request", 42])("rejects non-object input %j", (value) => {
    expect(() => parseWorkerRequest(value)).toThrow("Expected a worker request object.");
  });

  it.each(["inputPath", "outputPath", "conversion"])("rejects missing or invalid %s", (field) => {
    const valid = { ...paths, conversion: "jpg-to-png" };
    const missing: Record<string, unknown> = { ...valid };
    delete missing[field];
    expect(() => parseWorkerRequest(missing)).toThrow("Invalid worker request object.");
    for (const value of [null, 42]) {
      expect(() => parseWorkerRequest({ ...valid, [field]: value })).toThrow("Invalid worker request object.");
    }
  });

  it.each(["inputPath", "outputPath"])("rejects an empty %s even when the other path is valid", (field) => {
    expect(() => parseWorkerRequest({ ...paths, conversion: "jpg-to-png", [field]: "" }))
      .toThrow("Invalid worker request object.");
  });

  it("rejects identical input and output paths", () => {
    expect(() => parseWorkerRequest({ ...paths, outputPath: paths.inputPath, conversion: "jpg-to-png" }))
      .toThrow("Input and output paths cannot be the same.");
  });

  it("rejects an unsupported conversion", () => {
    expect(() => parseWorkerRequest({ ...paths, conversion: "unknown" })).toThrow("Unsupported worker conversion.");
  });

  it.each(requests.filter((request) => "options" in request))(
    "requires valid options for $conversion", (request) => {
      const missing: Record<string, unknown> = { ...request };
      delete missing.options;
      expect(() => parseWorkerRequest(missing)).toThrow("Missing conversion options.");
      expect(() => parseWorkerRequest({ ...request, options: null })).toThrow();
      const options = request.conversion === "png-to-jpg"
        ? { quality: 0, backgroundColor: "red" }
        : { pageSize: "A5", pageOrientation: "sideways" };
      expect(() => parseWorkerRequest({ ...request, options })).toThrow();
    },
  );

  it.each(requests.flatMap((request) =>
    ["binDirectory", "executablePath", "fontPath", "regularFontPath", "boldFontPath"]
      .filter((field) => field in request)
      .map((field) => ({ conversion: request.conversion, request, field })),
  ))("requires a nonempty $field for $conversion", ({ request, field }) => {
    const missing: Record<string, unknown> = { ...request };
    delete missing[field];
    expect(() => parseWorkerRequest(missing)).toThrow();
    for (const value of [null, 42, ""]) {
      expect(() => parseWorkerRequest({ ...request, [field]: value })).toThrow();
    }
  });

  it("rejects an invalid XLSX sheet name", () => {
    expect(() => parseWorkerRequest({ ...paths, conversion: "xlsx-to-pdf", executablePath: "soffice.com", options: { ...page, sheetName: 42 } }))
      .toThrow("Invalid XLSX sheet name.");
  });
});
