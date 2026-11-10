# Conversion engine tests

All engine tests live here, grouped by image, PDF and Office behavior. They import
conversion-core directly and do not start Express or import server modules.

Run from the repository root:

```powershell
npm.cmd run typecheck:core
npm.cmd run test:core
```

Real PDF tests use `pdfinfo` and `pdftotext` from Poppler. Put those tools on PATH
or set `POPPLER_BIN` to their binary directory before running the tests. Linux CI
already installs poppler-utils. The tests fail if a required tool is unavailable;
they do not silently skip content verification.

Fonts come from the shared assets/fonts directory. All file fixtures live in the
repository-root fixtures directory, shared by engine and Electron tests.

Unit tests cover settings, rendering calls, stream completion and failures.
PDF integration tests check actual page dimensions, Polish TXT content, long CSV
cells across pages and input limits. Desktop IPC and UI workflows are covered by desktop and Electron E2E tests.
