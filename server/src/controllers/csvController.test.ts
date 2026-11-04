import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  convertCsvToPdf: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
  },
}));

vi.mock(
  "../../../conversion-core/pdf/convertCsvToPdf",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("../../../conversion-core/pdf/convertCsvToPdf")
      >();

    return {
      ...original,
      convertCsvToPdf: mocks.convertCsvToPdf,
    };
  },
);

import { CsvInputError } from "../../../conversion-core/pdf/convertCsvToPdf";
import { CsvPdfTableError } from "../utils/csvPdfTable";
import { csvToPdf } from "./csvController";

function createRequest(body: unknown): Request {
  return {
    body,
    file: {
      path: "uploads/payroll.csv",
      filename: "payroll.csv",
      originalname: "payroll.csv",
    },
  } as Request;
}

function createResponse() {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json };

  status.mockReturnValue(response);

  return {
    response: response as unknown as Response,
    status,
    json,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.convertCsvToPdf.mockResolvedValue(undefined);
});

describe("csvToPdf HTTP adapter", () => {
  it("passes page settings and both fonts to the engine", async () => {
    const { response, status, json } = createResponse();

    await csvToPdf(
      createRequest({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
      response,
    );

    expect(mocks.mkdir).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
      recursive: true,
    });
    expect(mocks.convertCsvToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/payroll.csv",
      expect.stringMatching(/payroll\.pdf$/),
      {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
      expect.stringMatching(/[/\\]assets[/\\]fonts[/\\]NotoSans-Regular\.ttf$/),
      expect.stringMatching(/[/\\]assets[/\\]fonts[/\\]NotoSans-Bold\.ttf$/),
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("preserves default A4 portrait settings", async () => {
    const { response } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(mocks.convertCsvToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/payroll.csv",
      expect.any(String),
      {
        pageSize: "A4",
        pageOrientation: "portrait",
      },
      expect.any(String),
      expect.any(String),
    );
  });

  it("rejects a missing file before creating output", async () => {
    const { response, status } = createResponse();

    await csvToPdf({ body: {} } as Request, response);

    expect(status).toHaveBeenCalledWith(400);
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.convertCsvToPdf).not.toHaveBeenCalled();
  });

  it.each([{ pageSize: "A5" }, { pageOrientation: "sideways" }])(
    "rejects invalid page settings: %j",
    async (settings) => {
      const { response, status, json } = createResponse();

      await csvToPdf(createRequest(settings), response);

      expect(mocks.mkdir).not.toHaveBeenCalled();
      expect(mocks.convertCsvToPdf).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid conversion settings.",
        code: "conversion-failed",
      });
    },
  );

  it.each([
    "CSV file is empty.",
    "Invalid CSV data.",
    "CSV exceeds processing limits.",
  ])("returns 400 for input error: %s", async (message) => {
    mocks.convertCsvToPdf.mockRejectedValue(new CsvInputError(message));
    const { response, status, json } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: message,
      code: "conversion-failed",
    });
  });

  it("returns invalid-settings for a table layout error", async () => {
    const message = "Too many CSV columns for this page.";
    mocks.convertCsvToPdf.mockRejectedValue(new CsvPdfTableError(message));
    const { response, status, json } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: message,
      code: "invalid-settings",
    });
  });

  it("returns 500 for an output failure", async () => {
    mocks.convertCsvToPdf.mockRejectedValue(new Error("Disk full."));
    const { response, status, json } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Disk full.",
      code: "conversion-failed",
    });
  });

  it("does not start conversion when creating the directory fails", async () => {
    mocks.mkdir.mockRejectedValue(new Error("Permission denied."));
    const { response, status } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(mocks.convertCsvToPdf).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(500);
  });
});
