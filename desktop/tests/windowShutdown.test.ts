import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  BrowserWindow: vi.fn(), appOn: vi.fn(), quit: vi.fn(), dialog: vi.fn(),
  stop: vi.fn(), clearSource: vi.fn(), clearResult: vi.fn(), state: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { isPackaged: true, requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(), on: mocks.appOn, quit: mocks.quit },
  BrowserWindow: mocks.BrowserWindow,
  Menu: { setApplicationMenu: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn() },
  shell: { openExternal: vi.fn() },
  dialog: { showMessageBoxSync: mocks.dialog },
}));
vi.mock("../main/sourceIpc", () => ({ registerSourceIpc: vi.fn() }));
vi.mock("../main/conversionIpc", () => ({ registerConversionIpc: vi.fn() }));
vi.mock("../main/fileActionsIpc", () => ({ registerFileActionsIpc: vi.fn() }));
vi.mock("../main/registerAppProtocol", () => ({ registerAppProtocol: vi.fn() }));
vi.mock("../main/sourceRegistry", () => ({ clearSource: mocks.clearSource }));
vi.mock("../main/resultRegistry", () => ({ clearResult: mocks.clearResult }));
vi.mock("../main/startConversion", () => ({ stopActiveConversion: mocks.stop }));
vi.mock("../main/jobRegistry", () => ({ getJobState: mocks.state }));

let window: EventEmitter & { close: ReturnType<typeof vi.fn> };
function requestClose() {
  const event = { preventDefault: vi.fn() };
  window.emit("close", event);
  return event;
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.stop.mockResolvedValue(undefined);
  mocks.clearSource.mockResolvedValue(undefined);
  mocks.clearResult.mockResolvedValue(undefined);
  mocks.state.mockReturnValue({ status: "idle" });
  mocks.dialog.mockReturnValue(0);
  window = Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() }),
    loadURL: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(() => {
      const event = requestClose();
      expect(event.preventDefault).not.toHaveBeenCalled();
      window.emit("closed");
    }),
  });
  mocks.BrowserWindow.mockImplementation(function () { return window; });
  await import("../main/index");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("waits for stopping and both cleanups, ignores repeated close and permits the final close", async () => {
  let stopped!: () => void;
  let sourceRemoved!: () => void;
  let resultRemoved!: () => void;
  mocks.stop.mockReturnValue(new Promise<void>((resolve) => { stopped = resolve; }));
  mocks.clearSource.mockReturnValue(new Promise<void>((resolve) => { sourceRemoved = resolve; }));
  mocks.clearResult.mockReturnValue(new Promise<void>((resolve) => { resultRemoved = resolve; }));
  expect(requestClose().preventDefault).toHaveBeenCalledOnce();
  requestClose();
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.clearSource).not.toHaveBeenCalled();
  stopped();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.clearSource).toHaveBeenCalledOnce();
  expect(mocks.clearResult).toHaveBeenCalledOnce();
  sourceRemoved();
  await vi.advanceTimersByTimeAsync(0);
  expect(window.close).not.toHaveBeenCalled();
  resultRemoved();
  await vi.advanceTimersByTimeAsync(0);
  expect(window.close).toHaveBeenCalledOnce();
  expect(mocks.dialog).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("leaves conversion untouched on Return and asks again on another close", async () => {
  mocks.state.mockReturnValue({ status: "running", jobId: "job" });
  mocks.dialog.mockReturnValueOnce(0).mockReturnValueOnce(1);
  requestClose();
  expect(mocks.dialog).toHaveBeenCalledWith(window, expect.objectContaining({
    type: "question", defaultId: 0, cancelId: 0,
  }));
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.clearSource).not.toHaveBeenCalled();
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.dialog).toHaveBeenCalledTimes(2);
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(window.close).toHaveBeenCalledOnce();
});

it.each(["stopping", "cleanup"])("times out during %s without closing later and allows a retry", async (stage) => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  if (stage === "stopping") mocks.stop.mockReturnValueOnce(pending);
  else mocks.clearResult.mockReturnValueOnce(pending);
  requestClose();
  await vi.advanceTimersByTimeAsync(14_999);
  expect(mocks.dialog).not.toHaveBeenCalled();
  expect(window.close).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(mocks.dialog).toHaveBeenCalledExactlyOnceWith(window, expect.objectContaining({ type: "error" }));
  expect(console.error).toHaveBeenCalledWith("Could not close EasyConvert safely.", expect.objectContaining({ message: "Closing timed out." }));
  if (stage === "stopping") expect(mocks.clearSource).not.toHaveBeenCalled();
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(window.close).not.toHaveBeenCalled();
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(window.close).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not delete files after stopping fails and allows retry", async () => {
  const error = new Error("Could not stop worker");
  mocks.stop.mockRejectedValueOnce(error);
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.clearSource).not.toHaveBeenCalled();
  expect(mocks.clearResult).not.toHaveBeenCalled();
  expect(window.close).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith("Could not close EasyConvert safely.", error);
  expect(vi.getTimerCount()).toBe(0);
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(window.close).toHaveBeenCalledOnce();
});
