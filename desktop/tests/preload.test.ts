import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../shared/desktopContract";

const CHANNEL = "easyconvert:job-state-changed";

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  getPathForFile: vi.fn(),
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
  webUtils: {
    getPathForFile: mocks.getPathForFile,
  },
}));

async function setup() {
  const emitter = new EventEmitter();

  mocks.on.mockImplementation((channel, handler) => {
    emitter.on(channel, handler);
  });

  mocks.removeListener.mockImplementation((channel, handler) => {
    emitter.removeListener(channel, handler);
  });

  await import("../preload/index");

  expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1);

  const [name, exposedApi] = mocks.exposeInMainWorld.mock.calls[0];
  expect(name).toBe("easyConvert");

  return {
    api: exposedApi as EasyConvertApi,
    emitter,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const validStates: ConversionJobState[] = [
  { status: "idle" },
  { status: "running", jobId: "job-1" },
  { status: "succeeded", jobId: "job-1", resultId: "result-1" },
  { status: "failed", jobId: "job-1", message: "Conversion failed." },
  { status: "cancelled", jobId: "job-1" },
  {
    status: "succeeded",
    jobId: "j".repeat(128),
    resultId: "r".repeat(128),
  },
];

const invalidStates: { label: string; value: unknown }[] = [
  { label: "null", value: null },
  { label: "undefined", value: undefined },
  { label: "a primitive", value: "running" },
  { label: "an array", value: [] },
  { label: "missing status", value: {} },
  {
    label: "unknown status",
    value: { status: "finished", jobId: "job-1" },
  },
  {
    label: "missing jobId",
    value: { status: "running" },
  },
  {
    label: "non-string jobId",
    value: { status: "running", jobId: 123 },
  },
  {
    label: "empty jobId",
    value: { status: "running", jobId: "" },
  },
  {
    label: "oversized jobId",
    value: { status: "running", jobId: "j".repeat(129) },
  },
  {
    label: "missing resultId",
    value: { status: "succeeded", jobId: "job-1" },
  },
  {
    label: "non-string resultId",
    value: { status: "succeeded", jobId: "job-1", resultId: 123 },
  },
  {
    label: "empty resultId",
    value: { status: "succeeded", jobId: "job-1", resultId: "" },
  },
  {
    label: "oversized resultId",
    value: {
      status: "succeeded",
      jobId: "job-1",
      resultId: "r".repeat(129),
    },
  },
  {
    label: "missing message",
    value: { status: "failed", jobId: "job-1" },
  },
  {
    label: "non-string message",
    value: { status: "failed", jobId: "job-1", message: 123 },
  },
];

describe("preload getJobState", () => {
  it.each(validStates)("accepts a valid state: %j", async (state) => {
    const { api } = await setup();
    mocks.invoke.mockResolvedValueOnce(state);

    const received = await api.getJobState();

    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
      "easyconvert:get-job-state",
    );
    expect(received).toEqual(state);
    expect(received).not.toBe(state);
  });

  it.each(invalidStates)("rejects $label", async ({ value }) => {
    const { api } = await setup();
    mocks.invoke.mockResolvedValueOnce(value);

    await expect(api.getJobState()).rejects.toThrow();
  });

  it("returns only validated fields", async () => {
    const { api } = await setup();

    mocks.invoke.mockResolvedValueOnce({
      status: "running",
      jobId: "job-1",
      path: "C:/private/source.jpg",
    });

    await expect(api.getJobState()).resolves.toEqual({
      status: "running",
      jobId: "job-1",
    });
  });

  it("propagates an IPC failure", async () => {
    const { api } = await setup();
    const error = new Error("IPC unavailable.");
    mocks.invoke.mockRejectedValueOnce(error);

    await expect(api.getJobState()).rejects.toBe(error);
  });
});

describe("preload job subscription", () => {
  it.each(validStates)(
    "passes only the validated state to the listener: %j",
    async (state) => {
      const { api, emitter } = await setup();
      const listener = vi.fn();

      api.onJobStateChanged(listener);
      emitter.emit(CHANNEL, { sender: "must not reach React" }, state);

      expect(listener).toHaveBeenCalledExactlyOnceWith(state);
      expect(listener.mock.calls[0][0]).not.toBe(state);
    },
  );

  it.each(invalidStates)("logs and ignores $label", async ({ value }) => {
    const { api, emitter } = await setup();
    const listener = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    api.onJobStateChanged(listener);

    expect(() => emitter.emit(CHANNEL, {}, value)).not.toThrow();

    expect(listener).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "Received an invalid conversion job state.",
    );
  });

  it("continues receiving valid states after an invalid notification", async () => {
    const { api, emitter } = await setup();
    const listener = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});

    api.onJobStateChanged(listener);

    emitter.emit(CHANNEL, {}, null);
    emitter.emit(
      CHANNEL,
      {},
      {
        status: "running",
        jobId: "job-1",
        extra: "discard this",
      },
    );

    expect(listener).toHaveBeenCalledExactlyOnceWith({
      status: "running",
      jobId: "job-1",
    });
  });

  it("does not mistake a listener exception for a validation failure", async () => {
    const { api, emitter } = await setup();
    const error = new Error("Frontend listener failed.");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    api.onJobStateChanged(() => {
      throw error;
    });

    expect(() => {
      emitter.emit(CHANNEL, {}, { status: "idle" });
    }).toThrow(error);

    expect(log).not.toHaveBeenCalled();
  });

  it("removes the same handler when unsubscribed", async () => {
    const { api, emitter } = await setup();
    const unsubscribe = api.onJobStateChanged(vi.fn());
    const [channel, handler] = mocks.on.mock.calls[0];

    expect(channel).toBe(CHANNEL);
    expect(mocks.removeListener).not.toHaveBeenCalled();

    unsubscribe();

    expect(mocks.removeListener).toHaveBeenCalledExactlyOnceWith(
      CHANNEL,
      handler,
    );
    expect(emitter.listenerCount(CHANNEL)).toBe(0);
  });

  it("stops notifications only for the removed subscription", async () => {
    const { api, emitter } = await setup();
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = api.onJobStateChanged(firstListener);
    const unsubscribeSecond = api.onJobStateChanged(secondListener);

    unsubscribeFirst();
    emitter.emit(CHANNEL, {}, { status: "idle" });

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledExactlyOnceWith({
      status: "idle",
    });

    unsubscribeSecond();

    expect(emitter.listenerCount(CHANNEL)).toBe(0);
  });
});
