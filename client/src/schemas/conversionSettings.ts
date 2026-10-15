import { z } from "zod";
import type { ConversionType } from "../config/conversions";

export const pngToJpgSettingsSchema = z.object({
  quality: z.coerce
    .number()
    .int()
    .min(1, "Quality must be between 1 and 100.")
    .max(100, "Quality must be between 1 and 100.")
    .default(85),

  backgroundColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#ffffff"),
});

export type PngToJpgSettings = z.infer<typeof pngToJpgSettingsSchema>;

export const pdfPageSettingsSchema = z.object({
  pageOrientation: z.enum(["portrait", "landscape"]).default("portrait"),
  pageSize: z.enum(["A4", "A3"]).default("A4"),
});

export const xlsxPdfSettingsSchema = pdfPageSettingsSchema.extend({
  sheetName: z.string().min(1).optional(),
});

export type XlsxPdfSettings = z.infer<typeof xlsxPdfSettingsSchema>;

export type PdfPageSettings = z.infer<typeof pdfPageSettingsSchema>;

export const getConversionSettingsSchema = (conversionType: ConversionType) => {
  switch (conversionType) {
    case "png-to-jpg":
      return pngToJpgSettingsSchema;

    case "jpg-to-pdf":
    case "txt-to-pdf":
    case "csv-to-pdf":
      return pdfPageSettingsSchema;

    case "xlsx-to-pdf":
      return xlsxPdfSettingsSchema;

    default:
      return null;
  }
};

export type ConversionSettings =
  | PngToJpgSettings
  | PdfPageSettings
  | XlsxPdfSettings;
