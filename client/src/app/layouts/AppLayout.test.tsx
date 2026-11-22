import { lazy } from "react";
import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, it, vi } from "vitest";
import AppLayout from "./AppLayout";
import type { ComponentType } from "react";

it("shows loading feedback and then renders the loaded page", async () => {
  function LoadedPage() {
    return <h1>Loaded page</h1>;
  }

  type PageModule = {
    default: typeof LoadedPage;
  };

  let finishLoading: (module: PageModule) => void = () => {
    throw new Error("Promise is not initialized.");
  };

  const pagePromise = new Promise<PageModule>((resolve) => {
    finishLoading = resolve;
  });

  const LazyPage = lazy(() => pagePromise);

  const router = createMemoryRouter(
    [
      {
        Component: AppLayout,
        children: [
          {
            index: true,
            Component: LazyPage,
          },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  try {
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading page...");

    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Loaded page" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      finishLoading({ default: LoadedPage });
      await pagePromise;
    });

    expect(
      await screen.findByRole("heading", { name: "Loaded page" }),
    ).toBeInTheDocument();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  } finally {
    router.dispose();
  }
});

it("shows an error when loading a page fails", async () => {
  type PageModule = {
    default: ComponentType;
  };

  let failLoading: (error: Error) => void = () => {
    throw new Error("Promise is not initialized.");
  };

  const pagePromise = new Promise<PageModule>((_resolve, reject) => {
    failLoading = reject;
  });

  const LazyPage = lazy(() => pagePromise);

  const router = createMemoryRouter(
    [
      {
        Component: AppLayout,
        children: [
          {
            index: true,
            Component: LazyPage,
          },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading page...");

    await act(async () => {
      failLoading(new Error("Test module loading failure"));
      await pagePromise.catch(() => {});
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Loaded page" }),
    ).not.toBeInTheDocument();
  } finally {
    router.dispose();
    consoleError.mockRestore();
  }
});
