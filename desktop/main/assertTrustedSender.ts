import type { BrowserWindow, IpcMainInvokeEvent } from "electron";

export function assertTrustedSender(
  event: IpcMainInvokeEvent,
  owner: BrowserWindow,
  rendererUrl: string,
): void {
  if (owner.isDestroyed()) {
    throw new Error("Owner window is destroyed.");
  }

  if (event.sender !== owner.webContents) {
    throw new Error("Unexpected sender.");
  }

  const frame = event.senderFrame;

  if (!frame || frame !== owner.webContents.mainFrame) {
    throw new Error("Unexpected sender frame URL.");
  }

  const senderUrl = new URL(frame.url);
  senderUrl.hash = "";

  if (senderUrl.href !== rendererUrl) {
    throw new Error("Unexpected sender frame URL.");
  }
}
