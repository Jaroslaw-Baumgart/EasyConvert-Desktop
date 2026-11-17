import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));
import { killProcessTree } from "../main/killProcessTree";

beforeEach(() => vi.resetAllMocks());

it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid PID %s without launching taskkill", async (pid) => {
    await expect(killProcessTree(pid)).rejects.toThrow("Invalid process identifier.");
    expect(mocks.execFile).not.toHaveBeenCalled();
  },
);

it.each([false, true])("waits for taskkill and propagates failure=%s", async (failed) => {
  const completion = killProcessTree(123);
  const settled = vi.fn();
  void completion.then(settled, settled);
  expect(mocks.execFile).toHaveBeenCalledExactlyOnceWith(
    "taskkill", ["/PID", "123", "/T", "/F"],
    { windowsHide: true, timeout: 10_000 }, expect.any(Function),
  );
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  const callback = mocks.execFile.mock.calls[0][3];
  const error = new Error("Stopping failed");
  callback(failed ? error : null);
  if (failed) await expect(completion).rejects.toBe(error);
  else await expect(completion).resolves.toBeUndefined();
});
