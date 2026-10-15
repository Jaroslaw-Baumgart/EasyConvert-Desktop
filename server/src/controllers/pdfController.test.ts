import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const readFile = vi.fn().mockResolvedValue("example text");

  const stream = {
    on: vi.fn((event: string, callback: () => void) => {
      if (event === "finish") {
        callback();
      }

      return stream;
    }),
  };

  const createWriteStream = vi.fn(() => stream);
  const text = vi.fn();
  const fontSize = vi.fn(() => ({ text }));
  const font = vi.fn();
  const pipe = vi.fn(() => stream);
  const end = vi.fn();

  const PDFDocument = vi.fn(function PDFDocumentMock() {
    return {
      pipe,
      fontSize,
      font,
      end,
    };
  });

  return {
    readFile,
    createWriteStream,
    text,
    fontSize,
    font,
    pipe,
    end,
    PDFDocument,
  };
});

vi.mock("fs/promises", () => ({
  default: {
    readFile: mocks.readFile,
  },
}));

vi.mock("fs", () => ({
  default: {
    createWriteStream: mocks.createWriteStream,
  },
}));

vi.mock("pdfkit", () => ({
  default: mocks.PDFDocument,
}));

import { txtToPdf } from "./pdfController";

const createRequest = (body: unknown): Request =>
  ({
    body,
    file: {
      path: "uploads/document.txt",
      filename: "document.txt",
      originalname: "document.txt",
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

describe("txtToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an A3 PDF with the validated landscape orientation", async () => {
    const request = createRequest({
      pageSize: "A3",
      pageOrientation: "landscape",
    });
    const { response, status } = createResponse();

    await txtToPdf(request, response);

    expect(mocks.readFile).toHaveBeenCalledWith("uploads/document.txt", "utf8");
    expect(mocks.PDFDocument).toHaveBeenCalledWith({
      size: "A3",
      layout: "landscape",
    });
    expect(mocks.fontSize).toHaveBeenCalledWith(12);
    expect(mocks.text).toHaveBeenCalledWith("example text", {
      align: "left",
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects invalid settings before reading the text file", async () => {
    const request = createRequest({
      pageOrientation: "sideways",
    });
    const { response, status, json } = createResponse();

    await txtToPdf(request, response);

    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.PDFDocument).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid conversion settings.",
      code: "conversion-failed",
    });
  });
});
