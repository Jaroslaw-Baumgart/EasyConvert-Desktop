import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const requireFromServer = createRequire(import.meta.url);

export default defineConfig({
  test: {
    alias: {
      sharp: requireFromServer.resolve("sharp"),
    },
  },
});