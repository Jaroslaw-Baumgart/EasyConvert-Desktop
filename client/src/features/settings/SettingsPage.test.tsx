import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import SettingsPage from "./SettingsPage";
import { createDesktopApi } from "../../test/desktopApi";

afterEach(() => vi.unstubAllGlobals());

it("discards unsaved edits on Cancel and reloads saved values on return", async () => {
  const api = createDesktopApi();
  vi.stubGlobal("easyConvert", api);
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Link to="/settings">Open settings</Link>} />
      </Routes>
    </MemoryRouter>,
  );
  const theme = await screen.findByRole("combobox", { name: "Theme" });
  fireEvent.change(theme, { target: { value: "dark" } });
  fireEvent.click(screen.getByRole("radio", { name: "Purple" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(api.saveSettings).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "Open settings" }));
  expect(await screen.findByRole("combobox", { name: "Theme" })).toHaveValue("light");
  expect(screen.getByRole("radio", { name: "White" })).toBeChecked();
});

it("restores factory values only in the draft, then saves them on submit", async () => {
  const api = createDesktopApi();
  vi.mocked(api.getSettings).mockResolvedValue({
    language: "pl", theme: "dark", accentColor: "purple", outputDirectory: "C:\\Custom",
  });
  vi.stubGlobal("easyConvert", api);
  render(<MemoryRouter><SettingsPage /></MemoryRouter>);

  const theme = await screen.findByRole("combobox", { name: "Theme" });
  expect(theme).toHaveValue("dark");
  expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();
  expect(screen.getByDisplayValue("C:\\Custom")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Factory defaults" }));
  await waitFor(() => expect(theme).toHaveValue("light"));
  expect(screen.getByRole("combobox", { name: "Interface language" })).toHaveValue("en");
  expect(screen.getByRole("radio", { name: "White" })).toBeChecked();
  expect(screen.getByDisplayValue("C:\\EasyConvert Output")).toBeInTheDocument();
  expect(api.saveSettings).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Default values restored in the form");

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(api.saveSettings).toHaveBeenCalledExactlyOnceWith({
    language: "en", theme: "light", accentColor: "white", outputDirectory: "C:\\EasyConvert Output",
  }));
  expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.");
});

it("keeps the current draft and permits retry when factory defaults cannot be loaded", async () => {
  const api = createDesktopApi();
  vi.mocked(api.getDefaultSettings).mockRejectedValueOnce(new Error("IPC failed"));
  vi.stubGlobal("easyConvert", api);
  render(<MemoryRouter><SettingsPage /></MemoryRouter>);

  const theme = await screen.findByRole("combobox", { name: "Theme" });
  fireEvent.change(theme, { target: { value: "dark" } });
  fireEvent.click(screen.getByRole("button", { name: "Factory defaults" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not restore default settings.");
  expect(theme).toHaveValue("dark");
  expect(api.saveSettings).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Factory defaults" })).toBeEnabled();
});
