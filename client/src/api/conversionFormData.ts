import type { ConversionSettings } from "../schemas/conversionSettings";
import type { ConversionOption } from "../types/converter";

export const createConversionFormData = (
  file: File,
  option: ConversionOption,
  settings?: ConversionSettings,
): FormData => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("conversionType", option.conversionType);
  formData.append("target", option.targetFormat);

  if (settings && "quality" in settings && "backgroundColor" in settings) {
    formData.append("quality", String(settings.quality));
    formData.append("backgroundColor", settings.backgroundColor);
  }

  if (settings && "pageOrientation" in settings) {
    formData.append("pageOrientation", settings.pageOrientation);
    formData.append("pageSize", settings.pageSize);
  }

  if (settings && "sheetName" in settings && settings.sheetName !== undefined) {
    formData.append("sheetName", settings.sheetName);
  }

  return formData;
};
