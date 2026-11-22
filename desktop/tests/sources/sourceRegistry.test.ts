import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs/promises", () => ({ rm: vi.fn().mockResolvedValue(undefined) }));

import {
  clearSource,
  getCurrentSourceDirectory,
  getCurrentSourcePath,
  getOriginalSourcePath,
  getSourcePath,
  registerSource,
} from "../../main/sources/sourceRegistry";

function registerTestSource(name = "photo.jpg"): string {
  return registerSource(`C:/working/${name}`, `C:/fixtures/${name}`, "C:/working");
}

afterEach(async () => {
  await clearSource();
});

describe("sourceRegistry", () => {
  it("keeps the original and working paths under an opaque identifier", () => {
    const sourceId = registerTestSource();

    expect(sourceId).toEqual(expect.any(String));
    expect(sourceId.length).toBeGreaterThan(0);
    expect(sourceId).not.toBe("C:/fixtures/photo.jpg");
    expect(getSourcePath(sourceId)).toBe("C:/working/photo.jpg");
    expect(getCurrentSourcePath()).toBe("C:/working/photo.jpg");
    expect(getOriginalSourcePath()).toBe("C:/fixtures/photo.jpg");
    expect(getCurrentSourceDirectory()).toBe("C:/working");
  });

  it("rejects an identifier when no source is registered", () => {
    expect(() => getSourcePath("unknown")).toThrow("Unknown source.");
  });

  it("rejects a foreign identifier", () => {
    registerTestSource();

    expect(() => getSourcePath("unknown")).toThrow("Unknown source.");
  });

  it("invalidates the previous identifier after a new registration", () => {
    const firstId = registerTestSource("first.jpg");
    const secondId = registerTestSource("second.jpg");

    expect(secondId).not.toBe(firstId);
    expect(getSourcePath(secondId)).toBe("C:/working/second.jpg");
    expect(() => getSourcePath(firstId)).toThrow("Unknown source.");
  });

  it("invalidates the identifier when cleared", () => {
    const sourceId = registerTestSource();

    clearSource();

    expect(() => getSourcePath(sourceId)).toThrow("Unknown source.");
  });
});


it("awaits deletion without clearing a source registered during the wait", async () => {
  registerTestSource();
  let finish!: () => void;
  vi.mocked(rm).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const settled = vi.fn();
  const cleanup = clearSource().then(settled);
  const next = registerSource("new/photo.jpg", "original.jpg", "new-job");
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  expect(getCurrentSourceDirectory()).toBe("new-job");
  finish();
  await cleanup;
  expect(getSourcePath(next)).toBe("new/photo.jpg");
  await clearSource();
  expect(rm).toHaveBeenLastCalledWith("new-job", { recursive: true, force: true });
});
