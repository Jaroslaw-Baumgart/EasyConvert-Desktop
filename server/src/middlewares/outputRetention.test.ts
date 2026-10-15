import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanupExpiredOutputs: vi.fn(),
}));

vi.mock("../utils/file", () => ({
  cleanupExpiredOutputs: mocks.cleanupExpiredOutputs,
}));

import { OUTPUT_DIR } from "../utils/constants";
import { outputRetention } from "./outputRetention";

describe("outputRetention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cleanupExpiredOutputs.mockResolvedValue(undefined);
  });

  it("cleans expired outputs before continuing the upload request", async () => {
    const next = vi.fn() as NextFunction;

    await outputRetention({} as Request, {} as Response, next);

    expect(mocks.cleanupExpiredOutputs).toHaveBeenCalledWith(OUTPUT_DIR);
    expect(next).toHaveBeenCalledWith();
  });
});