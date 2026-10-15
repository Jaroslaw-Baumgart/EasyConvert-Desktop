import type { Request, Response } from "express";
import { jpgToPng, jpgToPdf, pngToJpg } from "../controllers/imageController";
import { pdfToJpg, pdfToTxt, txtToPdf } from "../controllers/pdfController";
import { csvToPdf } from "../controllers/csvController";
import { xlsxToPdf } from "../controllers/xlsxController";
import { createLibreOfficePdfController } from "../controllers/libreOfficePdfController";

interface ConversionDefinitionShape {
  conversionType: string;
  sourceExtension: string;
  mimeType: string;
  handler: (req: Request, res: Response) => Promise<unknown>;
}

export const conversionDefinitions = [
  {
    conversionType: "pdf-to-jpg",
    sourceExtension: "pdf",
    mimeType: "application/pdf",
    handler: pdfToJpg,
  },
  {
    conversionType: "pdf-to-txt",
    sourceExtension: "pdf",
    mimeType: "application/pdf",
    handler: pdfToTxt,
  },
  {
    conversionType: "jpg-to-png",
    sourceExtension: "jpg",
    mimeType: "image/jpeg",
    handler: jpgToPng,
  },
  {
    conversionType: "png-to-jpg",
    sourceExtension: "png",
    mimeType: "image/png",
    handler: pngToJpg,
  },
  {
    conversionType: "jpg-to-pdf",
    sourceExtension: "jpg",
    mimeType: "image/jpeg",
    handler: jpgToPdf,
  },
  {
    conversionType: "txt-to-pdf",
    sourceExtension: "txt",
    mimeType: "text/plain",
    handler: txtToPdf,
  },
  {
    conversionType: "docx-to-pdf",
    sourceExtension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", //docx
    handler: createLibreOfficePdfController("docx", "DOCX"),
  },
  {
    conversionType: "csv-to-pdf",
    sourceExtension: "csv",
    mimeType: "text/csv",
    handler: csvToPdf,
  },
  {
    conversionType: "xlsx-to-pdf",
    sourceExtension: "xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", //xlsx
    handler: xlsxToPdf,
  },
  {
    conversionType: "pptx-to-pdf",
    sourceExtension: "pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", //pptx
    handler: createLibreOfficePdfController("pptx", "PPTX"),
  },
] as const satisfies readonly ConversionDefinitionShape[];

export const allowedExtensions = [
  ...new Set(
    conversionDefinitions.map((definition) => `.${definition.sourceExtension}`),
  ),
];

export const allowedMimeTypes = [
  ...new Set(conversionDefinitions.map((definition) => definition.mimeType)),
];
