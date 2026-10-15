import { describe, expect, it } from "vitest";
import { xlsxPdfSettingsSchema } from "./conversionSettings";

import {
  pngToJpgSettingsSchema,
  pdfPageSettingsSchema,
} from "./conversionSettings";

describe("pngToJpgSettingsSchema", () => {
  it("provides safe defaults when settings are missing", () => {
    expect(pngToJpgSettingsSchema.parse({})).toEqual({
      quality: 85,
      backgroundColor: "#ffffff",
    });
  });

  it("converts multipart form strings into validated settings", () => {
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

  it.each(["0", "101", "not-a-number"])(
    "rejects invalid quality: %s",
    (quality) => {
      expect(
        pngToJpgSettingsSchema.safeParse({
          quality,
          backgroundColor: "#ffffff",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects an invalid background color", () => {
    expect(
      pngToJpgSettingsSchema.safeParse({
        quality: "85",
        backgroundColor: "white",
      }).success,
    ).toBe(false);
  });
});

describe("pdfPageSettingsSchema", () => {
  it("provides A4 portrait as safe defaults", () => {
    expect(pdfPageSettingsSchema.parse({})).toEqual({
      pageSize: "A4",
      pageOrientation: "portrait",
    });
  });

  it("accepts A3 landscape settings from multipart form data", () => {
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
