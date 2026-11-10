import type { StartConversionRequest } from "../../../shared/desktopContract";
import type { ConversionOption } from "../types/converter";
import type { ConversionSettings } from "../schemas/conversionSettings";

export function createConversionRequest(
  sourceId: string,
  conversion: ConversionOption["conversionType"],
  settings?: ConversionSettings,
): StartConversionRequest {
  if (
    conversion === "jpg-to-png" ||
    conversion === "pdf-to-jpg" ||
    conversion === "pdf-to-txt" ||
    conversion === "docx-to-pdf" ||
    conversion === "pptx-to-pdf"
  ) {
    return {
      sourceId,
      conversion,
    };
  } else if (conversion === "png-to-jpg") {
    if (
      !settings ||
      !("quality" in settings) ||
      !("backgroundColor" in settings)
    ) {
      throw new Error("Missing PNG to JPG settings.");
    }

    return {
      sourceId,
      conversion,
      options: {
        quality: settings.quality,
        backgroundColor: settings.backgroundColor,
      },
    };
  } else if (
    conversion === "jpg-to-pdf" ||
    conversion === "txt-to-pdf" ||
    conversion === "csv-to-pdf"
  ) {
    if (
      !settings ||
      !("pageSize" in settings) ||
      !("pageOrientation" in settings)
    ) {
      throw new Error("Missing PDF page settings.");
    }

    return {
      sourceId,
      conversion,
      options: {
        pageSize: settings.pageSize,
        pageOrientation: settings.pageOrientation,
      },
    };
  } else if (conversion === "xlsx-to-pdf") {
    if (
      !settings ||
      !("pageSize" in settings) ||
      !("pageOrientation" in settings)
    ) {
      throw new Error("Missing XLSX to PDF settings.");
    }

    return {
      sourceId,
      conversion,
      options: {
        pageSize: settings.pageSize,
        pageOrientation: settings.pageOrientation,
        ...("sheetName" in settings && settings.sheetName !== undefined
          ? { sheetName: settings.sheetName }
          : {}),
      },
    };
  } else {
    throw new Error("This desktop conversion is not available yet.");
  }
}
