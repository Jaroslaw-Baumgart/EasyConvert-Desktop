import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";

import { appRoutes } from "./routes";

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  render(<RouterProvider router={router} />);
};

describe("application routes", () => {
  it("renders the converter at the root URL", () => {
    renderRoute("/");

    expect(
      screen.getByRole("region", {
        name: "Upload File",
      }),
    ).toBeInTheDocument();
  });

  it("renders the shared main navigation", () => {
    renderRoute("/");

    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });

    expect(
      within(navigation).getByRole("link", { name: "Converter" }),
    ).toHaveAttribute("href", "/");

    expect(
      within(navigation).getByRole("link", { name: "About" }),
    ).toHaveAttribute("href", "/about");

    expect(
      within(navigation).getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("renders the aboutpage", async () => {
    renderRoute("/about");

    expect(
      await screen.findByRole("heading", {
        name: "About the application",
      }),
    ).toBeInTheDocument();
  });

  it("renders the privacy page", () => {
    renderRoute("/privacy");

    expect(
      screen.getByRole("heading", {
        name: "Privacy",
      }),
    ).toBeInTheDocument();
  });

  it("navigates between pages and marks the active link", async () => {
    const user = userEvent.setup();

    renderRoute("/");

    await user.click(
      screen.getByRole("link", {
        name: "About",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "About the application",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "About",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("renders a helpful not-found page for an unknown URL", () => {
    renderRoute("/address-that-does-not-exist");

    expect(
      screen.getByRole("heading", {
        name: "Page Not Found",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Back to converter",
      }),
    ).toHaveAttribute("href", "/");
  });
});
