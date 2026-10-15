import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../test/server";
import ConverterPage from "./ConverterPage";

const getEnabledConvertButton = (): HTMLElement => {
  const button = screen
    .getAllByRole("button", { name: "Convert" })
    .find((candidate) => !candidate.hasAttribute("disabled"));

  if (!button) {
    throw new Error("No enabled conversion button was found");
  }

  return button;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("ConverterPage", () => {
  it("returns to the initial state after removing the selected file", async () => {
    const user = userEvent.setup();

    render(<ConverterPage />);

    const input = screen.getByLabelText("Choose File");
    const file = new File(["content"], "image.png", {
      type: "image/png",
    });

    await user.upload(input, file);

    expect(screen.getByText("image.png")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Preview" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    expect(
      screen.getByRole("region", { name: "Upload File" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove file" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Preview" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Convert" }),
    ).not.toBeInTheDocument();

    const replacementInput = screen.getByLabelText("Choose File");
    await user.upload(replacementInput, file);

    expect(screen.getByText("image.png")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove file" }),
    ).toBeInTheDocument();
  });

  it("shows and clears a network error", async () => {
    const user = userEvent.setup();

    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.error();
      }),
    );

    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ConverterPage />);

    const input = screen.getByLabelText("Choose File");
    const file = new File(["content"], "image.jpg", {
      type: "image/jpeg",
    });

    await user.upload(input, file);

    const enabledConvertButton = getEnabledConvertButton();

    await user.click(enabledConvertButton);

    const errorAlert = await screen.findByRole("alert");

    expect(errorAlert).toHaveTextContent(
      "Could not connect to the conversion service. Check your connection and try again.",
    );

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the conversion result after removing the selected file", async () => {
    const user = userEvent.setup();

    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/Converted.png",
              name: "Converted.png",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/Converted.png", () => {
        return new HttpResponse("converted content", {
          headers: {
            "Content-Type": "image/png",
          },
        });
      }),
    );

    render(<ConverterPage />);

    const input = screen.getByLabelText("Choose File");
    const file = new File(["content"], "image.jpg", {
      type: "image/jpeg",
    });

    await user.upload(input, file);

    const enabledConvertButton = getEnabledConvertButton();

    await user.click(enabledConvertButton);

    expect(
      await screen.findByRole("heading", {
        name: "Converted file",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    expect(
      screen.queryByRole("heading", {
        name: "Converted file",
      }),
    ).not.toBeInTheDocument();
  });
});
