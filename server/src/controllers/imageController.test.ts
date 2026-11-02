import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jpgToPng: vi.fn(),
  pngToJpg: vi.fn(),
  jpgToPdf: vi.fn(),
}));

vi.mock("../../../conversion-core/image/convertJpgToPng", () => ({
  convertJpgToPng: mocks.jpgToPng,
}));

vi.mock("../../../conversion-core/image/convertPngToJpg", () => ({
  convertPngToJpg: mocks.pngToJpg,
}));

vi.mock("../../../conversion-core/image/convertJpgToPdf", () => ({
  convertJpgToPdf: mocks.jpgToPdf,
}));

import { jpgToPdf, jpgToPng, pngToJpg } from "./imageController";

function createRequest(body: unknown): Request {
  return {
    body,
    file: {
      path: "uploads/image.jpg",
      filename: "image.jpg",
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
  mocks.jpgToPng.mockResolvedValue(undefined);
  mocks.pngToJpg.mockResolvedValue(undefined);
  mocks.jpgToPdf.mockResolvedValue(undefined);
});

describe("image controllers", () => {
  it.each([
    { controller: jpgToPng, engine: mocks.jpgToPng },
    { controller: pngToJpg, engine: mocks.pngToJpg },
    { controller: jpgToPdf, engine: mocks.jpgToPdf },
  ])(
    "rejects a missing file before calling $controller.name",
    async ({ controller, engine }) => {
      const request = { body: {} } as Request;
      const { response, status } = createResponse();

      await controller(request, response);

      expect(status).toHaveBeenCalledWith(400);
      expect(engine).not.toHaveBeenCalled();
    },
  );

  it("delegates JPG to PNG and returns its output", async () => {
    const { response, status, json } = createResponse();

    await jpgToPng(createRequest({}), response);

    expect(mocks.jpgToPng).toHaveBeenCalledExactlyOnceWith(
      "uploads/image.jpg",
      expect.stringMatching(/image\.png$/),
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("passes coerced PNG to JPG settings to the engine", async () => {
    const { response, status } = createResponse();

    await pngToJpg(
      createRequest({
        quality: "95",
        backgroundColor: "#000000",
      }),
      response,
    );

    expect(mocks.pngToJpg).toHaveBeenCalledExactlyOnceWith(
      "uploads/image.jpg",
      expect.stringMatching(/image\.jpg$/),
      { quality: 95, backgroundColor: "#000000" },
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("preserves default PNG to JPG settings", async () => {
    const { response } = createResponse();

    await pngToJpg(createRequest({}), response);

    expect(mocks.pngToJpg).toHaveBeenCalledExactlyOnceWith(
      "uploads/image.jpg",
      expect.any(String),
      { quality: 85, backgroundColor: "#ffffff" },
    );
  });

  it("rejects invalid PNG settings before calling the engine", async () => {
    const { response, status, json } = createResponse();

    await pngToJpg(createRequest({ quality: "101" }), response);

    expect(mocks.pngToJpg).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid conversion settings.",
      code: "conversion-failed",
    });
  });

  it("passes A3 landscape settings and returns PDF success", async () => {
    const { response, status, json } = createResponse();

    await jpgToPdf(
      createRequest({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
      response,
    );

    expect(mocks.jpgToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/image.jpg",
      expect.stringMatching(/image\.pdf$/),
      { pageSize: "A3", pageOrientation: "landscape" },
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("preserves default PDF page settings", async () => {
    const { response } = createResponse();

    await jpgToPdf(createRequest({}), response);

    expect(mocks.jpgToPdf).toHaveBeenCalledExactlyOnceWith(
      "uploads/image.jpg",
      expect.any(String),
      { pageSize: "A4", pageOrientation: "portrait" },
    );
  });

  it.each([{ pageOrientation: "sideways" }, { pageSize: "A5" }])(
    "rejects invalid PDF settings: %j",
    async (settings) => {
      const { response, status, json } = createResponse();

      await jpgToPdf(createRequest(settings), response);

      expect(mocks.jpgToPdf).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid conversion settings.",
        code: "conversion-failed",
      });
    },
  );

  it("returns an HTTP error when PDF conversion fails", async () => {
    mocks.jpgToPdf.mockRejectedValue(new Error("PDF creation failed."));
    const { response, status, json } = createResponse();

    await jpgToPdf(createRequest({}), response);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "PDF creation failed.",
      code: "conversion-failed",
    });
  });
});
