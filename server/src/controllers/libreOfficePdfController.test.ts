import path from "path";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  convertLibreOfficeToPdf: vi.fn(),
  safeUnlink: vi.fn(),
}));

vi.mock("../utils/libreOffice", () => ({
  convertLibreOfficeToPdf: mocks.convertLibreOfficeToPdf,
}));
vi.mock("../utils/file", () => ({
  safeUnlink: mocks.safeUnlink,
}));

import { OUTPUT_DIR } from "../utils/constants";
import { createLibreOfficePdfController } from "./libreOfficePdfController";

const createRequest = (extension: string): Request =>
  ({
    file: {
      path: `uploads/document.${extension}`,
      filename: `document.${extension}`,
      originalname: `document.${extension}`,
    } as Express.Multer.File,
  }) as Request;

const createResponse = () => {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json };

  status.mockReturnValue(response);

  return {
    response: response as unknown as Response,
    status,
    json,
  };
};

describe("createLibreOfficePdfController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.convertLibreOfficeToPdf.mockResolvedValue(undefined);
  });

  it.each([
    ["docx", "DOCX"],
    ["pptx", "PPTX"],
  ])("converts a %s file through LibreOffice", async (extension, formatName) => {
    const controller = createLibreOfficePdfController(extension, formatName);
    const { response, status, json } = createResponse();

    await controller(createRequest(extension), response);

    expect(mocks.convertLibreOfficeToPdf).toHaveBeenCalledWith(
      `uploads/document.${extension}`,
      path.join(OUTPUT_DIR, "document.pdf"),
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      files: [
        {
          name: "document.pdf",
          url: "/output/document.pdf",
        },
      ],
    });
  });

  it("rejects a file with a different extension", async () => {
    const controller = createLibreOfficePdfController("docx", "DOCX");
    const { response, status, json } = createResponse();

    await controller(createRequest("pptx"), response);

    expect(mocks.convertLibreOfficeToPdf).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "No DOCX file uploaded.",
      code: "conversion-failed",
    });
  });

  it("returns a safe error when LibreOffice fails", async () => {
    mocks.convertLibreOfficeToPdf.mockRejectedValue(
      Object.assign(new Error("LibreOffice is unavailable"), {
        code: "ENOENT",
      }),
    );
    const controller = createLibreOfficePdfController("pptx", "PPTX");
    const { response, status, json } = createResponse();

    await controller(createRequest("pptx"), response);

    expect(mocks.safeUnlink).toHaveBeenCalledWith(
      path.join(OUTPUT_DIR, "document.pdf"),
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "LibreOffice is unavailable",
      code: "tool-unavailable",
    });
  });
});