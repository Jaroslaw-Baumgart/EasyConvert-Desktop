import "@testing-library/jest-dom/vitest";
import "../i18n";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });

  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  cleanup();
});
