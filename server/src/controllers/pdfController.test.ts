import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  convertTxtToPdf: vi.fn(),
}));

vi.mock("../../../conversion-core/pdf/convertTxtToPdf", () => ({
  convertTxtToPdf: mocks.convertTxtToPdf,
}));

import { txtToPdf } from "./pdfController";

function createRequest(body: unknown): Request {
  return {
    body,
    file: {
      path: "uploads/document.txt",
      filename: "document.txt",
      originalname: "document.txt",
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
  mocks.convertTxtToPdf.mockResolvedValue(undefined);
});

describe("txtToPdf", () => {
  it("passes page settings and the font path to the engine", async () => {
    const { response, status, json } = createResponse();

    await txtToPdf(
      createRequest({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
      response,
    );

    expect(mocks.convertTxtToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/document.txt",
      expect.stringMatching(/document\.pdf$/),
      {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
      expect.stringMatching(/[/\\]assets[/\\]fonts[/\\]NotoSans-Regular\.ttf$/),
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("preserves default A4 portrait settings", async () => {
    const { response } = createResponse();

    await txtToPdf(createRequest({}), response);

    expect(mocks.convertTxtToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/document.txt",
      expect.any(String),
      {
        pageSize: "A4",
        pageOrientation: "portrait",
      },
      expect.any(String),
    );
  });

  it("rejects a missing file before calling the engine", async () => {
    const { response, status } = createResponse();

    await txtToPdf({ body: {} } as Request, response);

    expect(status).toHaveBeenCalledWith(400);
    expect(mocks.convertTxtToPdf).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file extension", async () => {
    const request = createRequest({});
    request.file!.originalname = "document.csv";
    const { response, status } = createResponse();

    await txtToPdf(request, response);

    expect(status).toHaveBeenCalledWith(400);
    expect(mocks.convertTxtToPdf).not.toHaveBeenCalled();
  });

  it("accepts an uppercase TXT extension", async () => {
    const request = createRequest({});
    request.file!.originalname = "document.TXT";
    const { response, status } = createResponse();

    await txtToPdf(request, response);

    expect(mocks.convertTxtToPdf).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(200);
  });

  it.each([{ pageOrientation: "sideways" }, { pageSize: "A5" }])(
    "rejects invalid settings: %j",
    async (settings) => {
      const { response, status, json } = createResponse();

      await txtToPdf(createRequest(settings), response);

      expect(mocks.convertTxtToPdf).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid conversion settings.",
        code: "conversion-failed",
      });
    },
  );

  it("returns an HTTP error when the engine fails", async () => {
    mocks.convertTxtToPdf.mockRejectedValue(new Error("Could not write PDF."));
    const { response, status, json } = createResponse();

    await txtToPdf(createRequest({}), response);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Could not write PDF.",
      code: "conversion-failed",
    });
  });
});
