import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: mocks.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener,
  },
}));

async function loadApi(): Promise<EasyConvertApi> {
  await import("../preload/index");

  expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1);

  const [name, api] = mocks.exposeInMainWorld.mock.calls[0];
  expect(name).toBe("easyConvert");

  return api as EasyConvertApi;
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe("preload job subscription", () => {
  it("passes only the state to the listener", async () => {
    const api = await loadApi();
    const listener = vi.fn();
    const state: ConversionJobState = {
      status: "running",
      jobId: "job-123",
    };

    api.onJobStateChanged(listener);

    expect(mocks.on).toHaveBeenCalledTimes(1);
    const [channel, handler] = mocks.on.mock.calls[0];
    expect(channel).toBe("easyconvert:job-state-changed");

    handler({ sender: "must not reach React" }, state);

    expect(listener).toHaveBeenCalledExactlyOnceWith(state);
  });

  it("removes the same handler when unsubscribed", async () => {
    const api = await loadApi();
    const unsubscribe = api.onJobStateChanged(vi.fn());
    const handler = mocks.on.mock.calls[0][1];

    expect(mocks.removeListener).not.toHaveBeenCalled();

    unsubscribe();

    expect(mocks.removeListener).toHaveBeenCalledExactlyOnceWith(
      "easyconvert:job-state-changed",
      handler,
    );
  });

  it("stops notifications only for the removed subscription", async () => {
    const emitter = new EventEmitter();

    mocks.on.mockImplementation((channel, handler) => {
      emitter.on(channel, handler);
    });
    mocks.removeListener.mockImplementation((channel, handler) => {
      emitter.removeListener(channel, handler);
    });

    const api = await loadApi();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = api.onJobStateChanged(firstListener);
    const unsubscribeSecond = api.onJobStateChanged(secondListener);
    const state: ConversionJobState = { status: "idle" };

    unsubscribeFirst();

    emitter.emit("easyconvert:job-state-changed", {}, state);

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledExactlyOnceWith(state);

    unsubscribeSecond();

    expect(emitter.listenerCount("easyconvert:job-state-changed")).toBe(0);
  });
});
