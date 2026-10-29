# Desktop end-to-end tests

Run `npm run test:e2e` from the repository root. The command builds the client and
desktop code, then Playwright launches the installed Electron runtime. No Express
or Vite server is started. CI runs on Windows x64, the current application target.

Each test has a separate user-data directory. Native file dialogs are replaced in
the Electron main process with deterministic answers; renderer, preload, IPC,
preview protocol and the Sharp conversion worker run normally. The drop test uses
a temporary test-only input to obtain a disk-backed File and dispatches a drop
event; it does not automate dragging in Windows Explorer.

Failed tests retain screenshots, Electron logs and a Playwright trace. CI uploads
these together with the HTML report, excluding the temporary browser profiles.

`legacy/converter.web.ts` preserves the former HTTP/browser scenarios for
reference and is intentionally outside the active test pattern. PDF-to-JPG,
multiple results and ZIP export are not covered by desktop E2E yet: those
conversions have not been wired to the desktop UI. Existing client tests continue
to cover their frontend behavior; restore real desktop E2E coverage when the
engine integration is implemented. These scenarios are not counted as passing.
