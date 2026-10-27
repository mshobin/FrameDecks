# FrameDecks legacy-branding audit

**Date:** 2026-10-22
**Branch:** `modernization-v1`

## Scope and result

Searched repository text files for the requested former product-name spellings and the standalone legacy abbreviation.
The search was case-insensitive for the full name and repository/identifier spellings; the abbreviation was matched
as an uppercase whole word. Hidden project files and vendored text were included. Git metadata, ignored files, and
binary assets are not searchable text and were excluded by ripgrep.

Before this report was added, the search found **181 matches in 49 files**. After updating stale repository links and
setup instructions, **172 matches remain in 45 files**. This report is excluded from those totals because its
inventory necessarily names some matching legacy paths.

No current app screen or current product title was found using the former product name. Remaining matches fall into
historical context, technical documentation, compatibility identifiers, and one incidental match in a minified
third-party library.

## User-facing references corrected

These were current instructions or links, not historical mentions:

| Location | Change |
|---|---|
| `.github/ISSUE_TEMPLATE/config.yml` | Updated FAQ, troubleshooting, and security links to the FrameDecks GitHub repository. |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Updated the roadmap link to the FrameDecks GitHub repository. |
| `CONTRIBUTING.md` | Updated clone URL and checkout directory. |
| `docs/contributing.md` | Updated clone URL and checkout directory. |
| `docs/development/building-the-installer.md` | Updated the extracted repository-folder name in contributor instructions. |

## Remaining references

### User-facing product history and upgrade guidance

These references describe versions and install migrations that actually used the earlier name. They are deliberately
retained for accurate release history and to help existing users understand upgrades.

| Location | Classification |
|---|---|
| `README.md` | User-facing migration note; explains that earlier installations and data are migrated. |
| `docs/installation.md` | User-facing upgrade note; identifies prior releases and what the installer migrates. |
| `CHANGELOG.md` | User-facing historical release entries; records the name and camera label used by older releases. |
| `docs/releases/archive/v6.1.md`–`docs/releases/v6.9.md` | User-facing historical release notes. Each occurrence describes the product, installer, camera, or files as they existed in that version. |

### Maintainer-facing history and technical documentation

These are archived design records, assessments, compatibility notes, or historical plans rather than current product
branding.

| Location | Classification |
|---|---|
| `docs/architecture/design-history.md` | Historical architecture/design decisions and identifiers. |
| `docs/design/framedecks-redesign.html` | Archived design/redesign material. |
| `docs/project/repository-audit.md` | Historical repository audit. |
| `docs/project/v6.7-plan.md`, `docs/project/v6.8-plan.md` | Historical implementation plans. |
| `docs/reference/features.md`, `docs/reference/meeting-workbook-and-branding.md` | Maintainer reference material, including old asset/template paths. |
| `docs/development/code-style.md` | Documents internal JavaScript global naming conventions. |
| `docs/development/building-the-installer.md` | Retains the legacy camera DLL name in troubleshooting instructions; the current folder instruction was updated above. |
| `docs/FRAMEDECKS_BRANDING_ASSETS.md` | Names the existing icon path intentionally retained by packaging. |

### Runtime, build, and compatibility identifiers

These are internal names and are intentionally unchanged. Renaming them could break old data discovery, imports,
inter-process coordination, driver registration/unregistration, upgrade cleanup, installer builds, or automated
checks. They are not current user-facing product titles.

| Location | Internal purpose |
|---|---|
| `legacy.py` | Detects and migrates earlier data folders and filenames. |
| `server.py` | Removes the old firewall rule; resolves the packaged camera DLL and legacy register/unregister helpers; includes the DLL name in troubleshooting details. |
| `desktop_app.py` | Internal tray-icon identifier. |
| `build.bat`, `.github/workflows/build-windows.yml` | Build and hash the existing camera DLL outputs. |
| `vcam/bin/register-framedecks-camera.cmd`, `vcam/bin/unregister-framedecks-camera.cmd` | Camera DLL registration helper filenames and paths. |
| `vcam/devices.py`, `vcam/sink.py` | Recognizes existing camera device names and loads the DLL using its established filename. |
| `packaging/check.py`, `packaging/framedecks.spec` | Build checks and executable icon path. |
| `packaging/installer.iss` | Preserves the icon/helper filenames, and removes old program folders, shortcuts, and running executable during upgrade/uninstall. |
| `tools/generate_brand_assets.py` | Writes the icon to the path still consumed by packaging. |
| `tools/make_release_notes.py` | Accepts older release-heading formats so historical notes continue to build. |
| `tools/undo-ipad-remote.ps1` | Removes firewall rules installed by earlier versions. |
| `app/js/store.js` | Existing broadcast-channel identifier used for inter-window state coordination; changing it could split communication between app windows. |
| `app/js/meeting-import.js` | Recognizes the old workbook filename during import. |
| `app/js/palette.js` | Hidden search synonym for the camera settings command; not displayed as product branding. |
| `app/css/dashboard.css`, `app/css/overlay.css`, `app/css/remote.css` | Internal font-family aliases used by the CSS cascade and canvas rendering. |
| `tests/test_legacy.py` | Verifies legacy-folder migration behavior. |

### Third-party content

| Location | Classification |
|---|---|
| `app/vendor/xlsx.full.min.js` | One incidental whole-word match in minified vendored SheetJS code; not FrameDecks branding. Do not edit upstream vendor code for this audit. |

## Preservation decision

No API, state format, database schema, persisted key, protocol/channel name, driver identifier, or installed-file
contract was renamed. The remaining former-name matches are historical or internal compatibility references; current
branding and current contributor-facing setup links use FrameDecks.
