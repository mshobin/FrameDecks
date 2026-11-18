# Third-party notices

FrameDecks is proprietary software ([LICENSE](../../LICENSE), [EULA](eula.md)). It uses the software and assets below,
each under its own licence, which continues to apply to that component. Licences that ask for their text to travel with
copies are honoured as follows:
- the files under `app/vendor/` and `app/fonts/` keep their own licence files;
- the Windows installer carries this file, `LICENSE` and `NOTICE` in the program folder;
- each project's full licence is at the link given;
- the LGPL-licensed libraries (pystray; the FFmpeg libraries inside OpenCV) are separate files in the program folder
  that can be replaced, and the EULA does not restrict the rights their licences give.

**Who this is for:** anyone redistributing FrameDecks, and maintainers adding a dependency. Add a row here, in the same
change, for anything new that ships.

## Shipped in the Windows program

| Component | Licence | Use | Source |
|---|---|---|---|
| Python (runtime bundled by PyInstaller) | PSF License | Runs the program | https://docs.python.org/3/license.html |
| PyInstaller bootloader | GPL-2.0 with the bootloader exception (programs it bundles may use any licence) | Starts the program | https://github.com/pyinstaller/pyinstaller/blob/develop/COPYING.txt |
| softcam (built into the FrameDecks camera DLLs) | MIT, Copyright (c) tshino | Virtual camera | https://github.com/tshino/softcam |
| pywebview | BSD-3-Clause | Program window | https://github.com/r0x0r/pywebview |
| pystray | LGPL-3.0 (used unmodified as a separate, replaceable package in the program folder) | Tray icon | https://github.com/moses-palmer/pystray |
| Pillow | MIT-CMU (HPND) | Pictures and card text | https://github.com/python-pillow/Pillow |
| OpenCV (opencv-python) | Apache-2.0 (OpenCV 4.5 and later); the wheel bundles FFmpeg under LGPL-2.1 | Camera, video, image work | https://github.com/opencv/opencv-python |
| NumPy | BSD-3-Clause | Image arrays | https://github.com/numpy/numpy |
| cv2-enumerate-cameras | See its project page | Camera names | https://pypi.org/project/cv2-enumerate-cameras/ |
| windows-capture | MIT | Screen sharing | https://github.com/NiiightmareXD/windows-capture |
| pypdfium2, with PDFium | Apache-2.0 or BSD-3-Clause; PDFium BSD-3-Clause | PDF slides | https://github.com/pypdfium2-team/pypdfium2 |
| comtypes | MIT | PowerPoint control | https://github.com/enthought/comtypes |
| python-pptx | MIT | Export this meeting to PowerPoint | https://github.com/scanny/python-pptx |
| lxml (with libxml2 and libxslt) | BSD-3-Clause; libxml2 and libxslt MIT | Used by python-pptx | https://github.com/lxml/lxml |
| XlsxWriter | BSD-2-Clause | Used by python-pptx (charts) | https://github.com/jmcnamara/XlsxWriter |
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
