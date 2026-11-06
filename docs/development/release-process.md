# Release process

Step by step, with rollback: [release-checklist.md](release-checklist.md).

A release is something a church volunteer will install and rely on during a service. This process exists so that no
release surprises them.

## Version numbers

Since November 2026 versions are **YY.MM**: the year and the month of the release (26.11 is November 2026, 27.01
January 2027; the month always has two digits). A further release in the same month adds a number: 26.11.1, 26.11.2.
The number lives in one place: `APP_VERSION` in `src/server.py`. `packaging/get_version.py` reads it for the
installer name, and the app shows it in Settings → About.

- A new month's first release takes that month's number (26.11 → 26.12, or 27.02 if nothing was released in
  between).
- Another release in the same month adds or raises the last number (26.11 → 26.11.1 → 26.11.2).
- The updater, the release manifest and the website compare versions as numbers padded to four parts, so 26.11
  equals 26.11.0 and every YY.MM is newer than the 9.x versions before it (`tests/test_version_scheme.py`).
- A date does not say how big a change is: the release notes' first line does ("A big update: …").

Versions before 26.11 (4.9 to 9.13.0) are recorded in
[docs/archive/changelog-before-26.11.md](../archive/changelog-before-26.11.md).

## Before you start

- [ ] Every change for the release is merged into `main` (or a `release/<version>` branch).
- [ ] The **Build Windows installer** workflow is green on that commit.

## Steps

1. **Bump the version.** Set `APP_VERSION = "YY.MM"` in `src/server.py`. Update places that name the installer file, such
   as the version in [building-the-installer.md](building-the-installer.md).
   Then refresh the header picture, which shows the version: start the app (`python src/server.py --no-browser`) and run
   `python tools/make_readme_header.py`. It captures the About screen's header into
   `assets/brand/framedecks-about-header.webp`, used at the top of the README and of the GitHub Release. The build fails if
   the picture shows another version.
2. **Write the release notes** in `docs/releases/vYY.MM.md`, with the sections `## What's New`, `## Enhancements`,
   `## Fixes`, `## Performance Improvements` and `## Known Issues`. Other sections, such as `## Removed` (used in
   8.0.0 for features that were taken out), are kept and placed after them. The file name must match the version
   exactly. On a version tag, the workflow runs `tools/make_release_notes.py`, which puts the About screen's header
   first and the sections in that order, and publishes the result as the GitHub Release. Write for volunteers (see
   [changelog standards](changelog-standards.md)), starting with the download instruction.
3. **Update `docs/CHANGELOG.md`.** Move the **Unreleased** entries into a new `## [YY.MM] - YYYY-MM-DD` section and add the
   link at the bottom.
4. **Update the design history.** Add a section `## N. Version YY.MM: …` to
   [docs/architecture/design-history.md](../architecture/design-history.md) describing design decisions and anything a
   future maintainer needs to know.
5. **Update the user documentation** for any changed behaviour.
   - **Changed a Python package?** Builds install `packaging/requirements-desktop.txt` with the exact versions in
     `packaging/constraints.txt`. After changing a requirement, run a build, test the installer, then copy the
     build log's "Successfully installed …" versions into `constraints.txt`. Then make `packaging/requirements-lock.txt` again with the
     `uv pip compile` command at its top: the build installs that file with `--require-hashes` (9.3, audit M5).
6. **Run the checks locally:**
   ```bash
   node tests/run.js
   python packaging/check.py
   python tools/check_doc_links.py
   python tools/make_release_notes.py --check
   ```
7. **Build.** Push to `main`, or run **Build Windows installer** on the release branch. Download the
   **FrameDecks vYY.MM** artifact.
8. **Test the installer on a real Windows PC** (not only a development machine):
   - install over the previous version, and check that meetings, members and settings are still there;
   - run the [manual service-safety test](testing.md#manual-service-safety-test) with a real webcam, Zoom or Teams,
     the phone remote on the church Wi-Fi, and PowerPoint if the release touches it.
9. **Tag and publish.**
   ```bash
   git tag vYY.MM
   git push origin vYY.MM
   ```
   The workflow builds again and publishes a GitHub Release named **FrameDecks YY.MM** with the installer and its
   `.sha256` file.
10. **Verify the release.** Download the installer from the Releases page and check its SHA-256:
    ```powershell
    Get-FileHash ".\FrameDecks vYY.MM.exe" -Algorithm SHA256
    ```
    The hash must match the `.sha256` file.
11. **Announce** the release to the churches using it, with a link to the release notes and any action volunteers
    need to take (for example "restart Zoom after installing").

## When to release

- **Release early in the week** (Monday to Wednesday). Churches need time to install and test before their services.
- **Never release on a Saturday or Sunday**, except a hotfix for a problem that would break the next service.
- Prefer several small releases to one large one.

## If something goes wrong

- If a published release has a serious problem, publish a fixed version as soon as possible (see the hotfix flow in
  [branching.md](branching.md)) and say clearly in its notes what was fixed.
- Previous installers stay available on the Releases page; a church can reinstall the previous version. Data saved by
  a newer version may need the newer version, which is another reason to keep releases small.
