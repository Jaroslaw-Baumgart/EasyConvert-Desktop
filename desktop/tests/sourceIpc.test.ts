import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import type { SourceSelection } from "../../shared/desktopContract";

type TestEvent = {
  sender: object;
  senderFrame: { url: string } | null;
};

type Handler = (
  event: TestEvent,
  ...args: unknown[]
) => Promise<SourceSelection>;

const mocks = vi.hoisted(() => ({
  handle: vi.fn<(channel: string, handler: Handler) => void>(),
  selectSource: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: mocks.handle },
}));

vi.mock("../main/selectSource", () => ({
  selectSource: mocks.selectSource,
}));

vi.mock("../main/prepareSource", () => ({
  prepareSource: vi.fn(),
}));

import { registerSourceIpc } from "../main/sourceIpc";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.selectSource.mockResolvedValue({ status: "cancelled" });
});

function setup(rendererUrl = "app://easyconvert/") {
  const frame = { url: rendererUrl };
  const windowStub = {
    isDestroyed: vi.fn(() => false),
    webContents: { mainFrame: frame },
  };

  const owner = windowStub as unknown as BrowserWindow;

  registerSourceIpc(owner, rendererUrl);

  expect(mocks.handle).toHaveBeenCalledTimes(2);

  const registration = mocks.handle.mock.calls.find(
    ([channel]) => channel === "easyconvert:select-source",
  );

  if (!registration) {
    throw new Error("Source selection handler was not registered.");
  }

  const event: TestEvent = {
    sender: windowStub.webContents,
    senderFrame: frame,
  };

  return {
    handler: registration[1],
    owner,
    windowStub,
    frame,
    event,
    args: [] as unknown[],
  };
}

type Fixture = ReturnType<typeof setup>;

const rejectedRequests: {
  label: string;
  change: (fixture: Fixture) => void;
}[] = [
  {
    label: "destroyed window",
    change: ({ windowStub }) => {
      windowStub.isDestroyed.mockReturnValue(true);
    },
  },
  {
    label: "unexpected arguments",
    change: ({ args }) => {
      args.push("C:/untrusted/file.jpg");
    },
  },
  {
    label: "foreign webContents",
    change: ({ event }) => {
      event.sender = {};
    },
  },
  {
    label: "missing frame",
    change: ({ event }) => {
      event.senderFrame = null;
    },
  },
  {
    label: "another frame with the same URL",
    change: ({ event, frame }) => {
      event.senderFrame = { url: frame.url };
    },
  },
  {
    label: "external document",
    change: ({ frame }) => {
      frame.url = "https://example.com/";
    },
  },
  {
    label: "Vite document in local mode",
    change: ({ frame }) => {
      frame.url = "http://localhost:5173/";
    },
  },
  {
    label: "unexpected query",
    change: ({ frame }) => {
      frame.url = "app://easyconvert/?unexpected=1";
    },
  },
  {
    label: "malformed URL",
    change: ({ frame }) => {
      frame.url = "not a URL";
    },
  },
];

describe("registerSourceIpc", () => {
  it.each(["app://easyconvert/", "app://easyconvert/#/about"])(
    "accepts the main document: %s",
    async (url) => {
      const fixture = setup();
      fixture.frame.url = url;

      await expect(fixture.handler(fixture.event)).resolves.toEqual({
        status: "cancelled",
      });

      expect(mocks.selectSource).toHaveBeenCalledExactlyOnceWith(fixture.owner);
    },
  );

  it("accepts Vite when explicitly configured", async () => {
    const fixture = setup("http://localhost:5173/");

    await expect(fixture.handler(fixture.event)).resolves.toEqual({
      status: "cancelled",
    });
  });

  it.each(rejectedRequests)(
    "rejects $label before selecting a file",
    async ({ change }) => {
      const fixture = setup();
      change(fixture);

      await expect(
        Promise.resolve().then(() =>
          fixture.handler(fixture.event, ...fixture.args),
        ),
      ).rejects.toThrow();

      expect(mocks.selectSource).not.toHaveBeenCalled();
    },
  );

  it("propagates a selection failure", async () => {
    const fixture = setup();
    const error = new Error("Selection failed.");
    mocks.selectSource.mockRejectedValue(error);

    await expect(fixture.handler(fixture.event)).rejects.toBe(error);
  });
});
