import path from "path";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  safeUnlink: vi.fn(),
  applyXlsxPageSetup: vi.fn(),
  convertLibreOfficeToPdf: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
  },
}));

vi.mock("../utils/file", () => ({
  safeUnlink: mocks.safeUnlink,
}));

vi.mock("../utils/xlsxPageSetup", () => ({
  applyXlsxPageSetup: mocks.applyXlsxPageSetup,
}));

vi.mock("../utils/libreOffice", () => ({
  convertLibreOfficeToPdf: mocks.convertLibreOfficeToPdf,
}));

import { xlsxToPdf } from "./xlsxController";
import { OUTPUT_DIR } from "../utils/constants";

const inputBytes = new Uint8Array([1, 2, 3]);
const preparedBytes = new Uint8Array([4, 5, 6]);

const createRequest = (body: unknown): Request =>
  ({
    body,
    file: {
      path: "uploads/workbook.xlsx",
      filename: "workbook.xlsx",
      originalname: "workbook.xlsx",
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

describe("xlsxToPdf", () => {
  const preparedPath = path.join(OUTPUT_DIR, "workbook.xlsx");
  const outputPath = path.join(OUTPUT_DIR, "workbook.pdf");

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mkdir.mockResolvedValue(undefined);
    mocks.readFile.mockResolvedValue(inputBytes);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.applyXlsxPageSetup.mockReturnValue(preparedBytes);
    mocks.convertLibreOfficeToPdf.mockResolvedValue(undefined);
  });

  it("prepares the selected sheet and converts the prepared XLSX", async () => {
    const { response, status, json } = createResponse();

    await xlsxToPdf(
      createRequest({
        sheetName: "Overview",
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
      response,
    );

    expect(mocks.mkdir).toHaveBeenCalledWith(OUTPUT_DIR, {
      recursive: true,
    });
    expect(mocks.readFile).toHaveBeenCalledWith("uploads/workbook.xlsx");
    expect(mocks.applyXlsxPageSetup).toHaveBeenCalledWith(
      inputBytes,
      "Overview",
      {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    );
    expect(mocks.writeFile).toHaveBeenCalledWith(preparedPath, preparedBytes);
    expect(mocks.convertLibreOfficeToPdf).toHaveBeenCalledWith(
      preparedPath,
      outputPath,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      files: [
        {
          name: "workbook.pdf",
          url: "/output/workbook.pdf",
        },
      ],
    });
    expect(mocks.safeUnlink).toHaveBeenCalledWith(preparedPath);
  });

  it("rejects invalid settings before reading the XLSX", async () => {
    const { response, status, json } = createResponse();

    await xlsxToPdf(
      createRequest({
        sheetName: "",
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
      response,
    );

    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.applyXlsxPageSetup).not.toHaveBeenCalled();
    expect(mocks.convertLibreOfficeToPdf).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid conversion settings.",
      code: "conversion-failed",
    });
  });

  it("returns a safe error and removes temporary files when LibreOffice fails", async () => {
    mocks.convertLibreOfficeToPdf.mockRejectedValue(
      Object.assign(new Error("LibreOffice is unavailable"), {
        code: "ENOENT",
      }),
    );

    const { response, status, json } = createResponse();

    await xlsxToPdf(
      createRequest({
        sheetName: "Overview",
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
      response,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "LibreOffice is unavailable",
      code: "tool-unavailable",
    });
    expect(mocks.safeUnlink).toHaveBeenCalledWith(preparedPath);
    expect(mocks.safeUnlink).toHaveBeenCalledWith(outputPath);
  });

  it("prepares every sheet when no sheet is selected", async () => {
    const { response, status } = createResponse();

    await xlsxToPdf(
      createRequest({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
      response,
    );

    expect(mocks.applyXlsxPageSetup).toHaveBeenCalledWith(
      inputBytes,
      undefined,
      {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    );
    expect(mocks.convertLibreOfficeToPdf).toHaveBeenCalledWith(
      preparedPath,
      outputPath,
    );
    expect(status).toHaveBeenCalledWith(200);
  });
});
