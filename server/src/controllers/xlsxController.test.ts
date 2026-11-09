import path from "path";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  safeUnlink: vi.fn(),
  convertXlsxToPdf: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
  },
}));

vi.mock("../utils/file", () => ({
  safeUnlink: mocks.safeUnlink,
}));

vi.mock("../../../conversion-core/office/convertXlsxToPdf", () => ({
  convertXlsxToPdf: mocks.convertXlsxToPdf,
}));

import { xlsxToPdf } from "./xlsxController";
import { OUTPUT_DIR, LIBRE_OFFICE_PATH, LIBRE_OFFICE_TIMEOUT_MS } from "../utils/constants";

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
  const outputPath = path.join(OUTPUT_DIR, "workbook.pdf");
  const libreOfficeOptions = {
    executablePath: LIBRE_OFFICE_PATH,
    timeoutMs: LIBRE_OFFICE_TIMEOUT_MS,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mocks.mkdir.mockResolvedValue(undefined);
    mocks.convertXlsxToPdf.mockResolvedValue(undefined);
    mocks.safeUnlink.mockResolvedValue(undefined);
  });

  it("passes the selected sheet, page settings and cancellation signal to the engine", async () => {
    const { response, status, json } = createResponse();
    const signal = new AbortController().signal;
    response.locals = { conversionAbortSignal: signal };

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
    expect(mocks.convertXlsxToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/workbook.xlsx",
      outputPath,
      {
        sheetName: "Overview",
        pageSize: "A3",
        pageOrientation: "landscape",
      },
      libreOfficeOptions,
      signal,
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
    expect(mocks.safeUnlink).not.toHaveBeenCalled();
  });

  it("rejects invalid settings before creating output or calling the engine", async () => {
    const { response, status, json } = createResponse();

    await xlsxToPdf(
      createRequest({
        sheetName: "",
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
      response,
    );

    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.convertXlsxToPdf).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid conversion settings.",
      code: "conversion-failed",
    });
  });

  it("returns a safe error and removes the failed output when the engine fails", async () => {
    mocks.convertXlsxToPdf.mockRejectedValue(
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
    expect(mocks.safeUnlink).toHaveBeenCalledExactlyOnceWith(outputPath);
  });

  it("passes settings without a sheet selection to convert all sheets", async () => {
    const { response, status } = createResponse();

    await xlsxToPdf(
      createRequest({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
      response,
    );

    expect(mocks.convertXlsxToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/workbook.xlsx",
      outputPath,
      {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
      libreOfficeOptions,
      undefined,
    );
    expect(status).toHaveBeenCalledWith(200);
  });
});
