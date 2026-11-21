import { afterEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppLayout from "./AppLayout";
import ConverterPage from "../pages/ConverterPage";
import AboutPage from "../pages/AboutPage";
import i18n from "../i18n";
import SettingsPage from "../pages/SettingsPage";
import { createDesktopApi } from "../test/desktopApi";

afterEach(async () => {
  await i18n.changeLanguage("en");
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.accent;
});

it("switches the converter workflow and static page to Polish", async () => {
  vi.stubGlobal("easyConvert", createDesktopApi());
  const user = userEvent.setup({ applyAccept: false });
  const router = createMemoryRouter(
    [
      {
        Component: AppLayout,
        children: [
          { index: true, Component: ConverterPage },
          { path: "about", Component: AboutPage },
          { path: "settings", Component: SettingsPage },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  try {
    render(<RouterProvider router={router} />);

    fireEvent.drop(screen.getByRole("region", { name: "Upload File" }), { dataTransfer: { files: [new File(["content"], "unsupported.exe", {
        type: "application/octet-stream",
      })] } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unsupported file format.",
    );

    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Interface language" }), "pl");
    expect(i18n.resolvedLanguage).toBe("en");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText(i18n.getFixedT("pl")("settings.saved"));
    await user.click(screen.getByRole("link", { name: i18n.t("navigation.converter") }));
    fireEvent.drop(screen.getByRole("region"), { dataTransfer: { files: [new File(["content"], "unsupported.exe", {
      type: "application/octet-stream",
    })] } });

    expect(screen.getByRole("button", { name: "Wybierz plik" })).toBeInTheDocument();
    expect(i18n.resolvedLanguage).toBe("pl");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nieobsługiwany format pliku.",
    );

    await user.click(screen.getByRole("link", { name: "O aplikacji" }));

    expect(
      await screen.findByRole("heading", { name: "O aplikacji" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jak to działa")).toBeInTheDocument();
  } finally {
    router.dispose();
  }
});
