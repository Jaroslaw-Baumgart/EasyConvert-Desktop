import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sharpMocks = vi.hoisted(() => {
  const toFile = vi.fn().mockResolvedValue(undefined);
  const jpeg = vi.fn(() => ({ toFile }));
  const flatten = vi.fn(() => ({ jpeg }));
  const png = vi.fn(() => ({ toFile }));
  const metadata = vi.fn().mockResolvedValue({ width: 100, height: 100 });
  const sharp = vi.fn(() => ({ flatten, png, metadata }));

  return {
    sharp,
    png,
    metadata,
    flatten,
    jpeg,
    toFile,
  };
});

vi.mock("sharp", () => ({
  default: sharpMocks.sharp,
}));

const pdfMocks = vi.hoisted(() => {
  const addPage = vi.fn();
  const image = vi.fn();
  const end = vi.fn();

  const stream = {
    on: vi.fn((event: string, callback: () => void) => {
      if (event === "finish") {
        callback();
      }

      return stream;
    }),
  };

  const pipe = vi.fn(() => stream);
  const PDFDocument = vi.fn(function PDFDocumentMock() {
    return {
      addPage,
      image,
      pipe,
      end,
      page: {
        width: 1190.55,
        height: 841.89,
      },
    };
  });

  const createWriteStream = vi.fn(() => ({}));

  return {
    PDFDocument,
    addPage,
    image,
    pipe,
    end,
    createWriteStream,
  };
});

vi.mock("pdfkit", () => ({
  default: pdfMocks.PDFDocument,
}));

vi.mock("fs", () => ({
  default: {
    createWriteStream: pdfMocks.createWriteStream,
  },
}));

import { jpgToPdf, jpgToPng, pngToJpg } from "./imageController";
import { MAX_IMAGE_PIXELS } from "../utils/constants";

const createRequest = (body: unknown): Request =>
  ({
    body,
    file: {
      path: "uploads/image.png",
      filename: "image.png",
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

describe("image pixel budget", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([jpgToPng, pngToJpg, jpgToPdf])("rejects oversized dimensions before conversion", async (convert) => {
    sharpMocks.metadata.mockResolvedValueOnce({ width: 10_000, height: 10_000 });
    const { response, status } = createResponse();
    await convert(createRequest({}), response);
    expect(status).toHaveBeenCalledWith(400);
    expect(sharpMocks.toFile).not.toHaveBeenCalled();
    expect(pdfMocks.PDFDocument).not.toHaveBeenCalled();
  });

  it("allows an image exactly at the pixel limit", async () => {
    sharpMocks.metadata.mockResolvedValueOnce({ width: 8_000, height: 5_000 });
    const { response, status } = createResponse();
    await jpgToPng(createRequest({}), response);
    expect(status).toHaveBeenCalledWith(200);
    expect(sharpMocks.sharp).toHaveBeenCalledWith("uploads/image.png", { limitInputPixels: MAX_IMAGE_PIXELS });
  });
});

describe("pngToJpg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes validated settings to Sharp", async () => {
    const request = createRequest({
      quality: "95",
      backgroundColor: "#000000",
    });
    const { response, status } = createResponse();

    await pngToJpg(request, response);

    expect(sharpMocks.sharp).toHaveBeenCalledWith("uploads/image.png", { limitInputPixels: MAX_IMAGE_PIXELS });
    expect(sharpMocks.flatten).toHaveBeenCalledWith({
      background: "#000000",
    });
    expect(sharpMocks.jpeg).toHaveBeenCalledWith({
      quality: 95,
    });
    expect(sharpMocks.toFile).toHaveBeenCalledWith(
      expect.stringMatching(/image\.jpg$/),
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects invalid settings without starting Sharp", async () => {
    const request = createRequest({
      quality: "101",
      backgroundColor: "#ffffff",
    });
    const { response, status, json } = createResponse();

    await pngToJpg(request, response);

    expect(sharpMocks.sharp).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid conversion settings.",
      code: "conversion-failed",
    });
  });
});

describe("jpgToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an A3 PDF with the validated landscape orientation", async () => {
    const request = createRequest({
      pageSize: "A3",
      pageOrientation: "landscape",
    });
    const { response, status } = createResponse();

    await jpgToPdf(request, response);

    expect(pdfMocks.PDFDocument).toHaveBeenCalledWith({
      autoFirstPage: false,
    });
    expect(pdfMocks.addPage).toHaveBeenCalledWith({
      size: "A3",
      layout: "landscape",
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects invalid settings without creating a PDF document", async () => {
    const request = createRequest({
      pageOrientation: "sideways",
    });
    const { response, status, json } = createResponse();

    await jpgToPdf(request, response);

    expect(pdfMocks.PDFDocument).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid conversion settings.",
      code: "conversion-failed",
    });
  });

  it("fits the image inside the selected A3 page margins", async () => {
    const request = createRequest({
      pageSize: "A3",
      pageOrientation: "landscape",
    });
    const { response } = createResponse();

    await jpgToPdf(request, response);

    expect(pdfMocks.image).toHaveBeenCalledWith("uploads/image.png", {
      fit: [1118.55, 769.89],
      align: "center",
      valign: "center",
    });
  });
});
