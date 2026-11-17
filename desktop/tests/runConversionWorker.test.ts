import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartConversionRequest } from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  fork: vi.fn(),
  killProcessTree: vi.fn(),
  app: {
    isPackaged: false,
    getAppPath: vi.fn(),
  },
}));

vi.mock("electron", () => ({
  app: mocks.app,
  utilityProcess: { fork: mocks.fork },
}));

vi.mock("../main/killProcessTree", () => ({ killProcessTree: mocks.killProcessTree }));

import { runConversionWorker } from "../main/runConversionWorker";

const originalResourcesPath = Object.getOwnPropertyDescriptor(
  process,
  "resourcesPath",
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.killProcessTree.mockResolvedValue(undefined);

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

const pageOptions = { pageSize: "A3", pageOrientation: "landscape" } as const;
const cases: { request: StartConversionRequest; inputPath: string; outputPath: string }[] = [
  { request: { sourceId: "source-1", conversion: "jpg-to-png" }, inputPath: "C:/input/photo.jpg", outputPath: "C:/output/result.png" },
  { request: { sourceId: "source-1", conversion: "png-to-jpg", options: { quality: 72, backgroundColor: "#123456" } }, inputPath: "C:/input/photo.png", outputPath: "C:/output/result.jpg" },
  { request: { sourceId: "source-1", conversion: "jpg-to-pdf", options: pageOptions }, inputPath: "C:/input/photo.jpg", outputPath: "C:/output/result.pdf" },
  { request: { sourceId: "source-1", conversion: "txt-to-pdf", options: pageOptions }, inputPath: "C:/input/document.txt", outputPath: "C:/output/result.pdf" },
  { request: { sourceId: "source-1", conversion: "csv-to-pdf", options: pageOptions }, inputPath: "C:/input/table.csv", outputPath: "C:/output/result.pdf" },
  { request: { sourceId: "source-1", conversion: "pdf-to-jpg" }, inputPath: "C:/input/document.pdf", outputPath: "C:/output/pages" },
  { request: { sourceId: "source-1", conversion: "pdf-to-txt" }, inputPath: "C:/input/document.pdf", outputPath: "C:/output/result.txt" },
  { request: { sourceId: "source-1", conversion: "docx-to-pdf" }, inputPath: "C:/input/document.docx", outputPath: "C:/output/result.pdf" },
  { request: { sourceId: "source-1", conversion: "pptx-to-pdf" }, inputPath: "C:/input/presentation.pptx", outputPath: "C:/output/result.pdf" },
  { request: { sourceId: "source-1", conversion: "xlsx-to-pdf", options: { ...pageOptions, sheetName: "Costs & Revenue" } }, inputPath: "C:/input/workbook.xlsx", outputPath: "C:/output/result.pdf" },
];

for (const isPackaged of [false, true]) {
  describe(isPackaged ? "packaged conversion worker" : "development conversion worker", () => {
    it.each(cases)("sends one named JSON request for $request.conversion", async ({ request, inputPath, outputPath }) => {
      mocks.app.isPackaged = isPackaged;
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);
      const completion = runConversionWorker(inputPath, outputPath, request);
      expect(mocks.fork).toHaveBeenCalledTimes(1);
      const [modulePath, args, options] = mocks.fork.mock.calls[0];
      expect(path.isAbsolute(modulePath)).toBe(true);
      expect(modulePath).toMatch(/[/\\]worker[/\\]index\.js$/);
      expect(options).toEqual({ stdio: "inherit", serviceName: "EasyConvert conversion" });
      expect(args).toHaveLength(1);
      const message = JSON.parse(args[0]);
      const expected: Record<string, unknown> = { inputPath, outputPath, conversion: request.conversion };
      if ("options" in request) expected.options = request.options;
      const fontsDirectory = isPackaged
        ? path.join("C:/installed/EasyConvert/resources", "fonts")
        : path.resolve(__dirname, "../../../assets/fonts");
      if (request.conversion === "txt-to-pdf") expected.fontPath = path.join(fontsDirectory, "NotoSans-Regular.ttf");
      if (request.conversion === "csv-to-pdf") {
        expected.regularFontPath = path.join(fontsDirectory, "NotoSans-Regular.ttf");
        expected.boldFontPath = path.join(fontsDirectory, "NotoSans-Bold.ttf");
      }
      if (request.conversion === "pdf-to-jpg" || request.conversion === "pdf-to-txt") {
        expected.binDirectory = isPackaged
          ? path.join("C:/installed/EasyConvert/resources", "poppler/bin")
          : path.resolve(__dirname, "../../../node_modules/pdf-poppler/lib/win/poppler-0.51/bin");
      }
      if (request.conversion === "docx-to-pdf" || request.conversion === "pptx-to-pdf" || request.conversion === "xlsx-to-pdf") {
        expected.executablePath = isPackaged
          ? path.join("C:/installed/EasyConvert/resources", "libreoffice/program/soffice.com")
          : path.resolve(__dirname, "../../../tools/libreoffice/program/soffice.com");
      }
      expect(message).toEqual(expected);
      expect(mocks.app.getAppPath).not.toHaveBeenCalled();
      worker.emit("exit", 0);
      await expect(completion).resolves.toBeUndefined();
      expect(worker.listenerCount("exit")).toBe(0);
    });
  });
}

describe("worker failures", () => {
  it.each([1, 2])("rejects exit code %i", async (code) => {
    const worker = new EventEmitter();
    mocks.fork.mockReturnValue(worker);
    const completion = runConversionWorker("input.jpg", "result.png", { sourceId: "source-1", conversion: "jpg-to-png" });
    const assertion = expect(completion).rejects.toThrow(`Worker exited with code ${code}`);
    worker.emit("exit", code);
    await assertion;
  });

  it("propagates a failure to start the worker", async () => {
    const error = new Error("Cannot start worker.");
    mocks.fork.mockImplementation(() => { throw error; });
    await expect(runConversionWorker("input.jpg", "result.png", { sourceId: "source-1", conversion: "jpg-to-png" })).rejects.toBe(error);
  });
});


it("does not launch a worker for an already aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(runConversionWorker("input.jpg", "result.png", cases[0]!.request, controller.signal))
    .rejects.toBe(controller.signal.reason);
  expect(mocks.fork).not.toHaveBeenCalled();
});

function startCancellableWorker(pid: number | undefined) {
  const worker = Object.assign(new EventEmitter(), { pid, kill: vi.fn() });
  mocks.fork.mockReturnValue(worker);
  const controller = new AbortController();
  const completion = runConversionWorker("input.jpg", "result.png", cases[0]!.request, controller.signal);
  const settled = vi.fn();
  void completion.then(settled, settled);
  return { worker, controller, completion, settled };
}

it.each([0, 1])("waits for taskkill after worker exit %i and removes listeners", async (code) => {
  let finishStop!: () => void;
  mocks.killProcessTree.mockReturnValue(new Promise<void>((resolve) => { finishStop = resolve; }));
  const { worker, controller, completion, settled } = startCancellableWorker(123);
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  controller.abort();
  worker.emit("spawn");
  expect(mocks.killProcessTree).toHaveBeenCalledExactlyOnceWith(123);
  expect(worker.kill).not.toHaveBeenCalled();
  worker.emit("exit", code);
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  finishStop();
  await expect(completion).rejects.toBe(controller.signal.reason);
  expect(remove).toHaveBeenCalledExactlyOnceWith("abort", expect.any(Function));
  expect(worker.listenerCount("spawn")).toBe(0);
});

it("waits for worker exit when taskkill completes first", async () => {
  const { worker, controller, completion, settled } = startCancellableWorker(123);
  controller.abort();
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  worker.emit("exit", 1);
  await expect(completion).rejects.toBe(controller.signal.reason);
});

it("defers cancellation until spawn supplies a PID", async () => {
  const { worker, controller, completion } = startCancellableWorker(undefined);
  controller.abort();
  expect(mocks.killProcessTree).not.toHaveBeenCalled();
  worker.pid = 456;
  worker.emit("spawn");
  expect(mocks.killProcessTree).toHaveBeenCalledExactlyOnceWith(456);
  worker.emit("exit", 1);
  await expect(completion).rejects.toBe(controller.signal.reason);
});

it("reports taskkill failure only after worker exit instead of reporting cancellation", async () => {
  const error = new Error("Access denied");
  mocks.killProcessTree.mockRejectedValue(error);
  const { worker, controller, completion, settled } = startCancellableWorker(123);
  controller.abort();
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  worker.emit("exit", 1);
  await expect(completion).rejects.toBe(error);
});

it("does not stop a worker when the signal is aborted after success", async () => {
  const { worker, controller, completion } = startCancellableWorker(123);
  worker.emit("exit", 0);
  await completion;
  controller.abort();
  expect(mocks.killProcessTree).not.toHaveBeenCalled();
  expect(worker.listenerCount("spawn")).toBe(0);
});
