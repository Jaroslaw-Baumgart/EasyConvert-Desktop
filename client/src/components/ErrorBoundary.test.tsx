import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import AppLayout from "../layouts/AppLayout";

function BrokenComponent(): never {
  throw new Error("Test render failure");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <p>Working content</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Working content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a fallback when a child throws during rendering", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong.",
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps navigation available and recovers after changing pages", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const router = createMemoryRouter(
      [
        {
          Component: AppLayout,
          children: [
            {
              path: "about",
              Component: BrokenComponent,
            },
            {
              index: true,
              element: <h1>Working converter</h1>,
            },
          ],
        },
      ],
      { initialEntries: ["/about"] },
    );

    try {
      render(<RouterProvider router={router} />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong.",
      );

      expect(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "Converter" }));

      expect(
        await screen.findByRole("heading", { name: "Working converter" }),
      ).toBeInTheDocument();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      router.dispose();
      consoleError.mockRestore();
    }
  });
});
