import "@testing-library/jest-dom/vitest";
import "../i18n";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

beforeAll(() => {
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
});

afterAll(() => {
  cleanup();
});
