Sharp / libvips for Windows x64
==============================
Sharp 0.35.5 is Copyright 2013 Lovell Fuller and others, under Apache-2.0.
Its native libvips 8.18.7 library and dependencies include LGPL software.
The upstream Windows distribution uses the "any later version" provisions
of LGPL-2.0/LGPL-2.1 to distribute LGPL components under LGPL-3.0.
Each component's original copyright and license texts accompany this file.

Source code and build recipes
-----------------------------
Sharp-libvips-sources-8.18.7.zip is provided next to the installer at:
https://github.com/Jaroslaw-Baumgart/EasyConvert-Desktop/releases

manifest.json records source versions, download locations and SHA256 hashes.
The archive also includes complete Windows build recipes and patches from
libvips/build-win64-mxe, its MXE base, and lovell/sharp-libvips.
Sources are unchanged; build patches are preserved in those snapshots.
The libimagequant entry is used only for BSD copyright/license notices; its
upstream version tag moved after the binary build. See the manifest's note.
The Rust crate archives are verified against librsvg's Cargo.lock. This complete
lock also includes development and platform-specific dependencies.
For Sharp itself: https://github.com/lovell/sharp/tree/v0.35.5

This software uses the FreeType Project. Portions of this software are
copyright 2026 The FreeType Project (https://freetype.org/). All rights reserved.

Rebuilding and replacing the LGPL libraries
-----------------------------------------
Use a Linux host with Docker or Podman, extract the build-win64-mxe snapshot,
and follow its README and build.sh --help. The relevant build configuration is
the default vips-web variant, target x86_64-w64-mingw32.static, with the
mozjpeg, proxy-libintl and zlib-ng plugins enabled by the upstream build script.
The MXE snapshot and source archives are supplied for the pinned recipes.
See sharp-libvips/build/win.sh for how the DLLs are prepared for Sharp.

The DLL is dynamically loaded from:
resources/app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib/libvips-42.dll
Close EasyConvert before replacing it with an interface-compatible rebuild.
The native wrapper libvips-cpp-8.18.7.dll and sharp-win32-x64-0.35.5.node are
in the same directory. Rebuild these too if changing the native interface.
The application does not check or require the original DLL's checksum.

You may modify LGPL components for your own use, and reverse engineer the
combined work to debug those modifications, as permitted by their licenses.
No warranty is provided; see the full license texts.
