import { describe, expect, it } from "vitest";

import { createConversionFormData } from "./conversionFormData";
import type { ConversionOption } from "../types/converter";

describe("createConversionFormData", () => {
  it("includes PNG to JPG settings in the conversion payload", () => {
    const file = new File(["png content"], "image.png", {
      type: "image/png",
    });

    const option = {
      conversionType: "png-to-jpg",
      sourceFormat: "png",
      targetFormat: "jpg",
      disabled: false,
    } satisfies ConversionOption;

    const formData = createConversionFormData(file, option, {
      quality: 95,
      backgroundColor: "#000000",
    });

    expect(formData.get("file")).toBe(file);
    expect(formData.get("conversionType")).toBe("png-to-jpg");
    expect(formData.get("target")).toBe("jpg");
    expect(formData.get("quality")).toBe("95");
    expect(formData.get("backgroundColor")).toBe("#000000");
  });

  it("includes PDF page settings in the conversion payload", () => {
    const file = new File(["jpg content"], "image.jpg", {
      type: "image/jpeg",
    });

    const option = {
      conversionType: "jpg-to-pdf",
      sourceFormat: "jpg",
      targetFormat: "pdf",
      disabled: false,
    } satisfies ConversionOption;

    const formData = createConversionFormData(file, option, {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    expect(formData.get("file")).toBe(file);
    expect(formData.get("conversionType")).toBe("jpg-to-pdf");
    expect(formData.get("target")).toBe("pdf");
    expect(formData.get("pageSize")).toBe("A3");
    expect(formData.get("pageOrientation")).toBe("landscape");

    expect(formData.has("quality")).toBe(false);
    expect(formData.has("backgroundColor")).toBe(false);
  });

  it("includes the selected XLSX sheet and page settings", () => {
    const file = new File(["xlsx content"], "workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const option = {
      conversionType: "xlsx-to-pdf",
      sourceFormat: "xlsx",
      targetFormat: "pdf",
      disabled: false,
    } satisfies ConversionOption;

    const formData = createConversionFormData(file, option, {
      sheetName: "Overview",
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    expect(formData.get("conversionType")).toBe("xlsx-to-pdf");
    expect(formData.get("sheetName")).toBe("Overview");
    expect(formData.get("pageSize")).toBe("A3");
    expect(formData.get("pageOrientation")).toBe("landscape");
  });

  it("omits the sheet name when converting all XLSX sheets", () => {
    const file = new File(["xlsx content"], "workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const option = {
      conversionType: "xlsx-to-pdf",
      sourceFormat: "xlsx",
      targetFormat: "pdf",
      disabled: false,
    } satisfies ConversionOption;

    const formData = createConversionFormData(file, option, {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    expect(formData.get("conversionType")).toBe("xlsx-to-pdf");
    expect(formData.has("sheetName")).toBe(false);
    expect(formData.get("pageSize")).toBe("A3");
    expect(formData.get("pageOrientation")).toBe("landscape");
  });
});
