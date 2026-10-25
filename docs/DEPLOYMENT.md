# FRAMEDECKS deployment

FRAMEDECKS has two separate deployment surfaces. The desktop application is
packaged for Windows; the optional hosted companion is deployed independently.

## Desktop application

The GitHub Actions **Build Windows installer** workflow builds the camera
dependencies, runs the self-check and desktop tests, packages the application
with PyInstaller, then creates the installer with Inno Setup. Pushes to `main`
produce workflow artifacts; version tags publish a GitHub Release. For local
prerequisites and full steps, see
[Building the installer](development/building-the-installer.md) and the
[release process](development/release-process.md).

## Hosted companion

The Next.js app deploys to Vercel with `hosted/` as its Root Directory and the
Next.js framework preset. The hosted workflow runs lint, type-check, tests, and
a production build; it does not deploy to Vercel. Deployment is handled by the
Vercel project integration. See the [hosted companion guide](../hosted/README.md)
for setup details.

The hosted companion is currently a static preview, not a live service. It
does not connect to the desktop app or provide authentication, cloud data, or
device pairing.
