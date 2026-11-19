# EasyConvert Desktop

A local file converter for Windows, built with Electron, React and TypeScript.
Select a file, preview it, choose conversion settings and save the result.
Files stay on your computer.

Adapted from [OnlineConverter-app](https://github.com/Jaroslaw-Baumgart/OnlineConverter-app).
The HTTP backend has been replaced with a conversion engine running in an Electron
utility process. The app is still in development. There is no public installer yet.

## Conversions

| Source | Target |
| --- | --- |
| JPG | PNG, PDF |
| PNG | JPG |
| TXT | PDF |
| CSV | PDF |
| PDF | JPG, TXT |
| DOCX, PPTX, XLSX | PDF |

PNG → JPG supports quality and background-color settings. JPG, TXT, CSV and XLSX
PDF output supports A4/A3 and portrait/landscape orientation. For XLSX, you can
choose one sheet or export all sheets.

PDF → JPG produces one image per page, with ZIP export for all pages.
PDF → TXT extracts existing text and does not perform OCR. TXT PDFs use Noto Sans
to preserve Polish characters.

The app handles one source file at a time, up to 10 MB. Files can be selected
through a native dialog or drag and drop. Source and result previews are available,
and the interface supports English and Polish.

PDF → JPG and PDF → TXT accept up to 500 pages. TXT and CSV → PDF can produce
up to 500 pages. Each result file is limited to 100 MiB, and a conversion can
produce up to 500 result files. Conversions have an overall three-minute timeout.

## Saving and temporary files

Save writes results to `EasyConvert Output` on your Desktop, adding a number when
a name is already taken. Save as opens a native dialog to choose the destination.
Failed writes preserve existing exports. A notification confirms the saved file
and lets you show it in its folder.

The app works on a private copy of the source. Cancel stops the conversion worker
and its child processes. Removing the file clears its temporary source and results.
Closing the app waits for conversion shutdown and cleanup, with confirmation if a
conversion is running. Original files and saved exports are preserved.

Temporary working files live under `%TEMP%\EasyConvert`. The app clears this
directory at startup to remove leftovers from interrupted sessions.

## Run from source

Use Windows x64 with Node.js and npm installed. From the repository root:

```powershell
npm.cmd ci
npm.cmd ci --prefix client
npm.cmd run dev
```

`dev` builds the client, compiles Electron and opens the application.
To reopen an already built client, use `npm.cmd run desktop:start`.
PDF → JPG and PDF → TXT use Poppler. Its Windows binaries are installed by the
root `npm.cmd ci`.

DOCX, PPTX and XLSX → PDF require LibreOffice at `tools/libreoffice/program/soffice.com`
in development. Install the LibreOffice distribution in `tools/libreoffice/`,
including its supporting files. These binaries are excluded from Git and copied
into the application when packaging.

In development builds, F12 or Ctrl+Shift+I toggles Developer Tools.

## Checks

Run from the repository root:

```powershell
$env:POPPLER_BIN = "$PWD\node_modules\pdf-poppler\lib\win\poppler-0.51\bin"

npm.cmd run check
npm.cmd run test:e2e
```

`check` runs lint, type checks, client tests, engine tests, desktop tests and the
client build. E2E tests launch real Electron on Windows and cover all ten conversion
pairs, XLSX sheet selection, saving, ZIP export and reset.
File contents are checked automatically. Visual layout still needs manual review.
See [e2e/README.md](e2e/README.md) for test setup and artifacts.

Core integration tests use Poppler from `POPPLER_BIN` or the system PATH.
Electron E2E tests also require the local LibreOffice installation described above.

## Project structure

- `client/` — React interface, previews, settings and desktop API adapters.
- `desktop/` — Electron main process, preload, IPC and conversion worker.
- `conversion-core/` — conversion functions and their tests.
- `shared/` — desktop contract and conversion option types.
- `assets/fonts/` — bundled fonts and their license.
- `e2e/` — Electron workflow tests and generated Office fixture helpers.
- `fixtures/` — shared test inputs. Additional manual samples are ignored by Git.
- `tools/` — manually installed LibreOffice binaries, excluded from Git.

## Before the first release

- A saved output-folder preference and UI polish, including a custom title bar
  and close-confirmation dialog.
- Packaging, application branding and third-party license notices.
- Installer testing on Windows 10 and Windows 11 x64.

## License

[MIT](LICENSE). Third-party conversion tools are subject to their own licenses.
Bundled Noto Sans fonts include their [SIL Open Font License](assets/fonts/OFL.txt).
