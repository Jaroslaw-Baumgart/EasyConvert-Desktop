import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const readFile = vi.fn();
  const mkdir = vi.fn();
  const parseCsv = vi.fn();

  const stream = {
    on: vi.fn((event: string, callback: () => void) => {
      if (event === "finish") {
        callback();
      }

      return stream;
    }),
  };

  const createWriteStream = vi.fn(() => stream);
  const pipe = vi.fn();
  const font = vi.fn();
  const text = vi.fn();
  const rect = vi.fn();
  const fill = vi.fn();
  const stroke = vi.fn();
  const lineWidth = vi.fn();
  const strokeColor = vi.fn();
  const fillColor = vi.fn();
  const end = vi.fn();
  const addPage = vi.fn();

  let currentFontSize = 10;

  const widthOfString = vi.fn(
    (value: string) => value.length * currentFontSize * 0.5,
  );

  const heightOfString = vi.fn((_value?: string) => 12);

  const fontSize = vi.fn((size: number) => {
    currentFontSize = size;

    return document;
  });

  const document = {
    pipe,
    font,
    fontSize,
    text,
    rect,
    fill,
    stroke,
    lineWidth,
    strokeColor,
    fillColor,
    end,
    addPage,
    widthOfString,
    heightOfString,
    page: {
      width: 841.89,
      height: 595.28,
    },
  };

  pipe.mockReturnValue(stream);
  font.mockReturnValue(document);
  text.mockReturnValue(document);
  rect.mockReturnValue(document);
  fill.mockReturnValue(document);
  stroke.mockReturnValue(document);
  lineWidth.mockReturnValue(document);
  strokeColor.mockReturnValue(document);
  fillColor.mockReturnValue(document);
  addPage.mockReturnValue(document);

  const PDFDocument = vi.fn(function PDFDocumentMock() {
    return document;
  });

  return {
    readFile,
    mkdir,
    parseCsv,
    createWriteStream,
    pipe,
    font,
    fontSize,
    text,
    rect,
    fill,
    stroke,
    lineWidth,
    strokeColor,
    fillColor,
    end,
    addPage,
    widthOfString,
    heightOfString,
    PDFDocument,
  };
});

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
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

vi.mock("../utils/csv", () => ({
  parseCsv: mocks.parseCsv,
}));

import { csvToPdf } from "./csvController";

const createRequest = (body: unknown): Request =>
  ({
    body,
    file: {
      path: "uploads/payroll.csv",
      filename: "payroll.csv",
      originalname: "payroll.csv",
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

describe("csvToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mkdir.mockResolvedValue(undefined);
    mocks.readFile.mockResolvedValue("ID,Name\n1,Ada");
    mocks.parseCsv.mockReturnValue([
      { ID: "1", Name: "Ada" },
      { ID: "2", Name: "Jan" },
    ]);
  });

  it("renders CSV headers and values as individual table cells", async () => {
    const { response, status } = createResponse();

    await csvToPdf(
      createRequest({ pageSize: "A3", pageOrientation: "landscape" }),
      response,
    );

    expect(mocks.PDFDocument).toHaveBeenCalledWith({
      size: "A3",
      layout: "landscape",
    });

    const renderedValues = mocks.text.mock.calls.map(([value]) => value);

    expect(renderedValues).toEqual(
      expect.arrayContaining(["ID", "Name", "1", "Ada", "2", "Jan"]),
    );
    expect(mocks.rect).toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects an empty CSV as invalid input", async () => {
    mocks.parseCsv.mockReturnValue([]);

    const { response, status, json } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(mocks.PDFDocument).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "CSV file is empty.",
      code: "conversion-failed",
    });
  });

  it("starts a new page and repeats headers when rows exceed the page height", async () => {
    mocks.parseCsv.mockReturnValue(
      Array.from({ length: 25 }, (_, index) => ({
        ID: String(index + 1),
        Name: `Employee ${index + 1}`,
      })),
    );

    const { response, status } = createResponse();

    await csvToPdf(createRequest({}), response);

    expect(mocks.addPage).toHaveBeenCalledOnce();

    const renderedValues = mocks.text.mock.calls.map(([value]) => value);

    expect(renderedValues.filter((value) => value === "ID")).toHaveLength(2);
    expect(renderedValues.filter((value) => value === "Name")).toHaveLength(2);
    expect(status).toHaveBeenCalledWith(200);
  });

  it("continues a tall row on following pages without losing its content", async () => {
    const longDescription = "A".repeat(1_000);
    mocks.heightOfString.mockImplementation(
      (value?: string) => value?.length ?? 0,
    );
    mocks.parseCsv.mockReturnValue([{ Description: longDescription }]);

    const { response, status } = createResponse();

    await csvToPdf(createRequest({}), response);

    const renderedDescription = mocks.text.mock.calls
      .map(([value]) => value)
      .filter((value) => typeof value === "string" && /^A+$/.test(value))
      .join("");

    expect(mocks.addPage).toHaveBeenCalled();
    expect(renderedDescription).toBe(longDescription);
    expect(status).toHaveBeenCalledWith(200);
  });

  it("shrinks the font to keep a wide CSV on one page", async () => {
    mocks.parseCsv.mockReturnValue([
      {
        "Column 1": "abcdefghijklmnopqrst",
        "Column 2": "abcdefghijklmnopqrst",
        "Column 3": "abcdefghijklmnopqrst",
        "Column 4": "abcdefghijklmnopqrst",
        "Column 5": "abcdefghijklmnopqrst",
        "Column 6": "abcdefghijklmnopqrst",
        "Column 7": "abcdefghijklmnopqrst",
        "Column 8": "abcdefghijklmnopqrst",
        "Column 9": "abcdefghijklmnopqrst",
        "Column 10": "abcdefghijklmnopqrst",
      },
    ]);

    const { response, status } = createResponse();

    await csvToPdf(createRequest({ pageOrientation: "landscape" }), response);

    expect(mocks.fontSize).toHaveBeenCalledWith(6);
    expect(mocks.addPage).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(200);
  });
});
