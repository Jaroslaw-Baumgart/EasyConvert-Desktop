import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  assertTrustedSender: vi.fn(),
  startConversion: vi.fn(),
  getJobState: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: mocks.handle },
}));

vi.mock("../main/assertTrustedSender", () => ({
  assertTrustedSender: mocks.assertTrustedSender,
}));

vi.mock("../main/startConversion", () => ({
  startConversion: mocks.startConversion,
}));

vi.mock("../main/jobRegistry", () => ({
  getJobState: mocks.getJobState,
}));

import { registerConversionIpc } from "../main/conversionIpc";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function setup() {
  const windowStub = {
    isDestroyed: vi.fn(() => false),
    webContents: {
      isDestroyed: vi.fn(() => false),
      getURL: vi.fn(() => "app://easyconvert/"),
      send: vi.fn(),
    },
  };
  const owner = windowStub as unknown as BrowserWindow;
  const event = {} as IpcMainInvokeEvent;
  const rendererUrl = "app://easyconvert/";

  registerConversionIpc(owner, rendererUrl);

  expect(mocks.handle).toHaveBeenCalledTimes(2);
  expect(mocks.handle.mock.calls.map(([channel]) => channel).sort()).toEqual([
    "easyconvert:get-job-state",
    "easyconvert:start-conversion",
  ]);

  function handlerFor(channel: string): Handler {
    const registration = mocks.handle.mock.calls.find(
      ([registeredChannel]) => registeredChannel === channel,
    );

    if (!registration) {
      throw new Error(`Missing handler: ${channel}`);
    }

    return registration[1] as Handler;
  }

  function obtainPublisher(): () => void {
    handlerFor("easyconvert:start-conversion")(event, {
      sourceId: "source-123",
      conversion: "jpg-to-png",
    });

    return mocks.startConversion.mock.calls[0][1] as () => void;
  }

  return {
    owner,
    windowStub,
    event,
    rendererUrl,
    handlerFor,
    obtainPublisher,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("conversion IPC", () => {
  it("checks the sender and passes the publishing callback to start", () => {
    const { owner, event, rendererUrl, handlerFor } = setup();
    const request = { sourceId: "source-123", conversion: "jpg-to-png" };
    const response = { jobId: "job-123" };

    mocks.startConversion.mockImplementation(() => {
      expect(mocks.assertTrustedSender).toHaveBeenCalledExactlyOnceWith(
        event,
        owner,
        rendererUrl,
      );
      return response;
    });

    expect(handlerFor("easyconvert:start-conversion")(event, request)).toBe(
      response,
    );

    expect(mocks.startConversion).toHaveBeenCalledExactlyOnceWith(
      request,
      expect.any(Function),
    );
  });

  it.each([
    { name: "no arguments", args: [] },
    { name: "two arguments", args: [{}, {}] },
  ])("rejects a start with $name", ({ args }) => {
    const { event, handlerFor } = setup();

    expect(() =>
      handlerFor("easyconvert:start-conversion")(event, ...args),
    ).toThrow("Expected exactly one argument.");

    expect(mocks.startConversion).not.toHaveBeenCalled();
  });

  it("propagates a start failure", () => {
    const { event, handlerFor } = setup();
    const error = new Error("Unknown source.");

    mocks.startConversion.mockImplementation(() => {
      throw error;
    });

    expect(() => handlerFor("easyconvert:start-conversion")(event, {})).toThrow(
      error,
    );
  });

  it("checks the sender before returning the job state", () => {
    const { owner, event, rendererUrl, handlerFor } = setup();
    const state = { status: "running", jobId: "job-123" };

    mocks.getJobState.mockImplementation(() => {
      expect(mocks.assertTrustedSender).toHaveBeenCalledExactlyOnceWith(
        event,
        owner,
        rendererUrl,
      );
      return state;
    });

    expect(handlerFor("easyconvert:get-job-state")(event)).toBe(state);
    expect(mocks.getJobState).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "one argument", args: ["unexpected"] },
    { name: "two arguments", args: [{}, {}] },
  ])("rejects a state request with $name", ({ args }) => {
    const { event, handlerFor } = setup();

    expect(() =>
      handlerFor("easyconvert:get-job-state")(event, ...args),
    ).toThrow("Unexpected arguments.");

    expect(mocks.getJobState).not.toHaveBeenCalled();
  });

  it.each(["easyconvert:start-conversion", "easyconvert:get-job-state"])(
    "rejects an untrusted sender on %s",
    (channel) => {
      const { event, handlerFor } = setup();

      mocks.assertTrustedSender.mockImplementation(() => {
        throw new Error("Unexpected sender.");
      });

      const args = channel === "easyconvert:start-conversion" ? [{}] : [];

      expect(() => handlerFor(channel)(event, ...args)).toThrow(
        "Unexpected sender.",
      );
      expect(mocks.startConversion).not.toHaveBeenCalled();
      expect(mocks.getJobState).not.toHaveBeenCalled();
    },
  );

  it.each(["app://easyconvert/", "app://easyconvert/#/about"])(
    "publishes the current state to %s",
    (url) => {
      const { windowStub, obtainPublisher } = setup();
      const publish = obtainPublisher();
      const state = {
        status: "succeeded",
        jobId: "job-123",
        resultId: "result-123",
      };

      windowStub.webContents.getURL.mockReturnValue(url);
      mocks.getJobState.mockReturnValue(state);

      publish();

      expect(windowStub.webContents.send).toHaveBeenCalledExactlyOnceWith(
        "easyconvert:job-state-changed",
        state,
      );
    },
  );

  it.each([
    "destroyed window",
    "destroyed webContents",
    "empty URL",
    "external URL",
    "unexpected query",
    "Vite in local mode",
  ])("does not publish to an invalid destination: %s", (scenario) => {
    const { windowStub, obtainPublisher } = setup();
    const publish = obtainPublisher();

    if (scenario === "destroyed window") {
      windowStub.isDestroyed.mockReturnValue(true);
    } else if (scenario === "destroyed webContents") {
      windowStub.webContents.isDestroyed.mockReturnValue(true);
    } else {
      const urls: Record<string, string> = {
        "empty URL": "",
        "external URL": "https://example.com/",
        "unexpected query": "app://easyconvert/?unexpected=1",
        "Vite in local mode": "http://localhost:5173/",
      };
      windowStub.webContents.getURL.mockReturnValue(urls[scenario]);
    }

    publish();

    expect(windowStub.webContents.send).not.toHaveBeenCalled();
    expect(mocks.getJobState).not.toHaveBeenCalled();
  });
});
