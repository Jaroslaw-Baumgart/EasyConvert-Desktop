import { describe, expect, it } from "vitest";
import { xlsxPdfSettingsSchema } from "./conversionSettings";

import {
  pdfPageSettingsSchema,
  pngToJpgSettingsSchema,
  getConversionSettingsSchema,
} from "./conversionSettings";

describe("pngToJpgSettingsSchema", () => {
  it("provides user-friendly defaults", () => {
    expect(pngToJpgSettingsSchema.parse({})).toEqual({
      quality: 85,
      backgroundColor: "#ffffff",
    });
  });

  it("converts quality from a form string to a number", () => {
    expect(
      pngToJpgSettingsSchema.parse({
        quality: "95",
        backgroundColor: "#000000",
      }),
    ).toEqual({
      quality: 95,
      backgroundColor: "#000000",
    });
  });

  it("rejects an invalid background color", () => {
    expect(
      pngToJpgSettingsSchema.safeParse({
        quality: 85,
        backgroundColor: "white",
      }).success,
    ).toBe(false);
  });

  it.each([0, 101])("rejects quality outside the range: %s", (quality) => {
    expect(
      pngToJpgSettingsSchema.safeParse({
        quality,
        backgroundColor: "#ffffff",
      }).success,
    ).toBe(false);
  });

  it.each([1, 100])("accepts quality boundary: %s", (quality) => {
    expect(
      pngToJpgSettingsSchema.safeParse({
        quality,
        backgroundColor: "#ffffff",
      }).success,
    ).toBe(true);
  });
});

describe("pdfPageSettingsSchema", () => {
  it("uses A4 portrait as user-friendly defaults", () => {
    expect(pdfPageSettingsSchema.parse({})).toEqual({
      pageSize: "A4",
      pageOrientation: "portrait",
    });
  });

  it("accepts A3 landscape settings", () => {
    expect(
      pdfPageSettingsSchema.parse({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
    ).toEqual({
      pageSize: "A3",
      pageOrientation: "landscape",
    });
  });

  it("rejects an unsupported orientation", () => {
    expect(
      pdfPageSettingsSchema.safeParse({
        pageOrientation: "sideways",
      }).success,
    ).toBe(false);
  });

  it("rejects an unsupported page size", () => {
    expect(
      pdfPageSettingsSchema.safeParse({
        pageSize: "Letter",
      }).success,
    ).toBe(false);
  });
});

describe("getConversionSettingsSchema", () => {
  it("returns PNG to JPG settings schema", () => {
    expect(getConversionSettingsSchema("png-to-jpg")).toBe(
      pngToJpgSettingsSchema,
    );
  });

  it.each(["jpg-to-pdf", "txt-to-pdf", "csv-to-pdf"] as const)(
    "returns PDF page settings schema for %s",
    (conversionType) => {
      expect(getConversionSettingsSchema(conversionType)).toBe(
        pdfPageSettingsSchema,
      );
    },
  );

  describe("xlsxPdfSettingsSchema", () => {
    it("allows all sheets when no sheet name is provided", () => {
      expect(
        xlsxPdfSettingsSchema.parse({
          pageSize: "A3",
          pageOrientation: "landscape",
        }),
      ).toEqual({
        pageSize: "A3",
        pageOrientation: "landscape",
      });
    });

    it("rejects an empty provided sheet name", () => {
      expect(
        xlsxPdfSettingsSchema.safeParse({
          sheetName: "",
        }).success,
      ).toBe(false);
    });
  });

  it("returns null for a conversion without additional settings", () => {
    expect(getConversionSettingsSchema("jpg-to-png")).toBeNull();
  });
});
