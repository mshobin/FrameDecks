# Third-party notices

FrameDecks is open-source software under the Apache License 2.0 ([LICENSE](../../LICENSE), [EULA](eula.md)). It uses the software and assets below,
each under its own licence, which continues to apply to that component. Licences that ask for their text to travel with
copies are honoured as follows:
- the files under `app/vendor/` and `app/fonts/` keep their own licence files;
- the Windows installer carries this file, `LICENSE`, `NOTICE`, the EULA and `THIRD_PARTY_LICENSES.txt` in the program
  folder; `THIRD_PARTY_LICENSES.txt` holds the full licence text of every bundled Python package, collected from the
  packages themselves at build time (26.11.64, `tools/write_third_party_licenses.py`);
- each project's full licence is also at the link given;
- the LGPL-licensed parts can be replaced: the FFmpeg library inside OpenCV is a separate DLL in the program folder;
  pystray's Python code is inside the program, and because the whole program's source is public under Apache 2.0
  anyone can rebuild it with a changed pystray. Its licence text (with the GPL text it refers to) is at
  https://www.gnu.org/licenses/lgpl-3.0.html and https://www.gnu.org/licenses/gpl-3.0.html. The EULA does not restrict
  the rights these licences give.

**Who this is for:** anyone redistributing FrameDecks, and maintainers adding a dependency. Add a row here, in the same
change, for anything new that ships.

## Shipped in the Windows program

| Component | Licence | Use | Source |
|---|---|---|---|
| Python (runtime bundled by PyInstaller) | PSF License | Runs the program | https://docs.python.org/3/license.html |
| PyInstaller bootloader | GPL-2.0 with the bootloader exception (programs it bundles may use any licence) | Starts the program | https://github.com/pyinstaller/pyinstaller/blob/develop/COPYING.txt |
| softcam (built into the FrameDecks camera DLLs) | MIT, Copyright (c) tshino | Virtual camera | https://github.com/tshino/softcam |
| pywebview | BSD-3-Clause | Program window | https://github.com/r0x0r/pywebview |
| pystray | LGPL-3.0 (used unmodified; replaceable by rebuilding from the public source, see above) | Tray icon | https://github.com/moses-palmer/pystray |
| Pillow | MIT-CMU (HPND) | Pictures and card text | https://github.com/python-pillow/Pillow |
| OpenCV (opencv-python) | Apache-2.0 (OpenCV 4.5 and later); the wheel bundles FFmpeg under LGPL-2.1 | Camera, video, image work | https://github.com/opencv/opencv-python |
| NumPy | BSD-3-Clause | Image arrays | https://github.com/numpy/numpy |
| cv2-enumerate-cameras | MIT | Camera names | https://pypi.org/project/cv2-enumerate-cameras/ |
| windows-capture | MIT | Screen sharing | https://github.com/NiiightmareXD/windows-capture |
| pypdfium2, with PDFium | Apache-2.0 or BSD-3-Clause; PDFium BSD-3-Clause | PDF slides | https://github.com/pypdfium2-team/pypdfium2 |
| comtypes | MIT | PowerPoint control | https://github.com/enthought/comtypes |
| python-pptx | MIT | Export this meeting to PowerPoint | https://github.com/scanny/python-pptx |
| lxml (with libxml2 and libxslt) | BSD-3-Clause; libxml2 and libxslt MIT | Used by python-pptx | https://github.com/lxml/lxml |
| XlsxWriter | BSD-2-Clause | Used by python-pptx (charts) | https://github.com/jmcnamara/XlsxWriter |
| bottle (used by pywebview) | MIT | Program window | https://github.com/bottlepy/bottle |
| pythonnet, clr-loader (with `Python.Runtime.dll`) | MIT | Program window (WebView2 through .NET) | https://github.com/pythonnet/pythonnet |
| Microsoft WebView2 SDK files shipped by pywebview (`Microsoft.Web.WebView2.*.dll`, `WebView2Loader.dll`) | BSD-3-Clause (Microsoft) | Program window | https://www.nuget.org/packages/Microsoft.Web.WebView2 |
| cffi, pycparser, proxy-tools, typing-extensions, six | MIT / BSD-3-Clause / BSD / PSF-2.0 / MIT | Helpers used by the packages above | Their PyPI pages |
| Libraries inside the Pillow wheel (libjpeg-turbo, libpng, zlib, FreeType, LittleCMS, libwebp, OpenJPEG, HarfBuzz, others) | IJG/BSD-3-Clause, libpng, zlib, FreeType License, MIT, BSD, MIT (and any others Pillow lists) | Pictures | https://github.com/python-pillow/Pillow/blob/main/LICENSE |
| Libraries inside the NumPy wheel (OpenBLAS, the gfortran and quadmath runtimes) | BSD-3-Clause; GCC runtime with the Runtime Library Exception | Image arrays | https://github.com/numpy/numpy/blob/main/LICENSES_bundled.txt |
| Libraries inside Python (OpenSSL, libffi, SQLite) | Apache-2.0, MIT, public domain | Runtime | https://docs.python.org/3/license.html |
| Microsoft Visual C++ runtime (`vcruntime140.dll`, `msvcp140.dll`, shipped with Python and the wheels) | Microsoft Visual C++ Redistributable licence (redistribution allowed) | Runtime | https://visualstudio.microsoft.com/license-terms/ |
| MediaPipe selfie segmentation model | Apache-2.0 | Background blur | https://github.com/google-ai-edge/mediapipe |
| Vosk speech engine (`voice_runtime/libvosk.dll`, includes Kaldi) | Apache-2.0 | Follow my voice, Listen for scripture (offline) | https://github.com/alphacep/vosk-api |
| MinGW-w64 runtime (`libstdc++-6.dll`, `libgcc_s_seh-1.dll`, `libwinpthread-1.dll`, shipped with Vosk) | GPL-3.0 with the GCC Runtime Library Exception (programs that use it may use any licence); winpthreads MIT | Used by the speech engine | https://www.mingw-w64.org |
| Vosk small English model (`vosk-model-small-en-us-0.15`, downloaded the first time voice features are used) | Apache-2.0 | Speech recognition | https://alphacephei.com/vosk/models |
| SheetJS Community Edition (`app/vendor/xlsx.full.min.js`) | Apache-2.0 (`app/vendor/LICENSE-SheetJS.txt`) | Excel import and export | https://sheetjs.com |
| Lucide icons | ISC (`app/vendor/LICENSE-lucide.txt`) | Icons | https://lucide.dev |
| QR Code Generator for JavaScript (`app/vendor/qrcode.js`) | MIT, Copyright (c) 2009 Kazuhiko Arase | Phone remote QR code | https://github.com/kazuhikoarase/qrcode-generator |
| EB Garamond (`app/fonts/`; a Latin subset in `hosted/public/fonts/`) | SIL Open Font License 1.1 (`app/fonts/OFL-EBGaramond.txt`, `hosted/public/fonts/OFL-EBGaramond.txt`) | Card text; scripture and quotes on the website | https://fonts.google.com/specimen/EB+Garamond |
| Source Sans 3 (`app/fonts/`) | SIL Open Font License 1.1 (`app/fonts/OFL-SourceSans3.txt`) | Interface text | https://fonts.google.com/specimen/Source+Sans+3 |

## The companion website (`hosted/`)

Its npm dependencies are listed with their licences in `hosted/package-lock.json`. The main ones are:
- Next.js and React: MIT;
- supabase-js: MIT;
- lucide-react: ISC;
- Tailwind CSS: MIT.

They are bundled into the built site under those licences.

## Services, not shipped

Supabase, Cloudflare and the ESV API (api.esv.org; each church uses its own key under Crossway's terms): these are reached
over the network and not redistributed by FrameDecks.
