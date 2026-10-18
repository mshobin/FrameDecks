# Release process

A release is something a church volunteer will install and rely on during a service. This process exists so that no
release surprises them.

## Version numbers

Versions are **major.minor** (6.5, 6.6, 7.0). The number lives in one place: `APP_VERSION` in `server.py`.
`packaging/get_version.py` reads it for the installer name, and the app shows it in Settings → About.

- Increase **minor** (6.6 → 6.7) for every release, including fixes.
- Increase **major** (6.x → 7.0) when the way volunteers work changes significantly, or saved data from the new
  version cannot be opened by the previous one.

## Before you start

- [ ] Every change for the release is merged into `main` (or a `release/<version>` branch).
- [ ] The **Build Windows installer** workflow is green on that commit.

## Steps

1. **Bump the version.** Set `APP_VERSION = "X.Y"` in `server.py`. Update places that name the installer file, such
   as the version in [building-the-installer.md](building-the-installer.md).
2. **Write the release notes** in `docs/releases/vX.Y.md`. The file name must match the version exactly: the workflow
   publishes it as the body of the GitHub Release. Write for volunteers (see
   [changelog standards](changelog-standards.md)), starting with the download instruction and ending with known
   limitations.
3. **Update `CHANGELOG.md`.** Move the **Unreleased** entries into a new `## [X.Y] - YYYY-MM-DD` section and add the
   link at the bottom.
4. **Update the design history.** Add a section `## N. Version X.Y: …` to
   [docs/architecture/design-history.md](../architecture/design-history.md) describing design decisions and anything a
   future maintainer needs to know.
5. **Update the user documentation** for any changed behaviour.
   - **Changed a Python package?** Builds install `packaging/requirements-desktop.txt` with the exact versions in
     `packaging/constraints.txt`. After changing a requirement, run a build, test the installer, then copy the
     build log's "Successfully installed …" versions into `constraints.txt`.
6. **Run the checks locally:**
   ```bash
   node tests/run.js
   python packaging/check.py
   ```
7. **Build.** Push to `main`, or run **Build Windows installer** on the release branch. Download the
   **Kingdom Connect vX.Y** artifact.
8. **Test the installer on a real Windows PC** (not only a development machine):
   - install over the previous version, and check that meetings, members and settings are still there;
   - run the [manual service-safety test](testing.md#manual-service-safety-test) with a real webcam, Zoom or Teams,
     the phone remote on the church Wi-Fi, and PowerPoint if the release touches it.
9. **Tag and publish.**
   ```bash
   git tag vX.Y
   git push origin vX.Y
   ```
   The workflow builds again and publishes a GitHub Release named **Version X.Y** with the installer and its
   `.sha256` file.
10. **Verify the release.** Download the installer from the Releases page and check its SHA-256:
    ```powershell
    Get-FileHash ".\Kingdom Connect vX.Y.exe" -Algorithm SHA256
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
