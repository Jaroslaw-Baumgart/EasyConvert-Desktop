import { describe, expect, it } from "vitest";

import { buildApiUrl } from "./apiUrl";

describe("buildApiUrl", () => {
  it("leaves an absolute URL unchanged", () => {
    expect(buildApiUrl("https://files.example.com/result.png")).toBe(
      "https://files.example.com/result.png",
    );
  });

  it.each([
    ["/output/result.png", "http://localhost:5000/output/result.png"],
    ["output/result.png", "http://localhost:5000/output/result.png"],
  ])("joins the API base URL with %s", (path, expected) => {
    expect(buildApiUrl(path)).toBe(expected);
  });
});
