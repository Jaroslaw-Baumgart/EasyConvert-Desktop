import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearResult,
  getResultPath,
  registerResult,
  registerResults,
} from "../main/resultRegistry";

const mocks = vi.hoisted(() => ({ rm: vi.fn() }));
vi.mock("node:fs/promises", () => ({ rm: mocks.rm }));
beforeEach(() => { mocks.rm.mockReset().mockResolvedValue(undefined); });

afterEach(() => {
  clearResult();
});

describe("resultRegistry", () => {
  it("registers a path under an identifier", () => {
    const resultId = registerResult("C:/temp/result.png", "result-job");

    expect(resultId).toEqual(expect.any(String));
    expect(resultId.length).toBeGreaterThan(0);
    expect(resultId).not.toBe("C:/temp/result.png");
    expect(getResultPath(resultId)).toBe("C:/temp/result.png");
  });

  it("rejects an identifier when the registry is empty", () => {
    expect(() => getResultPath("unknown")).toThrow("Unknown result.");
  });

  it("rejects a foreign identifier without changing the result", () => {
    const resultId = registerResult("C:/temp/result.png", "result-job");

    expect(() => getResultPath("foreign")).toThrow("Unknown result.");
    expect(getResultPath(resultId)).toBe("C:/temp/result.png");
  });

  it("registers multiple paths with distinct IDs in input order", () => {
    const paths = ["page-1.jpg", "page-2.jpg", "page-3.jpg"];
    const ids = registerResults(paths, "result-job");

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.map(getResultPath)).toEqual(paths);
  });

  it("invalidates the entire previous set after registration", () => {
    const previousIds = registerResults(["old-1.jpg", "old-2.jpg"], "result-job");
    const currentIds = registerResults(["new-1.jpg", "new-2.jpg"], "result-job");

    for (const id of previousIds) {
      expect(() => getResultPath(id)).toThrow("Unknown result.");
    }

    expect(currentIds.map(getResultPath)).toEqual(["new-1.jpg", "new-2.jpg"]);
  });

  it("clears all registered results", () => {
    const ids = registerResults(["page-1.jpg", "page-2.jpg"], "result-job");

    clearResult();

    for (const id of ids) {
      expect(() => getResultPath(id)).toThrow("Unknown result.");
    }
  });

  it.each([0, 501])(
    "rejects %i paths without replacing the current results",
    (count) => {
      const ids = registerResults(["previous.jpg"], "result-job");

      expect(() =>
        registerResults(Array.from({ length: count }, (_, i) => `${i}.jpg`), "invalid-job"),
      ).toThrow("Invalid number of paths provided.");

      expect(getResultPath(ids[0]!)).toBe("previous.jpg");
    },
  );

  it("accepts exactly 500 results", () => {
    const paths = Array.from({ length: 500 }, (_, i) => `page-${i + 1}.jpg`);
    const ids = registerResults(paths, "result-job");

    expect(ids).toHaveLength(500);
    expect(new Set(ids).size).toBe(500);
    expect(ids.map(getResultPath)).toEqual(paths);
  });

});

it("removes only the replaced directory and clears the new directory once", () => {
  registerResult("old/result.png", "old-job");
  const id = registerResult("new/result.png", "new-job");
  expect(mocks.rm).toHaveBeenCalledExactlyOnceWith("old-job", { recursive: true, force: true });
  expect(getResultPath(id)).toBe("new/result.png");
  clearResult();
  clearResult();
  expect(mocks.rm.mock.calls).toEqual([
    ["old-job", { recursive: true, force: true }],
    ["new-job", { recursive: true, force: true }],
  ]);
});

it("logs a deletion failure while keeping identifiers invalidated", async () => {
  const error = new Error("Directory locked");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const id = registerResult("result.png", "locked-job");
  mocks.rm.mockRejectedValueOnce(error);
  try {
    const cleanup = clearResult();
    expect(() => getResultPath(id)).toThrow("Unknown result.");
    await cleanup;
    expect(log).toHaveBeenCalledExactlyOnceWith("Could not remove the result directory.", error);
  } finally {
    log.mockRestore();
  }
});

it("awaits deletion without clearing results registered during the wait", async () => {
  registerResult("old.png", "old-job");
  let finish!: () => void;
  mocks.rm.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const settled = vi.fn();
  const cleanup = clearResult().then(settled);
  const next = registerResult("new.png", "new-job");
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  finish();
  await cleanup;
  expect(getResultPath(next)).toBe("new.png");
  await clearResult();
  expect(mocks.rm).toHaveBeenLastCalledWith("new-job", { recursive: true, force: true });
});
