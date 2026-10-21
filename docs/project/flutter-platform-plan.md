# Kingdom Connect on Flutter: the same app on every platform

Status: **Studio and phone remote built** (October 2026).

The Flutter app in [`kingdom_connect_app/`](../../kingdom_connect_app/) is a native rebuild of the Windows app: the
same design, the same Frames and Content, the same saved file. It is not a new product.

| Device | What it is |
|---|---|
| Windows, macOS, Linux | The **Studio**: top bar, Frames, Content, canvas, inspector, Settings, and a full-screen **Share Window** for the projector or for sharing in Zoom / Teams |
| iPhone, iPad, Android | The **remote control** for Kingdom Connect on the PC (remote.html): PIN sign-in, Live, Frames, Content, Teleprompter. On a tablet the three are side by side |

## 1. How it stays the same as the Windows app

- **One state, one file.** The state is the JSON document the Windows app saves (`kc-saved-content.json`) and serves
  (`api/state`). The Dart engine (`lib/engine/`) keeps it as plain maps, so nothing is lost when either app reads
  what the other wrote.
- **The same rules.** `lib/engine/scenes.dart` and `normalize.dart` are a function-by-function port of
  `app/js/store.js` (Scenes, Present, normalize). `tool/parity/make_fixtures.js` runs the real store.js under Node on
  fixed scenarios (Go Live, the item stepper, Hide All, the eye, Question / Scripture / Both, profiles, an untidy old
  file) and `test/engine/parity_test.dart` replays them in Dart: every resulting state must be identical.
- **The same look.** `lib/ui/theme.dart` holds the tokens of `app/css/theme.css`; `lib/ui/program_view.dart` draws
  the cards of `app/css/overlay.css` (navy card, gold ring, label and rule, EB Garamond verse, Source Sans question,
  birthday, announcement, prayer, lower third, countdown, branding, Emergency screen, Blackout) in the overlay's own
  unit, so the canvas, the Share Window and a 4K screen show the same layout. The fonts are the Windows app's.

## 2. Where the state lives

| Situation | Backend |
|---|---|
| Desktop, Kingdom Connect (Windows program) running on this PC | `EngineBackend` on `127.0.0.1:8750`: the same long-poll and save-with-revision as store.js, 409 = someone saved first, make the change again on top |
| Desktop, no program running (Mac, Linux, or a PC without it) | `LocalBackend`: `kc-saved-content.json` in the app's support folder, written atomically |
| Phone or tablet | `EngineBackend` to the PC's address, signed in with the PIN (`api/remote-login`); the sign-in is kept in the device's secure storage |

## 3. Built

- Studio: Go Live (T), Previous / Next Frame, the Transition menu, Auto, the item stepper (◀ Question 2 / 3 ▶), the
  Program menu (Black screen, Emergency screen, Freeze, meeting profile), Hide All (Esc), the on-air pill and the
  connection light.
- Frames: search, All / Favorites / Recent / Library, groups, LIVE / NEXT, ★, ⋯ (Go Live, Duplicate, Save as template,
  New Frame from a template, Move, Delete), + Frame from the built-in templates, Question / Scripture / Q + S on the
  live Frame, double-click to Go Live.
- Content: L1, L2… with icon, detail, LIVE, lock and eye; + Content (cards and text Content).
- Inspector: Frame (name, group, favourite, template, teleprompter script, Duplicate, Save as template, One Frame per
  question), Timing (transition and length, auto advance), History; Content editors for questions and scriptures
  (edit, add, reorder, remove, Show), birthday, announcement / prayer / lower third / countdown, branding.
- Settings: branding, meeting profile, Emergency message, where the Frames are saved, the phone remote, about.
- Share Window: full screen on desktop; Esc or a double-click returns.
- Remote: everything in the Simple remote (Previous / Next Frame and Content, CHANGE, Freeze, Black screen,
  Teleprompter, Hide All), Frames with search and Go, Content with ON / OFF, the transition choice, Disconnect.

## 4. Still on the Windows program only (later phases)

Stated plainly so nobody expects them in this version:

1. Camera, screen, window, image, video and PowerPoint Content (capture and media). The Flutter Studio shows them in
   the list and lets you rename, show, hide and delete them; the Windows program draws them.
2. The **FrameCast camera** on Windows lives in the Windows program (a Windows 11 Media Foundation camera,
   PR #9). On the **Mac** the Flutter app has its own: a CoreMedia IO camera extension (§6).
3. Members, birthdays and email; the Meeting Workbook; the command palette; Annotate; the Teleprompter dock.
4. The Flutter desktop hosting the phone remote itself (today phones connect to the Windows program).

## 5. Build and test

```bash
cd kingdom_connect_app
flutter pub get
flutter analyze
flutter test                                   # parity with store.js, the backends, the Studio and the remote
KC_SHOTS=/some/folder flutter test test/ui     # also writes screenshots
KC_ENGINE_URL=http://127.0.0.1:8750/ KC_ENGINE_PIN=123456 flutter test test/engine/engine_backend_test.dart
```

CI (`.github/workflows/flutter-app.yml`) analyses, tests, and builds Windows, macOS, iOS (unsigned), Android and Linux.

## 6. Store readiness

| Store | Status |
|---|---|
| Microsoft Store | The Studio packages as MSIX. The current FrameCast camera (softcam, a DirectShow filter registered with `regsvr32` as administrator during install) does not meet the Store's rules for a silent, per-user install. It is being replaced by a Windows 11 Media Foundation virtual camera (`MFCreateVirtualCamera`, current-user access, no administrator permission). |
| Mac App Store | The Studio is sandbox-friendly (its own file, local network to the PC). The FrameCast camera is a CoreMedia IO camera extension (`macos/KingdomConnectCamera`): a sandboxed system extension inside the app, the kind Apple allows in the Mac App Store (the old DAL plug-ins are not). The app sends it the program through its sink stream (`macos/Runner/CameraBridge.swift`, `lib/ui/camera/mac_camera.dart`) only while an app is receiving the camera. It needs the Apple Developer team: copy `macos/Runner/Configs/Signing.xcconfig.example` to `Signing.xcconfig`. Unsigned builds run as before, without the camera. |
| App Store (iPhone, iPad) | Remote only. iOS has no virtual cameras, and the remote does not use the camera. Needs the local-network usage description and signing. |
| Google Play | Remote only. Needs signing and the target-SDK level Play asks for at the time. |
