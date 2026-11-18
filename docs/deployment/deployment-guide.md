# FrameDecks deployment

FrameDecks has two separate deployment surfaces. The desktop application is
packaged for Windows; the optional hosted companion is deployed independently.

## Desktop application

The GitHub Actions **Build Windows installer** workflow builds the camera
dependencies, runs the self-check and desktop tests, packages the application
with PyInstaller, then creates the installer with Inno Setup. Pushes to `main`
produce workflow artifacts; version tags publish a GitHub Release. For local
prerequisites and full steps, see
[Building the installer](../development/building-the-installer.md) and the
[release process](../development/release-process.md).

## Hosted companion

The Next.js app is built as static files and deployed to Cloudflare Pages
(project `framedecks`, served at framedecks.com). The hosted workflow runs lint,
type-check, tests, a production build and a check of the built site; on `main`
its deploy job builds with the public Supabase values and uploads the build with
`wrangler pages deploy`, then checks framedecks.com from the outside. See
[the website on Cloudflare Pages](cloudflare-pages.md) for the settings, owner
steps and rollback.

The website is a live service: sign-in, workspaces, PC linking and members'
phones, all through Supabase from the browser.
