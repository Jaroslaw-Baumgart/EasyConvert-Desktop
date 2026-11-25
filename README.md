# EasyConvert Desktop

A local file converter for Windows, built with Electron, React and TypeScript.
Select a file, preview it, choose conversion settings and save the result.
Files stay on your computer.

Adapted from [OnlineConverter-app](https://github.com/Jaroslaw-Baumgart/OnlineConverter-app).
The HTTP backend has been replaced with a conversion engine running in an Electron
utility process. The app is still in development.

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

Save uses the output folder selected in Settings. The default is
`EasyConvert Output` on your Desktop. A number is added when a name is already
taken. Save as opens a native dialog for one export without changing the default
folder.
Failed writes preserve existing exports. A notification confirms the saved file
and lets you show it in its folder.

The app works on a private copy of the source. Cancel stops the conversion worker
and its child processes. Removing the file clears its temporary source and results.
Closing the app waits for conversion shutdown and cleanup, with confirmation if a
conversion is running. Original files and saved exports are preserved.

Temporary working files live under `%TEMP%\EasyConvert`. The app clears this
directory at startup to remove leftovers from interrupted sessions.

## Settings and window

Settings include the interface language, light or dark mode, ten accent colors
and the output folder. White is the default accent. Save changes applies and
stores your choices; Cancel discards unsaved edits. Factory defaults fills the
form with the default values, which still need to be saved.

Preferences are stored in `settings.json` in Electron's `userData` directory.
Window size, position and maximized state are stored separately in
`window-state.json`. Missing or invalid files fall back to defaults. The app
restores normal or maximized windows, not minimized ones.

About shows the application version and a link to the developer's GitHub profile.

## Run from source

Use Windows x64 with Node.js and npm installed. From the repository root:

```powershell
npm.cmd ci
npm.cmd ci --prefix client
npm.cmd run tools:poppler
npm.cmd run dev
```

`dev` builds the client, compiles Electron and opens the application.
To reopen an already built client, use `npm.cmd run desktop:start`.
PDF → JPG and PDF → TXT use Poppler 26.09.0. `tools:poppler` downloads pinned
Windows x64 packages from conda-forge, verifies their SHA256 hashes and prepares
`tools/poppler/`, including dependency licenses and build recipes. Micromamba is
used only to prepare these files; it is not included in the application.

DOCX, PPTX and XLSX → PDF require LibreOffice at `tools/libreoffice/program/soffice.com`
in development. Install the LibreOffice distribution in `tools/libreoffice/`,
including its supporting files. These binaries are excluded from Git and copied
into the application when packaging.

In development builds, F12 or Ctrl+Shift+I toggles Developer Tools.

## Windows installer

Build the Windows x64 installer with the source dependencies described above:

```powershell
npm.cmd run desktop:dist
```

The installer is written to `release/EasyConvert-Setup-<version>.exe`. It installs
for the current user by default, allows choosing a destination and creates desktop
and Start menu shortcuts. The default location is
`%LOCALAPPDATA%\Programs\EasyConvert`.

LibreOffice, Poppler and fonts are bundled with the application. They do not need
to be installed separately, and conversions work offline. Uninstalling retains
saved preferences and exported files. Builds are currently unsigned.

`npm.cmd run tools:poppler:sources` creates `release/Poppler-sources-26.09.0.zip`
with upstream source archives, patches and build recipes for the bundled Poppler
packages. Distribute it alongside the installer. Bundled-tool licenses and source
locations are listed in `resources/THIRD_PARTY_NOTICES.txt` after installation.

`npm.cmd run licenses:sharp:sources` verifies and collects the native image
libraries' sources, build recipes and license texts into
`release/Sharp-libvips-sources-8.18.7.zip`. Distribute this archive alongside the
installer too. Source versions and checksums are pinned in
`scripts/sharp-sources.lock.json`; documented mirror and notice-only entries
are identified there. The archive also includes librsvg's Rust dependencies.

Packaging generates Node.js dependency notices automatically. The client build
generates browser dependency notices from its bundled modules. Installed notices
are available under `resources/licenses/`.

For an unpacked application, run `npm.cmd run desktop:pack`. Its executable is
`release/win-unpacked/EasyConvert.exe`; keep the entire directory together.

## Checks

Run from the repository root:

```powershell
$env:POPPLER_BIN = "$PWD\tools\poppler\bin"

npm.cmd run check
npm.cmd run test:e2e
```

`check` runs lint, type checks, client tests, engine tests, desktop tests and the
client build. E2E tests launch real Electron on Windows and cover all ten conversion
pairs, XLSX sheet selection, saving, ZIP export and reset. They also check
preferences and window state after restart, recovery from corrupt settings,
the displayed app version and keyboard focus.
File contents are checked automatically. Visual layout still needs manual review.
See [e2e/README.md](e2e/README.md) for test setup and artifacts.

Core integration tests use Poppler from `POPPLER_BIN` or the system PATH.
Electron E2E tests also require the local LibreOffice installation described above.

## Project structure

- `client/src/app/` - startup, routing and layout.
- `client/src/features/` - converter, previews, settings and window controls.
- `client/src/components/` - shared UI. Feature CSS and tests stay beside their components.
- `client/src/pages/` - About, Privacy and Not Found.
- `client/src/styles/` - global styles and accent palettes.
- `desktop/main/` - startup, window, settings, sources, conversions, results, exports, protocol, security, resources and temporary files.
- `desktop/preload/` and `desktop/worker/` - renderer bridge and conversion worker.
- `desktop/tests/` - grouped like main, with separate preload and worker tests.
- `conversion-core/` - conversion functions and tests, grouped by format.
- `shared/contracts/` - desktop and worker contracts. Conversion definitions, options and limits remain in `shared/`.
- `assets/fonts/` - bundled fonts and their license.
- `assets/icons/` - application icon sources and Windows ICO files.
- `e2e/` - Electron workflow tests and generated Office fixture helpers.
- `fixtures/` - shared test inputs. Additional manual samples are ignored by Git.
- `scripts/` - native tool setup, source manifests and third-party license collection.
- `tools/` - local LibreOffice and Poppler binaries, excluded from Git.

## Before the first release

- Publish the installer together with the Poppler and Sharp/libvips source archives.
- Clean-machine installation, upgrade and conversion testing on Windows 10 and Windows 11 x64.

## License

[MIT](LICENSE). Third-party conversion tools are subject to their own licenses.
Bundled Noto Sans fonts include their [SIL Open Font License](assets/fonts/OFL.txt).
