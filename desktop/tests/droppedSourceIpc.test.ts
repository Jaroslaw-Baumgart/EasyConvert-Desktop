import path from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  handle: vi.fn<(channel: string, handler: Handler) => void>(),
  trusted: vi.fn(),
  prepareSource: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: mocks.handle },
}));

vi.mock("../main/assertTrustedSender", () => ({
  assertTrustedSender: mocks.trusted,
}));

vi.mock("../main/prepareSource", () => ({
  prepareSource: mocks.prepareSource,
}));

vi.mock("../main/selectSource", () => ({
  selectSource: vi.fn(),
}));

import { registerSourceIpc } from "../main/sourceIpc";

beforeEach(() => {
  vi.resetAllMocks();
});

function setup() {
  const owner = {} as BrowserWindow;
  const event = {} as IpcMainInvokeEvent;
  const rendererUrl = "app://easyconvert/";

  registerSourceIpc(owner, rendererUrl);

  const registration = mocks.handle.mock.calls.find(
    ([channel]) => channel === "easyconvert:select-dropped-source",
  );

  if (!registration) {
    throw new Error("Dropped source handler was not registered.");
  }

  const handler = registration[1];

  // Ujednolica sprawdzanie błędów synchronicznych i Promise.
  const invoke = (...args: unknown[]) =>
    Promise.resolve().then(() => handler(event, ...args));

  return { owner, event, rendererUrl, invoke };
}

describe("dropped source IPC", () => {
  it("checks the sender and returns prepared source metadata", async () => {
    const { owner, event, rendererUrl, invoke } = setup();
    const sourcePath = path.resolve("fixtures/photo.jpg");
    const source = {
      sourceId: "source-1",
      name: "photo.jpg",
      sizeBytes: 123,
    };

    mocks.prepareSource.mockResolvedValue(source);

    await expect(invoke(sourcePath)).resolves.toEqual(source);

    expect(mocks.trusted).toHaveBeenCalledExactlyOnceWith(
      event,
      owner,
      rendererUrl,
    );
    expect(mocks.prepareSource).toHaveBeenCalledExactlyOnceWith(sourcePath);
    expect(mocks.trusted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.prepareSource.mock.invocationCallOrder[0]!,
    );
  });

  it.each([
    { label: "no arguments", args: [] },
    { label: "two arguments", args: ["/one.jpg", "/two.jpg"] },
  ])("rejects $label", async ({ args }) => {
    const { invoke } = setup();

    await expect(invoke(...args)).rejects.toThrow(
      "Expected exactly one argument.",
    );

    expect(mocks.prepareSource).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 123, {}, [], ""])(
    "rejects an invalid path value: %j",
    async (value) => {
      const { invoke } = setup();

      await expect(invoke(value)).rejects.toThrow("Expected a file path.");

      expect(mocks.prepareSource).not.toHaveBeenCalled();
    },
  );

  it("rejects a relative path", async () => {
    const { invoke } = setup();

    await expect(invoke("fixtures/photo.jpg")).rejects.toThrow(
      "Expected an absolute file path.",
    );

    expect(mocks.prepareSource).not.toHaveBeenCalled();
  });

  it("rejects an untrusted sender before preparing the source", async () => {
    const { invoke } = setup();
    const error = new Error("Unexpected sender.");
    mocks.trusted.mockImplementation(() => {
      throw error;
    });

    await expect(invoke(path.resolve("fixtures/photo.jpg"))).rejects.toBe(
      error,
    );

    expect(mocks.prepareSource).not.toHaveBeenCalled();
  });

  it("propagates a file validation failure", async () => {
    const { invoke } = setup();
    const error = new Error("Selected file is empty.");
    mocks.prepareSource.mockRejectedValue(error);

    await expect(invoke(path.resolve("fixtures/photo.jpg"))).rejects.toBe(
      error,
    );
  });
});
