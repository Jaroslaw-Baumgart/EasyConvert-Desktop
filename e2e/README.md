# Desktop end-to-end tests

Run `npm run test:e2e` from the repository root. The command builds the client and
desktop code, then Playwright launches the installed Electron runtime. No Express
or Vite server is started. CI runs on Windows x64, the current application target.

Each test has a separate user-data directory. Native file dialogs are replaced in
the Electron main process with deterministic answers; renderer, preload, IPC,
preview protocol and conversion workers run normally. The drop test uses
a temporary test-only input to obtain a disk-backed File and dispatches a drop
event; it does not automate dragging in Windows Explorer.

Failed tests retain screenshots, Electron logs and a Playwright trace. CI uploads
these together with the HTML report, excluding the temporary browser profiles.

The suite covers all ten conversion pairs and validates files written through
Save as. The JPG-to-PNG scenario also checks two quick saves to an isolated
desktop directory, including the numbered filename when the first name is taken.
ZIP export runs through main. Its menu offers quick save into an isolated desktop
directory and Save as; the test checks cancellation and the chosen destination.
Office fixtures are generated in each test's output directory, independent of
ignored manual fixtures. XLSX tests export each of two sheets separately and all
sheets together, check PDF text for unwanted sheet data and check A3 landscape
page dimensions. PDF-to-JPG tests decode both JPEGs from the saved ZIP and
check that reset removes the results. These checks do not compare visual layout
pixel by pixel or test a packaged installation.

Local runs require Poppler from the root `npm ci` and LibreOffice at
`tools/libreoffice/program/soffice.com`. The Windows CI job installs these tools.
Missing tools fail the tests rather than silently skipping conversions.
