import { describe, expect, it } from "vitest";
import { parseXlsxToPdfOptions } from "../../office/parseXlsxToPdfOptions";

const page = { pageSize: "A3", pageOrientation: "landscape" } as const;

describe("parseXlsxToPdfOptions", () => {
  it("preserves the exact sheet name and strips extra fields", () => {
    const input = { ...page, sheetName: " Łódź & Koszty ", extra: true };
    const result = parseXlsxToPdfOptions(input);
    expect(result).toEqual({ ...page, sheetName: " Łódź & Koszty " });
    expect(result).not.toBe(input);
  });

  it.each([{ ...page }, { ...page, sheetName: undefined }])(
    "accepts all sheets without retaining an undefined field: %j", (input) => {
      expect(parseXlsxToPdfOptions(input)).toEqual(page);
      expect(parseXlsxToPdfOptions(input)).not.toHaveProperty("sheetName");
    },
  );

  it.each(["", null, 42])("rejects invalid sheet name %j", (sheetName) => {
    expect(() => parseXlsxToPdfOptions({ ...page, sheetName }))
      .toThrow("Invalid XLSX sheet name.");
  });

  it("rejects invalid page options", () => {
    expect(() => parseXlsxToPdfOptions({ ...page, pageSize: "A5" }))
      .toThrow("Invalid PDF page options.");
  });
});
