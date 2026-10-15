import { afterEach, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppLayout from "./AppLayout";
import ConverterPage from "../pages/ConverterPage";
import AboutPage from "../pages/AboutPage";
import i18n from "../i18n";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

it("switches the converter workflow and static page to Polish", async () => {
  const user = userEvent.setup({ applyAccept: false });
  const router = createMemoryRouter(
    [
      {
        Component: AppLayout,
        children: [
          { index: true, Component: ConverterPage },
          { path: "about", Component: AboutPage },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  try {
    render(<RouterProvider router={router} />);

    await user.upload(
      screen.getByLabelText("Choose File"),
      new File(["content"], "unsupported.exe", {
        type: "application/octet-stream",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unsupported file format.",
    );

    await user.selectOptions(screen.getByLabelText("Language"), "pl");

    expect(screen.getByLabelText("Wybierz plik")).toBeInTheDocument();
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
