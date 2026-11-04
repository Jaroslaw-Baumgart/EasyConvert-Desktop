import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartConversionRequest } from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  fork: vi.fn(),
  app: {
    isPackaged: false,
    getAppPath: vi.fn(),
  },
}));

vi.mock("electron", () => ({
  app: mocks.app,
  utilityProcess: { fork: mocks.fork },
}));

import { runConversionWorker } from "../main/runConversionWorker";

const originalResourcesPath = Object.getOwnPropertyDescriptor(
  process,
  "resourcesPath",
);

beforeEach(() => {
  vi.resetAllMocks();

  mocks.app.isPackaged = false;
  mocks.app.getAppPath.mockReturnValue("C:/projects/EasyConvert");

  Object.defineProperty(process, "resourcesPath", {
    configurable: true,
    writable: true,
    value: "C:/installed/EasyConvert/resources",
  });
});

afterEach(() => {
  if (originalResourcesPath) {
    Object.defineProperty(process, "resourcesPath", originalResourcesPath);
  } else {
    Reflect.deleteProperty(process, "resourcesPath");
  }
});

const cases: {
  request: StartConversionRequest;
  inputPath: string;
  outputPath: string;
  expectedArgs: string[];
}[] = [
  {
    request: {
      sourceId: "source-123",
      conversion: "jpg-to-png",
    },
    inputPath: "C:/input/photo.jpg",
    outputPath: "C:/output/result.png",
    expectedArgs: ["jpg-to-png", "C:/input/photo.jpg", "C:/output/result.png"],
  },
  {
    request: {
      sourceId: "source-123",
      conversion: "png-to-jpg",
      options: {
        quality: 72,
        backgroundColor: "#123456",
      },
    },
    inputPath: "C:/input/photo.png",
    outputPath: "C:/output/result.jpg",
    expectedArgs: [
      "png-to-jpg",
      "C:/input/photo.png",
      "C:/output/result.jpg",
      JSON.stringify({
        quality: 72,
        backgroundColor: "#123456",
      }),
    ],
  },
  {
    request: {
      sourceId: "source-123",
      conversion: "jpg-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    },
    inputPath: "C:/input/photo.jpg",
    outputPath: "C:/output/result.pdf",
    expectedArgs: [
      "jpg-to-pdf",
      "C:/input/photo.jpg",
      "C:/output/result.pdf",
      JSON.stringify({
        pageSize: "A3",
        pageOrientation: "landscape",
      }),
    ],
  },
];

describe("runConversionWorker", () => {
  it.each(cases)(
    "starts $request.conversion with its paths and settings",
    async ({ request, inputPath, outputPath, expectedArgs }) => {
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runConversionWorker(inputPath, outputPath, request);

      expect(mocks.fork).toHaveBeenCalledTimes(1);

      const [modulePath, args, options] = mocks.fork.mock.calls[0];

      expect(path.isAbsolute(modulePath)).toBe(true);
      expect(modulePath).toMatch(/[/\\]worker[/\\]index\.js$/);
      expect(args).toEqual(expectedArgs);
      expect(options).toEqual({
        stdio: "inherit",
        serviceName: "EasyConvert image conversion",
      });

      worker.emit("exit", 0);

      await expect(completion).resolves.toBeUndefined();
      expect(worker.listenerCount("exit")).toBe(0);
    },
  );

  it.each([
    {
      label: "development",
      isPackaged: false,
      expectedFontPath: path.resolve(
        __dirname,
        "../../../assets/fonts/NotoSans-Regular.ttf",
      ),
    },
    {
      label: "packaged application",
      isPackaged: true,
      expectedFontPath: path.join(
        "C:/installed/EasyConvert/resources",
        "fonts/NotoSans-Regular.ttf",
      ),
    },
  ])(
    "passes TXT settings and the font path for $label",
    async ({ isPackaged, expectedFontPath }) => {
      mocks.app.isPackaged = isPackaged;

      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runConversionWorker(
        "C:/input/document.txt",
        "C:/output/result.pdf",
        {
          sourceId: "source-123",
          conversion: "txt-to-pdf",
          options: {
            pageSize: "A3",
            pageOrientation: "landscape",
          },
        },
      );

      expect(mocks.fork).toHaveBeenCalledTimes(1);
      expect(mocks.fork.mock.calls[0][1]).toEqual([
        "txt-to-pdf",
        "C:/input/document.txt",
        "C:/output/result.pdf",
        JSON.stringify({
          pageSize: "A3",
          pageOrientation: "landscape",
        }),
        expectedFontPath,
      ]);

      expect(mocks.app.getAppPath).not.toHaveBeenCalled();

      worker.emit("exit", 0);

      await expect(completion).resolves.toBeUndefined();
    },
  );

  it.each([false, true])(
    "passes CSV settings and both fonts when isPackaged=%s",
    async (isPackaged) => {
      mocks.app.isPackaged = isPackaged;
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runConversionWorker(
        "C:/input/table.csv",
        "C:/output/result.pdf",
        {
          sourceId: "source-csv",
          conversion: "csv-to-pdf",
          options: {
            pageSize: "A3",
            pageOrientation: "landscape",
          },
        },
      );

      const fontsDirectory = isPackaged
        ? path.join("C:/installed/EasyConvert/resources", "fonts")
        : path.resolve(__dirname, "../../../assets/fonts");

      expect(mocks.fork).toHaveBeenCalledTimes(1);
      expect(mocks.fork.mock.calls[0][1]).toEqual([
        "csv-to-pdf",
        "C:/input/table.csv",
        "C:/output/result.pdf",
        JSON.stringify({
          pageSize: "A3",
          pageOrientation: "landscape",
        }),
        path.join(fontsDirectory, "NotoSans-Regular.ttf"),
        path.join(fontsDirectory, "NotoSans-Bold.ttf"),
      ]);

      worker.emit("exit", 0);
      await expect(completion).resolves.toBeUndefined();
    },
  );

  it.each([1, 2])(
    "rejects when the worker exits with code %i",
    async (code) => {
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runConversionWorker("input.jpg", "result.png", {
        sourceId: "source-123",
        conversion: "jpg-to-png",
      });

      const assertion = expect(completion).rejects.toThrow(
        `Worker exited with code ${code}`,
      );

      worker.emit("exit", code);

      await assertion;
    },
  );

  it("rejects when the worker cannot be started", async () => {
    const error = new Error("Cannot start worker.");

    mocks.fork.mockImplementation(() => {
      throw error;
    });

    await expect(
      runConversionWorker("input.jpg", "result.png", {
        sourceId: "source-123",
        conversion: "jpg-to-png",
      }),
    ).rejects.toBe(error);
  });
});
