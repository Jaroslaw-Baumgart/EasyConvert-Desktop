import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CloseConfirmation from "./CloseConfirmation";
import { createDesktopApi } from "../../test/desktopApi";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("focuses Return, treats Escape as return, then waits for confirmed shutdown", async () => {
  const api = createDesktopApi();
  let requestClose = () => {};
  const unsubscribe = vi.fn();
  vi.mocked(api.onCloseRequested).mockImplementation((listener) => {
    requestClose = listener;
    return unsubscribe;
  });
  vi.stubGlobal("easyConvert", api);
  const view = render(<CloseConfirmation />);
  const dialog = view.container.querySelector("dialog")!;
  Object.assign(dialog, {
    showModal: vi.fn(() => dialog.setAttribute("open", "")),
    close: vi.fn(() => dialog.removeAttribute("open")),
  });

  act(() => requestClose());
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(screen.getByRole("button", { name: "Go back" })).toHaveFocus();
  fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
  await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  expect(api.respondToCloseRequest).toHaveBeenCalledWith(false);

  let finish!: () => void;
  vi.mocked(api.respondToCloseRequest).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  act(() => requestClose());
  fireEvent.click(screen.getByRole("button", { name: "Stop and close" }));
  expect(api.respondToCloseRequest).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("button", { name: "Closing…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Go back" })).toBeDisabled();
  await act(async () => finish());
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
