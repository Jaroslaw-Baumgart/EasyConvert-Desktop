import { EventEmitter } from "node:events";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fork: vi.fn(),
}));

vi.mock("electron", () => ({
  utilityProcess: { fork: mocks.fork },
}));

import { runJpgToPngWorker } from "../main/runJpgToPngWorker";

beforeEach(() => {
  mocks.fork.mockReset();
});

describe("runJpgToPngWorker", () => {
  it("starts the worker with conversion paths and resolves on exit 0", async () => {
    const worker = new EventEmitter();
    mocks.fork.mockReturnValue(worker);

    const completion = runJpgToPngWorker(
      "C:/input/photo.jpg",
      "C:/output/result.png",
    );

    expect(mocks.fork).toHaveBeenCalledTimes(1);

    const [modulePath, args, options] = mocks.fork.mock.calls[0];

    expect(path.isAbsolute(modulePath)).toBe(true);
    expect(modulePath).toMatch(/[/\\]worker[/\\]index\.js$/);
    expect(args).toEqual([
      "jpg-to-png",
      "C:/input/photo.jpg",
      "C:/output/result.png",
    ]);
    expect(options).toEqual({
      stdio: "inherit",
      serviceName: "EasyConvert image conversion",
    });

    worker.emit("exit", 0);

    await expect(completion).resolves.toBeUndefined();
    expect(worker.listenerCount("exit")).toBe(0);
  });

  it.each([1, 2])(
    "rejects when the worker exits with code %i",
    async (code) => {
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runJpgToPngWorker("input.jpg", "result.png");
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

    await expect(runJpgToPngWorker("input.jpg", "result.png")).rejects.toBe(
      error,
    );
  });
});
