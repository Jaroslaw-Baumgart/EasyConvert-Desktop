import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import type { ConvertedResults } from "../types/conversionResult";
import { useConversion } from "./useConversion";
import { convertDesktopFile } from "../api/desktopConversionClient";
import { convertFile } from "../api/conversionClient";

vi.mock("../api/desktopConversionClient", () => ({
  convertDesktopFile: vi.fn(),
}));

vi.mock("../api/conversionClient", () => ({
  convertFile: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const option = {
  conversionType: "jpg-to-png",
  sourceFormat: "jpg",
  targetFormat: "png",
  disabled: false,
} as const;

const pngOption = {
  conversionType: "png-to-jpg",
  sourceFormat: "png",
  targetFormat: "jpg",
  disabled: false,
} as const;

const xlsxOption = {
  conversionType: "xlsx-to-pdf", sourceFormat: "xlsx", targetFormat: "pdf", disabled: false,
} as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function setup() {
  const api: EasyConvertApi = {
    platform: "desktop",
    selectSource: vi.fn(),
    selectDroppedSource: vi.fn(),
    startConversion: vi.fn(),
    getJobState: vi.fn(),
    onJobStateChanged: vi.fn(),
    resetSource: vi.fn().mockResolvedValue(undefined),
    saveResult: vi.fn(),
  };

  const file = new File(["jpg"], "photo.jpg", {
    type: "image/jpeg",
  });

  const output: ConvertedResults = [
    {
      url: "app://easyconvert/preview/result/result-1",
      file: new File(["png"], "photo.png", {
        type: "image/png",
      }),
    },
  ];

  vi.stubGlobal("easyConvert", api);
  vi.mocked(convertDesktopFile).mockResolvedValue(output);

  return {
    api,
    file,
    output,
    ...renderHook(() => useConversion()),
  };
}

async function setupConvertedFile() {
  const fixture = setup();

  act(() => {
    fixture.result.current.selectFile(fixture.file, "source-1");
  });

  await act(async () => {
    await fixture.result.current.convert(option);
  });

  return fixture;
}

describe("desktop useConversion", () => {
  it.each([
    { pageSize: "A3", pageOrientation: "landscape", sheetName: "Koszty" },
    { pageSize: "A4", pageOrientation: "portrait" },
  ] as const)("passes XLSX selection and page settings %j to desktop without HTTP", async (settings) => {
    const { api, result, output } = setup();
    const file = new File(["xlsx"], "workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    act(() => result.current.selectFile(file, "source-xlsx"));
    await act(async () => { await result.current.convert(xlsxOption, settings); });
    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api, { sourceId: "source-xlsx", conversion: "xlsx-to-pdf", options: settings },
      "workbook.xlsx", expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
  });

  it("rejects XLSX without page settings before calling either adapter", async () => {
    const { result, file } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => result.current.selectFile(file, "source-xlsx"));
    await act(async () => { await result.current.convert(xlsxOption); });
    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBeNull();
    expect(result.current.isConverting).toBe(false);
  });
  it("passes CSV to PDF page settings to the desktop adapter", async () => {
    const { api, result } = setup();
    const file = new File(["ID,Name\n1,Łukasz"], "table.csv", {
      type: "text/csv",
    });
    const output: ConvertedResults = [{
      url: "app://easyconvert/preview/result/result-csv",
      file: new File(["pdf"], "table.pdf", { type: "application/pdf" }),
    }];
    vi.mocked(convertDesktopFile).mockResolvedValue(output);

    act(() => {
      result.current.selectFile(file, "source-csv");
    });
    await act(async () => {
      await result.current.convert({
        conversionType: "csv-to-pdf",
        sourceFormat: "csv",
        targetFormat: "pdf",
        disabled: false,
      }, { pageSize: "A3", pageOrientation: "landscape" });
    });

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      {
        sourceId: "source-csv",
        conversion: "csv-to-pdf",
        options: { pageSize: "A3", pageOrientation: "landscape" },
      },
      "table.csv",
      expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("passes the JPG to PNG request and signal and stores the result", async () => {
    const { api, result, output } = await setupConvertedFile();

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      {
        sourceId: "source-1",
        conversion: "jpg-to-png",
      },
      "photo.jpg",
      expect.any(AbortSignal),
    );

    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("passes PNG to JPG quality and background to the desktop adapter", async () => {
    const { api, result } = setup();
    const file = new File(["png"], "transparent.png", {
      type: "image/png",
    });
    const output: ConvertedResults = [
      {
        url: "app://easyconvert/preview/result/result-2",
        file: new File(["jpg"], "transparent.jpg", {
          type: "image/jpeg",
        }),
      },
    ];

    vi.mocked(convertDesktopFile).mockResolvedValue(output);

    act(() => {
      result.current.selectFile(file, "source-2");
    });

    await act(async () => {
      await result.current.convert(pngOption, {
        quality: 72,
        backgroundColor: "#123456",
      });
    });

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      {
        sourceId: "source-2",
        conversion: "png-to-jpg",
        options: {
          quality: 72,
          backgroundColor: "#123456",
        },
      },
      "transparent.png",
      expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("rejects PNG to JPG without settings before calling either adapter", async () => {
    const { result } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => {
      result.current.selectFile(
        new File(["png"], "photo.png", { type: "image/png" }),
        "source-2",
      );
    });

    await act(async () => {
      await result.current.convert(pngOption);
    });

    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.conversionError).not.toBeNull();
    expect(result.current.isConverting).toBe(false);
  });

  it("does not fall back to HTTP when the file has no source ID", async () => {
    const { result, file } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => {
      result.current.selectFile(file);
    });

    await act(async () => {
      await result.current.convert(option);
    });

    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.conversionError).not.toBeNull();
  });

  it("keeps the file and result until reset succeeds, then clears both", async () => {
    const { api, result, file, output } = await setupConvertedFile();
    const reset = deferred<void>();

    vi.mocked(api.resetSource).mockReturnValueOnce(reset.promise);

    let removal!: Promise<void>;

    act(() => {
      removal = result.current.removeFile();
    });

    expect(api.resetSource).toHaveBeenCalledExactlyOnceWith();
    expect(result.current.isRemoving).toBe(true);
    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);

    await act(async () => {
      reset.resolve(undefined);
      await removal;
    });

    expect(result.current.file).toBeNull();
    expect(result.current.convertedResults).toBeNull();
    expect(result.current.conversionError).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("preserves the file and result after a reset failure and allows retry", async () => {
    const { api, result, file, output } = await setupConvertedFile();

    vi.mocked(api.resetSource).mockRejectedValueOnce(
      new Error("Reset failed."),
    );

    await act(async () => {
      await result.current.removeFile();
    });

    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.conversionError).toBe("Reset failed.");
    expect(result.current.isRemoving).toBe(false);

    await act(async () => {
      await result.current.removeFile();
    });

    expect(api.resetSource).toHaveBeenCalledTimes(2);
    expect(result.current.file).toBeNull();
    expect(result.current.convertedResults).toBeNull();
    expect(result.current.conversionError).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("blocks duplicate removal, conversion and replacement while reset is pending", async () => {
    const { api, result, file, output } = await setupConvertedFile();
    const reset = deferred<void>();

    vi.mocked(api.resetSource).mockReturnValueOnce(reset.promise);
    vi.mocked(convertDesktopFile).mockClear();

    // Te same callbacki sprawdzają blokadę przed kolejnym renderem.
    const actions = result.current;
    let removal!: Promise<void>;

    await act(async () => {
      removal = actions.removeFile();

      await actions.removeFile();
      await actions.convert(option);

      actions.selectFile(
        new File(["replacement"], "replacement.jpg"),
        "source-2",
      );
    });

    expect(api.resetSource).toHaveBeenCalledTimes(1);
    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isRemoving).toBe(true);

    await act(async () => {
      reset.resolve(undefined);
      await removal;
    });

    expect(result.current.file).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("does not reset a source while its conversion is starting or running", async () => {
    const { api, result, file, output } = setup();
    const conversion = deferred<ConvertedResults>();

    vi.mocked(convertDesktopFile).mockReturnValueOnce(conversion.promise);

    act(() => {
      result.current.selectFile(file, "source-1");
    });

    const actions = result.current;
    let running!: Promise<void>;

    await act(async () => {
      running = actions.convert(option);
      await actions.removeFile();
    });

    expect(result.current.isConverting).toBe(true);

    await act(async () => {
      await result.current.removeFile();
    });

    expect(api.resetSource).not.toHaveBeenCalled();
    expect(result.current.file).toBe(file);

    await act(async () => {
      conversion.resolve(output);
      await running;
    });

    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("does not call reset when no file is selected", async () => {
    const { api, result } = setup();

    await act(async () => {
      await result.current.removeFile();
    });

    expect(api.resetSource).not.toHaveBeenCalled();
    expect(result.current.file).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("passes JPG to PDF page settings to the desktop adapter", async () => {
    const { api, result, file } = setup();
    const output: ConvertedResults = [
      {
        url: "app://easyconvert/preview/result/result-pdf",
        file: new File(["pdf"], "photo.pdf", {
          type: "application/pdf",
        }),
      },
    ];

    vi.mocked(convertDesktopFile).mockResolvedValue(output);

    act(() => {
      result.current.selectFile(file, "source-1");
    });

    await act(async () => {
      await result.current.convert(
        {
          conversionType: "jpg-to-pdf",
          sourceFormat: "jpg",
          targetFormat: "pdf",
          disabled: false,
        },
        {
          pageSize: "A3",
          pageOrientation: "landscape",
        },
      );
    });

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      {
        sourceId: "source-1",
        conversion: "jpg-to-pdf",
        options: {
          pageSize: "A3",
          pageOrientation: "landscape",
        },
      },
      "photo.jpg",
      expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("passes PDF to TXT without settings and stores the text result", async () => {
    const { api, result } = setup();
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    const output: ConvertedResults = [{
      url: "app://easyconvert/preview/result/result-text",
      file: new File(["Page 1\n\fPage 2"], "document.txt", { type: "text/plain" }),
    }];
    vi.mocked(convertDesktopFile).mockResolvedValue(output);

    act(() => result.current.selectFile(file, "source-pdf"));
    await act(async () => {
      await result.current.convert({
        conversionType: "pdf-to-txt",
        sourceFormat: "pdf",
        targetFormat: "txt",
        disabled: false,
      });
    });

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      { sourceId: "source-pdf", conversion: "pdf-to-txt" },
      "document.pdf",
      expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it.each([
    { option: { conversionType: "docx-to-pdf", sourceFormat: "docx", targetFormat: "pdf", disabled: false }, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { option: { conversionType: "pptx-to-pdf", sourceFormat: "pptx", targetFormat: "pdf", disabled: false }, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  ] as const)("passes $option.conversionType without settings and stores its result", async ({ option, mime }) => {
    const { api, result, output } = setup();
    const file = new File(["office"], `document.${option.sourceFormat}`, {
      type: mime,
    });
    vi.mocked(convertDesktopFile).mockResolvedValue(output);
    act(() => result.current.selectFile(file, "source-docx"));
    await act(async () => {
      await result.current.convert(option);
    });
    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api, { sourceId: "source-docx", conversion: option.conversionType },
      file.name, expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("passes TXT to PDF page settings to the desktop adapter", async () => {
    const { api, result } = setup();
    const file = new File(["Zażółć gęślą jaźń"], "polski-tekst.txt", {
      type: "text/plain",
    });
    const output: ConvertedResults = [
      {
        url: "app://easyconvert/preview/result/result-txt",
        file: new File(["pdf"], "polski-tekst.pdf", {
          type: "application/pdf",
        }),
      },
    ];

    vi.mocked(convertDesktopFile).mockResolvedValue(output);

    act(() => {
      result.current.selectFile(file, "source-txt");
    });

    await act(async () => {
      await result.current.convert(
        {
          conversionType: "txt-to-pdf",
          sourceFormat: "txt",
          targetFormat: "pdf",
          disabled: false,
        },
        {
          pageSize: "A3",
          pageOrientation: "landscape",
        },
      );
    });

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      {
        sourceId: "source-txt",
        conversion: "txt-to-pdf",
        options: {
          pageSize: "A3",
          pageOrientation: "landscape",
        },
      },
      "polski-tekst.txt",
      expect.any(AbortSignal),
    );
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });
});
