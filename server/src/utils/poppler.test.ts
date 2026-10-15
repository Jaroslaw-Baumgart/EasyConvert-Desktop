import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));
import { pdfToImages, runPoppler } from "./poppler";

beforeEach(() => { mocks.execFile.mockReset(); });

it("passes cancellation to Poppler and rejects when its process is aborted", async () => {
  const controller = new AbortController();
  const abortError = new DOMException("Cancelled", "AbortError");
  mocks.execFile.mockImplementation((_file: string, _args: string[], options: { signal: AbortSignal }, callback: (error: Error | null, stdout: string) => void) => {
    expect(options.signal).toBe(controller.signal);
    options.signal.addEventListener("abort", () => callback(abortError, ""), { once: true });
  });
  const conversion = runPoppler("pdftotext", ["input.pdf", "output.txt"], controller.signal);
  const rejected = expect(conversion).rejects.toBe(abortError);
  controller.abort();
  await rejected;
});

it("forwards the same signal to PDF inspection and image conversion", async () => {
  const controller = new AbortController();
  mocks.execFile.mockImplementation((_file: string, args: string[], options: { signal: AbortSignal }, callback: (error: Error | null, stdout: string) => void) => {
    expect(options.signal).toBe(controller.signal);
    callback(null, args.length === 1 ? "Pages: 2\n" : "");
  });
  await pdfToImages("input.pdf", "output", controller.signal);
  expect(mocks.execFile).toHaveBeenCalledTimes(2);
});
