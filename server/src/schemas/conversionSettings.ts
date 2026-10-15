import { z } from "zod";

export const pngToJpgSettingsSchema = z.object({
  quality: z.coerce.number().int().min(1).max(100).default(85),

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
