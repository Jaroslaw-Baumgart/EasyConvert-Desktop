import path from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const originalResourcesPath = Object.getOwnPropertyDescriptor(process, "resourcesPath");

const mocks = vi.hoisted(() => ({
  windowIpc: vi.fn(),
  loadWindowState: vi.fn(), saveWindowState: vi.fn(),
  getPath: vi.fn(), lock: vi.fn(), rm: vi.fn(), mkdir: vi.fn(), startupError: vi.fn(),
  BrowserWindow: vi.fn(), appOn: vi.fn(), quit: vi.fn(), dialog: vi.fn(),
  stop: vi.fn(), clearSource: vi.fn(), clearResult: vi.fn(), state: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { isPackaged: true, requestSingleInstanceLock: mocks.lock, getPath: mocks.getPath,
    whenReady: () => Promise.resolve(), on: mocks.appOn, quit: mocks.quit },
  BrowserWindow: mocks.BrowserWindow,
  Menu: { setApplicationMenu: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn() },
  shell: { openExternal: vi.fn() },
  dialog: { showMessageBoxSync: mocks.dialog, showErrorBox: mocks.startupError },
}));
vi.mock("node:fs/promises", () => ({ rm: mocks.rm, mkdir: mocks.mkdir }));
vi.mock("../../main/window/windowIpc", () => ({ registerWindowIpc: mocks.windowIpc }));
vi.mock("../../main/settings/settingsIpc", () => ({ registerSettingsIpc: vi.fn() }));
vi.mock("../../main/window/windowState", () => ({ loadWindowState: mocks.loadWindowState, saveWindowState: mocks.saveWindowState }));
vi.mock("../../main/sources/sourceIpc", () => ({ registerSourceIpc: vi.fn() }));
vi.mock("../../main/conversions/conversionIpc", () => ({ registerConversionIpc: vi.fn() }));
vi.mock("../../main/exports/fileActionsIpc", () => ({ registerFileActionsIpc: vi.fn() }));
vi.mock("../../main/protocol/registerAppProtocol", () => ({ registerAppProtocol: vi.fn() }));
vi.mock("../../main/sources/sourceRegistry", () => ({ clearSource: mocks.clearSource }));
vi.mock("../../main/results/resultRegistry", () => ({ clearResult: mocks.clearResult }));
vi.mock("../../main/conversions/startConversion", () => ({ stopActiveConversion: mocks.stop }));
vi.mock("../../main/conversions/jobRegistry", () => ({ getJobState: mocks.state }));

let window: EventEmitter & {
  close: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
  webContents: EventEmitter & { send: ReturnType<typeof vi.fn> };
  getNormalBounds: ReturnType<typeof vi.fn>;
  maximize: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
};
function requestClose() {
  const event = { preventDefault: vi.fn() };
  window.emit("close", event);
  return event;
}

beforeEach(async () => {
  Object.defineProperty(process, "resourcesPath", {
    configurable: true,
    value: "C:/EasyConvert/resources",
  });
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getPath.mockReturnValue("C:/test-temp");
  mocks.lock.mockReturnValue(true);
  mocks.rm.mockResolvedValue(undefined);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.loadWindowState.mockResolvedValue({ bounds: { x: 40, y: 50, width: 1100, height: 750 }, maximized: true });
  mocks.saveWindowState.mockResolvedValue(undefined);
  mocks.stop.mockResolvedValue(undefined);
  mocks.clearSource.mockResolvedValue(undefined);
  mocks.clearResult.mockResolvedValue(undefined);
  mocks.state.mockReturnValue({ status: "idle" });
  mocks.dialog.mockReturnValue(0);
  window = Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn(), send: vi.fn() }),
    loadURL: vi.fn().mockResolvedValue(undefined),
    isDestroyed: vi.fn().mockReturnValue(false),
    getNormalBounds: vi.fn().mockReturnValue({ x: 40, y: 50, width: 1100, height: 750 }),
    maximize: vi.fn(),
    show: vi.fn(),
    close: vi.fn(() => {
      const event = requestClose();
      expect(event.preventDefault).not.toHaveBeenCalled();
      window.emit("closed");
    }),
  });
  mocks.BrowserWindow.mockImplementation(function () { return window; });
  await import("../../main/index");
  await vi.advanceTimersByTimeAsync(0);
});
afterEach(() => {
  if (originalResourcesPath) {
    Object.defineProperty(process, "resourcesPath", originalResourcesPath);
  } else {
    Reflect.deleteProperty(process, "resourcesPath");
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("restores bounds and maximization before showing, then saves the normal state on close", async () => {
  expect(mocks.BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
    x: 40, y: 50, width: 1100, height: 750, show: false,
    icon: path.join("C:/EasyConvert/resources", "icons/easyconvert-black.ico"),
  }));
  expect(window.show).not.toHaveBeenCalled();
  window.emit("ready-to-show");
  expect(window.maximize).toHaveBeenCalledOnce();
  expect(window.maximize.mock.invocationCallOrder[0]).toBeLessThan(window.show.mock.invocationCallOrder[0]!);
  window.emit("unmaximize");
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.saveWindowState).toHaveBeenCalledExactlyOnceWith({ x: 40, y: 50, width: 1100, height: 750 }, false);
});

it("still closes if saving window preferences fails", async () => {
  const error = new Error("Write denied");
  mocks.saveWindowState.mockRejectedValueOnce(error);
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(console.error).toHaveBeenCalledWith("Could not save the window state.", error);
  expect(window.close).toHaveBeenCalledOnce();
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
  const respond = mocks.windowIpc.mock.calls[0]![2] as (confirmed: boolean) => Promise<void>;
  requestClose();
  requestClose();
  expect(window.webContents.send).toHaveBeenCalledExactlyOnceWith("easyconvert:close-requested");
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.clearSource).not.toHaveBeenCalled();
  await respond(false);
  expect(mocks.stop).not.toHaveBeenCalled();
  requestClose();
  expect(window.webContents.send).toHaveBeenCalledTimes(2);
  await respond(true);
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

it.each(["close", "renderer crash"])("does not delete files after stopping fails during %s and allows retry", async (origin) => {
  const error = new Error("Could not stop worker");
  mocks.stop.mockRejectedValueOnce(error);
  if (origin === "close") requestClose();
  else window.webContents.emit("render-process-gone", {}, { reason: "crashed" });
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.clearSource).not.toHaveBeenCalled();
  expect(mocks.clearResult).not.toHaveBeenCalled();
  expect(window.close).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith("Could not close EasyConvert safely.", error);
  expect(mocks.dialog).toHaveBeenCalledWith(window, expect.objectContaining({ type: "error" }));
  expect(vi.getTimerCount()).toBe(0);
  requestClose();
  await vi.advanceTimersByTimeAsync(0);
  expect(window.close).toHaveBeenCalledOnce();
});

it("cleans only its temporary root before creating the window", () => {
  const root = path.join("C:/test-temp", "EasyConvert");
  expect(mocks.getPath).toHaveBeenCalledWith("temp");
  expect(mocks.rm).toHaveBeenCalledExactlyOnceWith(root, { recursive: true, force: true });
  expect(mocks.mkdir).toHaveBeenCalledExactlyOnceWith(root, { recursive: true });
  expect(mocks.rm.mock.invocationCallOrder[0]).toBeLessThan(mocks.mkdir.mock.invocationCallOrder[0]!);
  expect(mocks.mkdir.mock.invocationCallOrder[0]).toBeLessThan(mocks.BrowserWindow.mock.invocationCallOrder[0]!);
});

it("does not clean temporary files when another instance owns the lock", async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.lock.mockReturnValue(false);
  await import("../../main/index");
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.rm).not.toHaveBeenCalled();
  expect(mocks.mkdir).not.toHaveBeenCalled();
  expect(mocks.BrowserWindow).not.toHaveBeenCalled();
  expect(mocks.quit).toHaveBeenCalledOnce();
});

it.each(["remove", "create"])("reports a startup failure during %s and quits without opening a window", async (stage) => {
  vi.resetModules();
  vi.clearAllMocks();
  const error = new Error("Temporary directory locked");
  if (stage === "remove") mocks.rm.mockRejectedValueOnce(error);
  else mocks.mkdir.mockRejectedValueOnce(error);
  await import("../../main/index");
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.BrowserWindow).not.toHaveBeenCalled();
  expect(mocks.startupError).toHaveBeenCalledExactlyOnceWith("EasyConvert", "Could not prepare temporary files. Please restart the application.");
  expect(mocks.quit).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledWith("Could not initialize EasyConvert.", error);
  if (stage === "remove") expect(mocks.mkdir).not.toHaveBeenCalled();
});

it("stops the job before cleanup after renderer crash without asking to return", async () => {
  let finishStop!: () => void;
  mocks.state.mockReturnValue({ status: "running", jobId: "job" });
  mocks.stop.mockReturnValue(new Promise<void>((resolve) => { finishStop = resolve; }));
  window.webContents.emit("render-process-gone", {}, { reason: "crashed" });
  window.webContents.emit("render-process-gone", {}, { reason: "crashed" });
  expect(mocks.startupError).toHaveBeenCalledExactlyOnceWith("EasyConvert", "The application interface stopped unexpectedly. EasyConvert will close.");
  expect(mocks.dialog).not.toHaveBeenCalled();
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.clearSource).not.toHaveBeenCalled();
  expect(window.close).not.toHaveBeenCalled();
  finishStop();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.clearSource).toHaveBeenCalledOnce();
  expect(mocks.clearResult).toHaveBeenCalledOnce();
  expect(window.close).toHaveBeenCalledOnce();
});

it("ignores renderer exit while closing or after the window is destroyed", async () => {
  window.isDestroyed.mockReturnValue(true);
  window.webContents.emit("render-process-gone", {}, { reason: "crashed" });
  expect(mocks.stop).not.toHaveBeenCalled();
  window.isDestroyed.mockReturnValue(false);
  requestClose();
  window.webContents.emit("render-process-gone", {}, { reason: "crashed" });
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.startupError).not.toHaveBeenCalled();
  window.webContents.emit("render-process-gone", {}, { reason: "clean-exit" });
  expect(mocks.stop).toHaveBeenCalledOnce();
});
