import { describe, expect, it } from "vitest";
import { parseStartConversionRequest } from "../main/parseStartConversionRequest";

describe("parseStartConversionRequest", () => {
  it.each([
    { pageSize: "A3", pageOrientation: "landscape", sheetName: "Koszty" },
    { pageSize: "A4", pageOrientation: "portrait" },
  ])("preserves XLSX settings %j and removes extra fields", (options) => {
    expect(parseStartConversionRequest({ sourceId: "source-xlsx", conversion: "xlsx-to-pdf", options: { ...options, extra: true }, extra: true }))
      .toEqual({ sourceId: "source-xlsx", conversion: "xlsx-to-pdf", options });
  });

  it("rejects XLSX without options", () => {
    expect(() => parseStartConversionRequest({ sourceId: "source-xlsx", conversion: "xlsx-to-pdf" }))
      .toThrow("Missing options for XLSX to PDF conversion.");
  });

  it.each(["", null, 42])("rejects an invalid XLSX sheet name %j", (sheetName) => {
    expect(() => parseStartConversionRequest({ sourceId: "source-xlsx", conversion: "xlsx-to-pdf", options: { pageSize: "A4", pageOrientation: "portrait", sheetName } }))
      .toThrow("Invalid XLSX sheet name.");
  });
  it("returns a CSV to PDF request with validated options", () => {
    expect(
      parseStartConversionRequest({
        sourceId: "source-csv",
        conversion: "csv-to-pdf",
        options: {
          pageSize: "A3",
          pageOrientation: "landscape",
          extra: "ignored",
        },
        extra: "ignored",
      }),
    ).toEqual({
      sourceId: "source-csv",
      conversion: "csv-to-pdf",
      options: { pageSize: "A3", pageOrientation: "landscape" },
    });
  });

  it("rejects CSV to PDF without options", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-csv",
        conversion: "csv-to-pdf",
      }),
    ).toThrow("Missing options for CSV to PDF conversion.");
  });

  it.each([
    null,
    {},
    { pageSize: "A5", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "sideways" },
  ])("rejects invalid CSV to PDF options: %j", (options) => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-csv",
        conversion: "csv-to-pdf",
        options,
      }),
    ).toThrow("Invalid PDF page options.");
  });

  it("returns a new JPG to PNG request containing only allowed fields", () => {
    const input = {
      sourceId: "source-123",
      conversion: "jpg-to-png",
      extra: "ignored",
    };

    const result = parseStartConversionRequest(input);

    expect(result).toEqual({
      sourceId: "source-123",
      conversion: "jpg-to-png",
    });
    expect(result).not.toBe(input);
  });

  it("returns a PNG to JPG request with validated options", () => {
    const input = {
      sourceId: "source-123",
      conversion: "png-to-jpg",
      options: {
        quality: 85,
        backgroundColor: "#aBc123",
        extra: "ignored",
      },
      extra: "ignored",
    };

    const result = parseStartConversionRequest(input);

    expect(result).toEqual({
      sourceId: "source-123",
      conversion: "png-to-jpg",
      options: {
        quality: 85,
        backgroundColor: "#aBc123",
      },
    });
    expect(result).not.toBe(input);

    if (result.conversion !== "png-to-jpg") {
      throw new Error("Expected PNG to JPG request.");
    }

    expect(result.options).not.toBe(input.options);
  });

  it.each(["jpg-to-png", "png-to-jpg"])(
    "accepts a maximum-length sourceId for %s",
    (conversion) => {
      const sourceId = "a".repeat(128);

      expect(
        parseStartConversionRequest({
          sourceId,
          conversion,
          options: {
            quality: 85,
            backgroundColor: "#ffffff",
          },
        }).sourceId,
      ).toBe(sourceId);
    },
  );

  it.each([
    null,
    undefined,
    "request",
    42,
    true,
    [],
    {},
    { conversion: "jpg-to-png" },
    { sourceId: 123, conversion: "jpg-to-png" },
    { sourceId: "", conversion: "jpg-to-png" },
    { sourceId: "a".repeat(129), conversion: "jpg-to-png" },
    { sourceId: "source-123" },
    { sourceId: "source-123", conversion: null },
    { sourceId: "source-123", conversion: 123 },
  ])("rejects invalid input: %j", (input) => {
    expect(() => parseStartConversionRequest(input)).toThrow();
  });

  it("rejects an unsupported conversion", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "unsupported",
      }),
    ).toThrow("Unsupported conversion.");
  });

  it("rejects PNG to JPG without options", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "png-to-jpg",
      }),
    ).toThrow("Missing options for PNG to JPG conversion.");
  });

  it.each([
    null,
    {},
    { quality: "85", backgroundColor: "#ffffff" },
    { quality: 0, backgroundColor: "#ffffff" },
    { quality: 85, backgroundColor: "red" },
  ])("rejects invalid PNG to JPG options: %j", (options) => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "png-to-jpg",
        options,
      }),
    ).toThrow("Invalid PNG to JPG options.");
  });

  it("returns a JPG to PDF request containing only validated fields", () => {
    const input = {
      sourceId: "source-123",
      conversion: "jpg-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
        extra: "ignored",
      },
      extra: "ignored",
    };

    const result = parseStartConversionRequest(input);

    expect(result).toEqual({
      sourceId: "source-123",
      conversion: "jpg-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    });
    expect(result).not.toBe(input);

    if (result.conversion !== "jpg-to-pdf") {
      throw new Error("Expected JPG to PDF request.");
    }

    expect(result.options).not.toBe(input.options);
  });

  it("rejects JPG to PDF without options", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "jpg-to-pdf",
      }),
    ).toThrow("Missing options for JPG to PDF conversion.");
  });

  it.each([
    null,
    {},
    { pageSize: "A3" },
    { pageOrientation: "landscape" },
    { pageSize: "A5", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "sideways" },
  ])("rejects invalid JPG to PDF options: %j", (options) => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "jpg-to-pdf",
        options,
      }),
    ).toThrow("Invalid PDF page options.");
  });

  it("returns a TXT to PDF request containing only validated fields", () => {
    const input = {
      sourceId: "source-123",
      conversion: "txt-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
        extra: "ignored",
      },
      extra: "ignored",
    };

    const result = parseStartConversionRequest(input);

    expect(result).toEqual({
      sourceId: "source-123",
      conversion: "txt-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    });
    expect(result).not.toBe(input);

    if (result.conversion !== "txt-to-pdf") {
      throw new Error("Expected TXT to PDF request.");
    }

    expect(result.options).not.toBe(input.options);
  });

  it("rejects TXT to PDF without options", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "txt-to-pdf",
      }),
    ).toThrow("Missing options for TXT to PDF conversion.");
  });

  it.each([
    null,
    {},
    { pageSize: "A3" },
    { pageOrientation: "landscape" },
    { pageSize: "A5", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "sideways" },
  ])("rejects invalid TXT to PDF options: %j", (options) => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "txt-to-pdf",
        options,
      }),
    ).toThrow("Invalid PDF page options.");
  });

  it.each(["pdf-to-jpg", "pdf-to-txt", "docx-to-pdf", "pptx-to-pdf"])("accepts %s without options and strips extra fields", (conversion) => {
    expect(
      parseStartConversionRequest({
        sourceId: "source-pdf",
        conversion,
        extra: "ignored",
      }),
    ).toEqual({
      sourceId: "source-pdf",
      conversion,
    });
  });
});
