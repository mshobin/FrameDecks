# Release checklist

Use this for every FrameDecks release (`major.minor`, or `major.minor.patch` for a fix release such as 6.11.1).
It follows the production audit's roadmap ([2026-10-26 audit](../project/2026-10-26-production-audit.md)).

## 1. Before tagging
- [ ] `src/server.py` `APP_VERSION` is the new version, and `python packaging/check.py` prints it.
- [ ] `docs/releases/v<version>.md` has What's New, Enhancements, Fixes, Performance Improvements and Known Issues
      (`python tools/make_release_notes.py --check`).
- [ ] The About header shows the version: run `python src/server.py --no-browser`, then
      `python tools/make_readme_header.py` (it writes `assets/brand/framedecks-about-header.webp` and `.version`).
- [ ] `docs/CHANGELOG.md` has the version's entry, and the four files in `docs/continuity/` are up to date.
- [ ] Every check in [PROJECT_GUIDE.md](../continuity/PROJECT_GUIDE.md) "Commands" passes, and on `main` these GitHub checks are green:
      "Build Windows installer" (including the installer smoke test), "Hosted companion checks" (including the
      performance budget) and "Desktop checks".
- [ ] New database migrations are listed in the release notes with what the owner runs, and each has its undo script.

## 2. Pilot first
- [ ] Install the "Build Windows installer" artifact from `main` on one real PC and run the
      [live test guide](../qa/live-test-guide.md) tests touched by this release.
- [ ] Check the camera in Zoom or Teams, the Teleprompter, FrameDecks account (sync) and Settings → Diagnostics.
- [ ] Use it for one real meeting before announcing it to other churches.

## 3. Publish
- [ ] Releases → Draft a new release → tag `v<version>` on `main`, title `FrameDecks <version>`, description left
      empty → Publish. The build fills in the notes and attaches `FrameDecks v<version>.exe` and its `.sha256`.
- [ ] Open the release and check the installer, the checksum and the About header are there.
- [ ] Run any new database migration in the Supabase SQL editor.
- [ ] Linked PCs show "Version <version> is available" in Settings → About within a day (once the repository is
      public).

## 4. Rollback
- **The program:** the previous release stays on the Releases page. Install it over the new one; data is kept.
  Its plan file and settings are compatible within the same major version (they are only ever extended).
- **A release with a serious problem:** edit the GitHub release and mark it as a pre-release (it stops being
  "Latest"), so the update notice and the website's download link point back to the previous one. Fix forward with
  a `.patch` release.
- **The database:** run the migration's undo script from `hosted/supabase/rollback/`, in reverse order of the
  migrations. If data was lost, restore the nightly backup ([database backup guide](../operations/database-backup.md)).
- **The website:** Cloudflare Pages → the project → Deployments → the previous deployment → Rollback.
