# Kingdom Connect on Flutter: local-first, cross-platform plan

Status: **Phase 1 built** (October 2026).
- The Flutter app lives in [`kingdom_connect_app/`](../../kingdom_connect_app/). It runs side by side with the
  existing Windows program, which is unchanged and still ships as `Kingdom Connect v<version>.exe`.
- Nothing in this plan removes a working feature. A feature moves only when its Flutter version does at least the
  same job.

This document covers the ten deliverables of the platform brief:
1. [Folder structure](#1-folder-structure)
2. [Feature architecture](#2-feature-architecture)
3. [Database schema](#3-database-schema)
4. [Migration roadmap](#4-migration-roadmap)
5. [Packages](#5-flutter-packages)
6. [UI recommendations](#6-ui-redesign-recommendations)
7. [Platform considerations](#7-platform-specific-considerations)
8. [Risks](#8-risks-and-mitigation)
9. [Production checklist](#9-production-readiness-checklist)
10. [Store checklists](#10-store-submission-readiness)

---

## 0. Where we start, and what "do not break anything" means

Kingdom Connect today is two products in one program:

| Part | What it does | Where it runs | Can Flutter take it over? |
|---|---|---|---|
| **Presentation engine** | Frames and Content, Go Live, transitions, Hide All / Blackout / Freeze, Annotate. Also the **KingdomConnect virtual camera** (a DirectShow DLL fed by OpenCV), the Share Window, OBS overlay pages, the Teleprompter and its see-through overlay, the phone remote (LAN server with PIN), PowerPoint conversion and live window capture. | `server.py` (Python) and `app/` (HTML/JS), on Windows only | **Not in one step.** The virtual camera, window capture and the PowerPoint COM automation are Windows-native and run inside the Python process. Flutter has no equivalent, so rewriting them risks every Sunday service. |
| **Ministry data** | Meetings (the Meeting Form), members and birthdays, email drafts, the Meeting Workbook, branding. | Same program, JSON files in `%APPDATA%\Kingdom Connect` | **Yes.** This is ordinary forms, lists and local storage, which is what Flutter does well on every platform. |

The brief asks for both a platform change and an expanded product: attendance, volunteers, follow-ups, prayer
requests, ministries and growth metrics. The safe order is:

1. Build the **ministry operations platform** in Flutter first (Dashboard, Meeting Form, follow-ups, volunteers,
   prayer, ministries, attendance). It runs everywhere, offline, from day one.
2. Keep the **presentation engine** where it is (Windows, Python). The Flutter desktop app talks to it through its
   existing local API (`http://127.0.0.1:8750`), shows its status and opens the Studio. The phone remote keeps
   working.
3. Move engine features one by one, only once each has a native implementation that is at least as reliable (see
   Phase 2 and Phase 6). The virtual camera may stay a native Windows component permanently, and that is fine. The
   Flutter Windows app can host it as a plugin or a helper process.

So **nothing is removed**:
- The existing installer, data and features keep working throughout.
- Users who never open the Flutter app notice nothing.
- Users of the Flutter app get their existing meeting and member list imported, read-only from the old files, on
  first start.

---

## 1. Folder structure

```
kingdom_connect_app/
├── lib/
│   ├── main.dart                 # bootstrap: open the database, read settings, run the app (<2 s budget)
│   ├── app.dart                  # MaterialApp.router, theme, ScreenUtil + ResponsiveBreakpoints
│   ├── core/                     # no Flutter widgets here
│   │   ├── config/               # AppConfig (version, feature flags, limits)
│   │   ├── errors/               # AppFailure (typed, user-readable)
│   │   ├── security/             # Role, Permission, PermissionPolicy (enterprise-ready, off by default)
│   │   ├── audit/                # AuditEvent, AuditLog interface (every write goes through it)
│   │   └── utils/                # ids, clock, validators
│   ├── data/
│   │   ├── models/               # Isar collections (the schema in §3) + embedded objects
│   │   ├── database/             # Isar opening, schema list, seed, maintenance
│   │   ├── repositories/         # one repository per aggregate; the only code that touches Isar
│   │   └── migration/            # import from the Windows app (kc-saved-content.json, kc-members-private.json)
│   ├── services/
│   │   ├── storage/              # StorageProvider ← LocalProvider, OneDrive/SharePoint/GoogleDrive/iCloud (stubs)
│   │   ├── export/               # Excel (excel), PDF (pdf), export controls
│   │   ├── engine/               # EngineClient: the Windows presentation engine's local API
│   │   └── settings/             # SharedPreferences (UI prefs) + flutter_secure_storage (secrets)
│   ├── features/                 # one folder per feature: presentation/ (screens, widgets) + application/ (providers)
│   │   ├── dashboard/            # TAB 1 Executive Dashboard
│   │   ├── meetings/             # TAB 2 Meeting Form + meeting list
│   │   ├── follow_ups/
│   │   ├── prayer/
│   │   ├── volunteers/
│   │   ├── ministries/
│   │   ├── presenter/            # bridge to the Windows presentation engine
│   │   └── settings/
│   ├── shared/                   # providers shared by features (database, repositories, clock), formatters
│   ├── widgets/                  # design-system widgets: KpiCard, SectionCard, AppScaffold, EmptyState …
│   ├── routing/                  # GoRouter: routes, shell, deep links
│   └── theme/                    # tokens (colour, spacing on an 8 px grid, radius, type), light + dark themes
├── test/                         # unit (repositories, providers, migration) + widget tests (dashboard, form)
├── windows/ macos/ ios/ android/ web/ linux/   # platform runners (flutter create)
└── pubspec.yaml
```

Layer rules, checked in review and by import structure:
- **Presentation** (`features/*/presentation`, `widgets/`, `routing/`, `theme/`) uses **Business**
  (`features/*/application`: Riverpod providers and notifiers) only.
- **Business** uses **Data** (`data/repositories`) and **Platform Services** (`services/`) through interfaces.
- **Data** and **Services** never import Flutter UI.

## 2. Feature architecture

Each feature has the same three parts:

| Part | Contents | Example (meetings) |
|---|---|---|
| `application/` | Riverpod providers and `Notifier`s: state, commands, validation | `meetingListProvider`, `MeetingFormController` (draft, section completeness, save) |
| `presentation/` | Screens and widgets, responsive | `MeetingFormScreen`, `MeetingListScreen` |
| Data access | Through the repository providers in `shared/providers.dart` | `MeetingRepository` |

- **State:** Riverpod 3.
  - Reads are streams from Isar (`watchLazy` / `watch`), so lists and the dashboard update live.
  - Writes are async commands that go through the repository, which records an audit event.
- **Navigation:** GoRouter with a `StatefulShellRoute`, so each tab keeps its own stack.
  - Desktop (≥ 1024 px): a `NavigationRail`.
  - Tablet: a collapsible rail.
  - Mobile (< 600 px): a `NavigationBar` (bottom) plus a `Drawer` for the less-used sections.
  - Routes: `/dashboard`, `/meetings`, `/meetings/new`, `/meetings/:id`, `/follow-ups`, `/prayer`,
    `/volunteers`, `/ministries`, `/presenter`, `/settings`.
- **Business logic is shared.** All rules (KPIs, readiness, overdue follow-ups, attendance trends) are pure Dart in
  `application/` and `data/`, unit-tested without widgets. Desktop and mobile run the same code. Only the layout
  differs.
- **Security, ready but off.**
  - `PermissionPolicy.can(user, Permission.x)` guards every command. In the personal edition the policy allows
    everything.
  - `AuditLog` records who, what, when and which record for every write (an Isar collection, local only).
  - `ExportControls` decides whether exports are allowed and whether they include personal data.
- **Sync, prepared.** Repositories write a `syncState` (`dirty`, `version`, `updatedAt`, `deviceId`) on every record,
  so a future `StorageProvider` can push and pull changes without a schema change.

## 3. Database schema

The database is **Isar**, using the maintained community build (`isar_community`, see §8 for why). Every collection
has these base fields:

| Field | Type | Notes |
|---|---|---|
| `id` | `Id` (int, auto) | Isar key |
| `uid` | `String` (unique index) | Stable UUID v4 across devices (sync and import key) |
| `createdAt`, `updatedAt` | `DateTime` | `updatedAt` is indexed (activity feed, sync) |
| `deletedAt` | `DateTime?` | Soft delete (sync-safe, undo) |
| `version` | `int` | Optimistic concurrency and future sync |
| `dirty` | `bool` | Changed since the last sync (always true until sync exists) |

| Collection | Fields | Indexes |
|---|---|---|
| **Ministry** | name, description, colorHex, leader, active | name, active |
| **Meeting** | name, ministryUid, date, startTime, endTime, location, speaker, speakerContact; **attendance** (embedded: count, visitors, newMembers, notes); **discussion** (embedded: agenda, notes, decisions); **actionItems** (embedded list: uid, title, owner, dueDate, status `open/inProgress/done`); **spiritual** (embedded: prayerRequests, testimonies, followUps as text); status `draft/planned/held`; source `app/windowsImport/workbook` | date, ministryUid, status |
| **FollowUp** | personName, contact, reason, meetingUid?, assignedTo, dueDate, status `open/contacted/done`, notes | status, dueDate, meetingUid |
| **PrayerRequest** | title, details, requestedBy, isPrivate, status `open/answered/archived`, meetingUid?, answeredAt | status, createdAt |
| **Volunteer** | name, phone, email, ministryUids (list), roles (list), availability, active, birthDate (imported members) | name, active |
| **ServiceSchedule** | title, ministryUid, date, assignments (embedded list: role, volunteerUid, confirmed) | date |
| **AuditEvent** | at, actor, action `create/update/delete/restore/import/export`, recordType, recordUid, summary | at, recordType |

- **Meeting attendance** is embedded, because one meeting has one count set.
- **Recent activity** on the dashboard reads the newest **AuditEvent**s. There is no second activity table, so the two
  can never disagree.
- **Attendance trends** are worked out from the meetings when the dashboard opens (`DashboardMetrics`, pure and
  unit-tested). A ministry has hundreds of meetings, not millions, so this is instant. A **MetricSnapshot**
  collection (date, ministry, kind, value) is the planned optimisation once a database holds several years of
  history.
- **Search** filters the live lists in memory. It is instant at ministry scale, and indexed queries (`name`, `date`,
  `status`) are already declared for when lists grow.

### Mapping from the Windows app (Phase 1 import, read-only)

| Windows file | Field | Flutter record |
|---|---|---|
| `kc-saved-content.json` → `meeting` | title, date, time, location, presenter, contact, attendees, attendeeNotes, owner, contentNotes, notes, extra | **Meeting**: name, date, startTime, location, speaker, speakerContact, attendance.count, attendance.notes, discussion.agenda ← contentNotes, discussion.notes ← notes + extra; source `windowsImport` |
| `kc-saved-content.json` → `scenes` | Frame names (not `tpl`) | Meeting `discussion.agenda` (one line per Frame) when the meeting has no content notes |
| `kc-members-private.json` → `members` | name, phone, email, role, birthDate, country | **Volunteer** (active) |
| Meeting Workbook (.xlsx, 6.9 Meeting Form) | the details section | **Meeting** (import from file) |

The import never writes to the Windows files, and running it twice updates in place (matched by `uid`, which keeps
the Windows member id).

## 4. Migration roadmap

| Phase | Goal | Deliverables | Exit criteria |
|---|---|---|---|
| **1. Preserve** (built) | The Flutter app exists next to the Windows program. Nothing is removed. | `kingdom_connect_app/`: Dashboard, Meeting Form, follow-ups, prayer, volunteers, ministries, schedules, settings. Isar storage, backup and restore, import from the Windows data folder, Excel and PDF export, engine status and the Studio link on desktops. | Done: analyser clean, tests green (unit, widget, real Isar). The Windows installer is unchanged. CI builds Windows, macOS, iOS, Android and Linux. **Open:** trying it on real devices, and the import against real church data. |
| **2. UI to Flutter** | The ministry screens of the Windows app (Members, Birthdays, Email, the Meeting details) are used from Flutter. | Members → Volunteers screen with birthdays and email drafts. Meeting Workbook import and export in Flutter. Then the Studio "control surface" (Go Live, next / previous, Hide All) through the engine API, with the engine still rendering. | Feature parity checklist signed off on a real service. The HTML screens stay until then. |
| **3. Storage to Isar** | Isar is the source of truth for ministry data. | Two-way bridge: the engine reads meeting details from the Flutter database (a small local API or an export file) instead of `kc-saved-content.json`'s `meeting`. Old JSON stays as a backup. | One release with both, then the JSON meeting is read-only. |
| **4. Responsive** | Tablet and phone polish. | iPad split view, Android tablets, phone forms with progressive disclosure, accessibility (screen readers, 200 % text). | Usability test with three non-technical leaders per form factor. |
| **5. Sync architecture** | Ready for OneDrive, SharePoint, Google Drive and iCloud. | `StorageProvider` contract tests. Change feed from `dirty` and `version`. Conflict policy (last-writer-wins per field, with an audit trail). No provider is enabled yet. | A fake provider passes the contract tests. |
| **6. Builds and stores** | Signed builds per platform. | MSIX (Microsoft Store) next to the Inno installer, macOS notarised DMG and App Store, iOS TestFlight, Android AAB (Play). The presentation engine ships as the Windows-only component (a helper process, or later a plugin). | Store checklists in §10 complete. |

## 5. Flutter packages

Pinned to versions at least two weeks old when this was written (October 2026). Upgrade deliberately, never
automatically.

| Need | Package | Version | Note |
|---|---|---|---|
| State | `flutter_riverpod` | 3.4.3 | |
| Routing | `go_router` | 18.0.2 | |
| Database | `isar_community`, `isar_community_flutter_libs` | 3.3.2 | Maintained fork of Isar 3. The original `isar` 3.1 has not been updated since 2023 and does not support Dart 3. |
| Code generation | `isar_community_generator`, `build_runner` | 3.3.2, 2.15.1 | dev only. build_runner 2.15.2 and later need analyzer 13; the Isar generator needs below 11. |
| Settings | `shared_preferences` | 2.5.6 | Theme, density, last tab |
| Secrets | `flutter_secure_storage` | 11.2.0 | Engine PIN, future cloud tokens |
| Responsive | `responsive_framework` 1.5.1, `flutter_screenutil` 5.9.3 | | Breakpoints and adaptive sizing. Typography uses the theme scale; ScreenUtil is used for spacing only, so text never scales twice. |
| Charts | `fl_chart` | 1.2.0 | |
| Files | `file_picker` | 13.1.0 | |
| Excel | `excel` | 4.0.6 | |
| PDF | `pdf` 3.12.0, `printing` 5.14.3 | | Meeting summary PDF, share and print. pdf 3.13 needs xml 7, and `excel` 4.0.6 needs xml below 7. |
| Utilities | `path_provider` 2.1.6, `intl` 0.20.3, `uuid` 4.6.0, `http` 1.6.0 | | |

## 6. UI redesign recommendations

- **One look everywhere.** The app's navy and gold palette as Material 3 colour schemes (light and dark), an 8 px
  spacing grid, 12–16 px radius cards, and one type scale (Inter-like system sans; the serif only for scripture).
- **Executive Dashboard** (TAB 1):
  - A header with the church logo and name.
  - A row of **KPI cards**: Total meetings, Active ministries, Attendance (last 4 weeks with trend), Open
    follow-ups, Volunteers.
  - An **attendance trend** chart.
  - **Upcoming meetings** and **Recent activity** side by side on desktop, stacked on mobile.
  - **Quick actions**: New meeting, Add follow-up, Add prayer request, Add volunteer, Export.
  - Cards scale: 5 across on desktop, 2 on tablet, 1–2 on phone.
- **Meeting Form** (TAB 2): a guided, single-column form with five section cards:
  1. Meeting details
  2. Attendees
  3. Discussion
  4. Action items
  5. Spiritual outcomes

  Each card has a completeness tick and collapses (progressive disclosure). Large touch targets (48 px). Native date
  and time pickers. Autosave of the draft. Desktop shows a sticky **outline** on the right; phone shows a progress
  bar on top.
- **Avoid spreadsheet looks.** Lists are cards with one primary line and one secondary line, filters as chips, and
  no grids of cells. Tables appear only in exports.
- **Empty states** say what to do next ("No follow-ups yet — add one from a meeting or here").
- **Accessibility:** contrast AA in both themes, semantic labels on every icon button, focus order follows the
  form, everything reachable by keyboard on desktop.

## 7. Platform-specific considerations

| Platform | Notes |
|---|---|
| **Windows** | MSIX for the Store, plus the existing Inno installer for the engine. The Flutter app and the engine run side by side. The engine's API is local only (127.0.0.1), so no firewall prompt. The Isar native library is bundled by `isar_community_flutter_libs`. The WebView2 dependency stays with the engine only. The Flutter executable is `kingdom_connect.exe`, deliberately not `Kingdom Connect.exe`: the engine's start-up (6.10) ends stuck copies of `Kingdom Connect.exe`. |
| **macOS** | The App Sandbox entitlements are `files.user-selected.read-write` (file_picker, exports) and `network.client`. The second is only for the engine on the same Mac: the start-file version runs there. Hardened runtime and notarisation. Keychain for secure storage. |
| **iOS / iPadOS** | Files-app export via the share sheet (`printing` / `share`). Keychain accessibility `first_unlock`. iPad uses the rail layout and split view. No background work. |
| **Android** | minSdk 24 (Isar). EncryptedSharedPreferences for secure storage. Scoped storage: exports go through the system picker or the share sheet. Predictive back. |
| **Web** | Not in Phase 1. Isar 3's generated schemas contain 64-bit ids, which the JavaScript compiler rejects; Flutter's WebAssembly build also emits a JavaScript fallback, so it fails the same way. The app already has an in-memory store behind the same repository interfaces (used by the tests). Making the web work means keeping the Isar models out of the web build, with plain models plus a web store (IndexedDB), and that is a Phase 5 item. |
| **Linux** | Builds for development and CI. Not a product target. |

## 8. Risks and mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Rewriting the presentation engine breaks a Sunday service | Very high | The engine is not rewritten in Phases 1–5. It moves only feature by feature, with the service-safety test script (`docs/development/testing.md`) passing on real hardware. |
| Isar's future (the original author stopped; v4 never became stable) | High | Use `isar_community` (maintained). All database access is behind repositories, so a switch to Drift/SQLite touches only `data/`. The schema is documented above, and export to JSON and Excel always works. |
| Two apps confuse users during the transition | Medium | The Flutter app is called **Kingdom Connect**, and the engine is shown as **Presenter Studio**, opened from it. One installer on Windows installs both (Phase 6). |
| Data in two places (Windows JSON and Isar) | Medium | Phase 1 import is read-only from the old files. Phase 3 has a single source of truth with a documented bridge. Backups exist on both sides. |
| Store review rejects (privacy, unsigned binaries) | Medium | No tracking, no account, no network by default. Privacy labels say "data not collected". Signing certificates are budgeted in Phase 6. |
| Performance on old PCs and phones | Medium | Startup budget < 2 s: open Isar in parallel with the first frame, lazy lists, and charts from snapshots. CI measures widget build counts and runs an integration test on startup time. |
| Volunteers' personal data | High | Local only by default. Secure storage for secrets. Export controls. The audit log records exports. Role-based permissions are ready for the enterprise edition. |

## 9. Production readiness checklist

- [x] `flutter analyze` clean, `flutter test` green in CI on every pull request (`.github/workflows/flutter-app.yml`)
- [x] Unit tests for the repositories (memory and real Isar), KPI calculations, migration mapping, backup round trip and permission rules
- [x] Widget tests for the dashboard (KPIs, phone and desktop layouts, dark mode) and the Meeting Form (validation, save)
- [ ] Integration test: cold start to dashboard under 2 s on the reference Windows laptop and a mid-range Android phone
- [ ] Import tested against real Windows data folders (anonymised), including empty and corrupt files
- [ ] Crash and error handling: every failure shows a human message, and nothing is lost (autosaved drafts)
- [ ] Backups: export everything to one JSON file, and restore it
- [ ] Accessibility audit (TalkBack, VoiceOver, Narrator, keyboard only, 200 % text)
- [ ] Light and dark themes checked on every screen
- [ ] Privacy review: what is stored, where, who can export it
- [ ] Release notes and user guide for the Flutter app, in the same style as `docs/`
- [ ] The service-safety script passes with the Flutter app and the engine running together

## 10. Store submission readiness

### Microsoft Store (MSIX)
- [ ] Partner Center account, reserved name "Kingdom Connect"
- [ ] `msix` configuration: identity, publisher, capabilities (`internetClient` only if the engine link or sync is on)
- [ ] Code-signing certificate (or Store signing)
- [ ] Age rating questionnaire, privacy policy URL, screenshots (1366×768 or larger, light and dark)
- [ ] Test on Windows 10 22H2 and Windows 11 with the Windows App Certification Kit (WACK)

### Apple App Store (iOS, iPadOS, macOS)
- [ ] Apple Developer Program, bundle id `org.kingdomconnect.app`, App Store Connect record
- [ ] Privacy nutrition label ("Data Not Collected"), privacy manifest (`PrivacyInfo.xcprivacy`) with required-reason APIs (UserDefaults, file timestamps)
- [ ] Encryption export compliance (`ITSAppUsesNonExemptEncryption = NO`, unless sync adds it)
- [ ] Screenshots: 6.9" and 6.5" iPhone, 13" iPad, Mac
- [ ] TestFlight beta with at least three ministry leaders
- [ ] macOS: sandbox entitlements, hardened runtime, notarisation

### Google Play
- [ ] Play Console account, package `org.kingdomconnect.app`
- [ ] Signed AAB with Play App Signing, target SDK as required by Play at submission
- [ ] Data safety form ("no data collected or shared"), privacy policy URL
- [ ] Content rating, store listing, phone and tablet screenshots
- [ ] Internal testing, then closed testing (Play requires it for new personal accounts), then production
