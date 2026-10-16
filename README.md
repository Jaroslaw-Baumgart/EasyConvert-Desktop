# EasyConvert Desktop

An offline file converter for Windows, built around Electron, React and TypeScript.

**Status: desktop migration in progress.** The Electron shell runs the existing
React frontend locally, including file previews, navigation and Polish/English support.
The project is adapted from [OnlineConverter-app](https://github.com/Jaroslaw-Baumgart/OnlineConverter-app).
Conversions still use the existing backend. Desktop conversion integration and
the Windows installer are not implemented yet.

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

The desktop version will preserve the conversions available in the original project:

| Source | Target |
| --- | --- |
| PDF | JPG, TXT |
| JPG | PNG, PDF |
| PNG | JPG |
| TXT, CSV | PDF |
| DOCX, XLSX, PPTX | PDF |

## Installation

No desktop release or installer is available yet. Installation instructions
will be added with the first desktop release.

## License

[MIT](LICENSE). Third-party conversion tools are subject to their own licenses.
