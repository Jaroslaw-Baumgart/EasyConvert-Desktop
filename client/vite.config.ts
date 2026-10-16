import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const devCsp = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' blob: data:",
  "connect-src 'self' blob: http://localhost:5000 ws://localhost:5173",
  "worker-src 'self' blob:",
  "frame-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export default defineConfig({
  base: "./",
  plugins: [react()],

  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },

  server: {
    proxy: {
      "/convert": "http://localhost:5000",
      "/output": "http://localhost:5000",
    },
    port: 5173,
    strictPort: true,
    headers: {
      "Content-Security-Policy": devCsp,
    },
  },
});
