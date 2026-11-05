import path from "node:path";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  convertPdfToJpg: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: { mkdir: mocks.mkdir },
}));

vi.mock("../utils/poppler", () => ({
  convertPdfToJpg: mocks.convertPdfToJpg,
  runPoppler: vi.fn(),
  validatePdfPageCount: vi.fn(),
}));

import { pdfToJpg } from "./pdfController";
import { OUTPUT_DIR } from "../utils/constants";

const outputDirectory = path.join(OUTPUT_DIR, "document");

function createRequest(): Request {
  return {
    file: {
      path: "uploads/document.pdf",
      filename: "document.pdf",
      originalname: "document.pdf",
    },
  } as Request;
}

function createResponse(signal?: AbortSignal) {
  const status = vi.fn();
  const json = vi.fn();
  const response = {
    status,
    json,
    locals: { conversionAbortSignal: signal },
  };

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
  mocks.convertPdfToJpg.mockResolvedValue([
    path.join(outputDirectory, "page-1.jpg"),
    path.join(outputDirectory, "page-2.jpg"),
  ]);
});

describe("PDF to JPG HTTP adapter", () => {
  it("returns every generated page in engine order", async () => {
    const { response, status, json } = createResponse();

    await pdfToJpg(createRequest(), response);

    expect(mocks.mkdir).toHaveBeenCalledExactlyOnceWith(
      outputDirectory,
      { recursive: true },
    );
    expect(mocks.convertPdfToJpg).toHaveBeenCalledExactlyOnceWith(
      "uploads/document.pdf",
      outputDirectory,
      undefined,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      files: [
        { url: "/output/document/page-1.jpg", name: "page-1.jpg" },
        { url: "/output/document/page-2.jpg", name: "page-2.jpg" },
      ],
    });
  });

  it("passes the cancellation signal to the engine adapter", async () => {
    const controller = new AbortController();
    const { response } = createResponse(controller.signal);

    await pdfToJpg(createRequest(), response);

    expect(mocks.convertPdfToJpg).toHaveBeenCalledExactlyOnceWith(
      "uploads/document.pdf",
      outputDirectory,
      controller.signal,
    );
  });

  it("rejects a missing file before creating output", async () => {
    const { response, status } = createResponse();

    await pdfToJpg({} as Request, response);

    expect(status).toHaveBeenCalledWith(400);
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.convertPdfToJpg).not.toHaveBeenCalled();
  });

  it("returns an error when conversion fails", async () => {
    mocks.convertPdfToJpg.mockRejectedValue(
      new Error("PDF page limit exceeded."),
    );
    const { response, status, json } = createResponse();

    await pdfToJpg(createRequest(), response);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "PDF page limit exceeded.",
      code: "conversion-failed",
    });
  });

  it("does not start conversion when directory creation fails", async () => {
    mocks.mkdir.mockRejectedValue(new Error("Permission denied."));
    const { response, status } = createResponse();

    await pdfToJpg(createRequest(), response);

    expect(status).toHaveBeenCalledWith(500);
    expect(mocks.convertPdfToJpg).not.toHaveBeenCalled();
  });
});
