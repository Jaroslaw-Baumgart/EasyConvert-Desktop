import { afterEach, describe, expect, it } from "vitest";
import {
  clearResult,
  getResultPath,
  registerResult,
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
});
