# EasyConvert Desktop

An offline file converter for Windows, built around Electron, React and TypeScript.

**Status: desktop migration in progress.** The Electron shell runs the existing
React frontend locally, including file previews, navigation and Polish/English support.
The project is adapted from [OnlineConverter-app](https://github.com/Jaroslaw-Baumgart/OnlineConverter-app).
JPG → PNG, PNG → JPG, JPG → PDF, TXT → PDF, CSV → PDF and PDF → JPG run locally in an Electron utility
process without an HTTP server. The remaining conversions are still being migrated.
No public desktop release or installer is available yet.

## Available desktop features

- Select one source file through a native dialog or drag and drop (maximum 10 MB).
- Preview files and conversion results in the existing interface.
- Convert JPG → PNG.
- Convert PNG → JPG with quality and background-color settings.
- Convert JPG, TXT or CSV → PDF with A4/A3 and portrait/landscape settings.
- Convert PDF → JPG with one result per page, in page order.
- Preserve Polish characters in TXT PDFs using the bundled Noto Sans font.
- Download conversion results and clear the current source and result.
- Download multiple results as ZIP using the existing frontend export.

Native Save/Save as actions and a persistent output-folder preference are planned.
The current interface still uses its Download action.

## Planned first release

- Convert documents and images locally on Windows 10 and Windows 11 (64-bit).
- Preview source files and conversion results.
- Choose conversion settings and save results through native file dialogs.
- Export multiple results from a single source as ZIP.
- Switch between Polish and English.
- Install and run the application without a separate Node.js installation.

The first release will handle one source file at a time. Batch conversion and
automatic updates may follow later.

## Conversion scope

The desktop version will preserve the conversions available in the original project.
The status below describes integration with the desktop interface:

| Source | Target | Desktop status |
| --- | --- | --- |
| JPG | PNG, PDF | Available |
| PNG | JPG | Available |
| TXT | PDF | Available |
| CSV | PDF | Available |
| PDF | JPG | Available |
| PDF | TXT | Planned |
| DOCX, XLSX, PPTX | PDF | Planned |

## Run from source

Use Windows x64 with Node.js and npm installed. From the repository root:

```powershell
npm.cmd ci
npm.cmd ci --prefix client
npm.cmd run build --prefix client
npm.cmd run desktop:start
```

`desktop:start` compiles the Electron code and opens the built frontend locally.
Rebuild the client after frontend changes. The available desktop conversions do
not require starting Express or Vite. PDF → JPG launches Poppler as a local tool;
in the current development setup its binaries are installed by
`npm.cmd ci --prefix server`. Image and TXT/CSV conversions do not require
LibreOffice or Poppler.

In development builds, F12 or Ctrl+Shift+I toggles Developer Tools.

## Checks

Run from the repository root:

```powershell
npm.cmd run typecheck:core
npm.cmd run desktop:build
npm.cmd run typecheck --prefix client
npm.cmd run test:core
npm.cmd run test:desktop
npm.cmd run test:run --prefix client
npm.cmd run test:e2e
```

Desktop E2E tests launch Electron on Windows; see [e2e/README.md](e2e/README.md)
for coverage and test artifacts.

The `server/` directory remains as an HTTP adapter for regression testing during
the migration. Its checks require `npm.cmd ci --prefix server`; integration tests
for PDF and Office conversions also require the configured Poppler and LibreOffice
tools. The desktop runtime does not start this server.

## Installation

No desktop release or installer is available yet. Installation instructions
will be added with the first desktop release.

## License

[MIT](LICENSE). Third-party conversion tools are subject to their own licenses.
Bundled Noto Sans fonts include their [SIL Open Font License](assets/fonts/OFL.txt).
