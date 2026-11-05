import { afterEach, describe, expect, it } from "vitest";
import {
  clearResult,
  getResultPath,
  registerResult,
  registerResults,
} from "../main/resultRegistry";

afterEach(() => {
  clearResult();
});

describe("resultRegistry", () => {
  it("registers a path under an identifier", () => {
    const resultId = registerResult("C:/temp/result.png");

    expect(resultId).toEqual(expect.any(String));
    expect(resultId.length).toBeGreaterThan(0);
    expect(resultId).not.toBe("C:/temp/result.png");
    expect(getResultPath(resultId)).toBe("C:/temp/result.png");
  });

  it("rejects an identifier when the registry is empty", () => {
    expect(() => getResultPath("unknown")).toThrow("Unknown result.");
  });

  it("rejects a foreign identifier without changing the result", () => {
    const resultId = registerResult("C:/temp/result.png");

    expect(() => getResultPath("foreign")).toThrow("Unknown result.");
    expect(getResultPath(resultId)).toBe("C:/temp/result.png");
  });

  it("invalidates the previous identifier after registration", () => {
    const previousId = registerResult("C:/temp/first.png");
    const currentId = registerResult("C:/temp/second.png");

    expect(currentId).not.toBe(previousId);
    expect(() => getResultPath(previousId)).toThrow("Unknown result.");
    expect(getResultPath(currentId)).toBe("C:/temp/second.png");
  });

  it("invalidates the identifier when cleared", () => {
    const resultId = registerResult("C:/temp/result.png");

    clearResult();

    expect(() => getResultPath(resultId)).toThrow("Unknown result.");
  });

  it("registers multiple paths with distinct IDs in input order", () => {
    const paths = ["page-1.jpg", "page-2.jpg", "page-3.jpg"];
    const ids = registerResults(paths);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.map(getResultPath)).toEqual(paths);
  });

  it("invalidates the entire previous set after registration", () => {
    const previousIds = registerResults(["old-1.jpg", "old-2.jpg"]);
    const currentIds = registerResults(["new-1.jpg", "new-2.jpg"]);

    for (const id of previousIds) {
      expect(() => getResultPath(id)).toThrow("Unknown result.");
    }

    expect(currentIds.map(getResultPath)).toEqual(["new-1.jpg", "new-2.jpg"]);
  });

  it("clears all registered results", () => {
    const ids = registerResults(["page-1.jpg", "page-2.jpg"]);

    clearResult();

    for (const id of ids) {
      expect(() => getResultPath(id)).toThrow("Unknown result.");
    }
  });

  it.each([0, 101])(
    "rejects %i paths without replacing the current results",
    (count) => {
      const ids = registerResults(["previous.jpg"]);

      expect(() =>
        registerResults(Array.from({ length: count }, (_, i) => `${i}.jpg`)),
      ).toThrow("Invalid number of paths provided.");

      expect(getResultPath(ids[0]!)).toBe("previous.jpg");
    },
  );

  it("accepts exactly 100 results", () => {
    const paths = Array.from({ length: 100 }, (_, i) => `page-${i + 1}.jpg`);
    const ids = registerResults(paths);

    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
    expect(ids.map(getResultPath)).toEqual(paths);
  });

  it("replaces a multiple-result set when registering a single result", () => {
    const previousIds = registerResults(["old-1.jpg", "old-2.jpg"]);
    const currentId = registerResult("single.png");

    for (const id of previousIds) {
      expect(() => getResultPath(id)).toThrow("Unknown result.");
    }

    expect(getResultPath(currentId)).toBe("single.png");
  });
});
