import { EventEmitter } from "node:events";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StartConversionRequest } from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  fork: vi.fn(),
}));

vi.mock("electron", () => ({
  utilityProcess: { fork: mocks.fork },
}));

import { runImageWorker } from "../main/runImageWorker";

beforeEach(() => {
  mocks.fork.mockReset();
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
];

describe("runImageWorker", () => {
  it.each(cases)(
    "starts $request.conversion with its paths and settings",
    async ({ request, inputPath, outputPath, expectedArgs }) => {
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runImageWorker(inputPath, outputPath, request);

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

  it.each([1, 2])(
    "rejects when the worker exits with code %i",
    async (code) => {
      const worker = new EventEmitter();
      mocks.fork.mockReturnValue(worker);

      const completion = runImageWorker("input.jpg", "result.png", {
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
      runImageWorker("input.jpg", "result.png", {
        sourceId: "source-123",
        conversion: "jpg-to-png",
      }),
    ).rejects.toBe(error);
  });
});
