import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SaveNotification from "./SaveNotification";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
afterEach(() => vi.useRealTimers());

function setup() {
  const onClose = vi.fn();
  const onShowInFolder = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <SaveNotification fileName="Raport (1).pdf" onClose={onClose} onShowInFolder={onShowInFolder} />,
  );
  return { ...view, onClose, onShowInFolder };
}

it("announces the saved name and closes after ten seconds", () => {
  const { onClose } = setup();
  expect(screen.getByRole("status")).toHaveTextContent("Raport (1).pdf");
  act(() => vi.advanceTimersByTime(9_999));
  expect(onClose).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledOnce();
});

it.each(["pointer", "focus"])("preserves remaining time while paused by %s", (interaction) => {
  const { onClose } = setup();
  const button = screen.getByRole("button", { name: "Show in folder" });
  const toast = button.parentElement!;
  act(() => vi.advanceTimersByTime(4_000));
  if (interaction === "pointer") fireEvent.mouseEnter(toast);
  else fireEvent.focus(button);
  act(() => vi.advanceTimersByTime(20_000));
  expect(onClose).not.toHaveBeenCalled();
  if (interaction === "pointer") fireEvent.mouseLeave(toast);
  else fireEvent.blur(button, { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(5_999));
  expect(onClose).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledOnce();
});

it("clears the timer on unmount", () => {
  const { onClose, unmount } = setup();
  unmount();
  act(() => vi.advanceTimersByTime(10_000));
  expect(onClose).not.toHaveBeenCalled();
});

it("keeps an opening error visible and closes after a successful retry", async () => {
  const { onClose, onShowInFolder } = setup();
  const button = screen.getByRole("button", { name: "Show in folder" });
  onShowInFolder.mockRejectedValueOnce(new Error("File removed"));
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not show");
  act(() => vi.advanceTimersByTime(20_000));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(button));
  expect(onShowInFolder).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("allows immediate dismissal", () => {
  const { onClose } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(onClose).toHaveBeenCalledOnce();
});
