# FRAMEDECKS branding asset inventory

**Source of truth:** the user-provided FRAMEDECKS logo in
[framedecks-logo-source.png](../assets/brand/framedecks-logo-source.png). The source is copied unchanged. Derived
assets are generated with `python tools/generate_brand_assets.py` using Pillow, already included in the desktop build
dependencies.

## Existing branded assets and their use

| Asset | Use | Action |
|---|---|---|
| `assets/brand/kc-mark.png` | Meeting Workbook header mark | Replaced with the new logo's icon crop; workbook layout and text remain unchanged. |
| `assets/brand/kc-about-header.webp` | README and release-page marketing header | Regenerate from the updated About page with `python tools/make_readme_header.py`; that preserves the release version marker. |
| `app/img/kc-emblem.webp` | Dashboard, phone remote, teleprompter, About page, and tray source family | Replaced with the new logo's icon crop so existing placements retain their proportions and function. |
| `app/icons/remote-180.png` | iOS home-screen icon | Regenerated from the new logo icon. |
| `app/icons/remote-192.png` | PWA icon and Windows tray image | Regenerated from the new logo icon. |
| `app/icons/remote-512.png` | PWA launcher icon | Regenerated from the new logo icon. |
| `app/icons/remote-maskable-512.png` | Maskable PWA launcher icon | Regenerated with safe-area padding. |
| `app/icons/favicon-16.png`, `favicon-32.png` | Browser favicons | Added from the new logo icon and linked in `remote.html`. |
| `packaging/kingdom-connect.ico` | Windows executable and installer icon | Regenerated with multiple icon sizes; existing reference path retained. |
| `assets/brand/framedecks-logo-horizontal.png` | Horizontal logo lockup for future use | Generated from the supplied illustration and wordmark/tagline. |
| `assets/brand/framedecks-logo-stacked.png` | Stacked logo for future use | Exact copy of the supplied logo artwork. |
| `assets/brand/framedecks-logo-icon.png` | Standalone icon for future use | Illustration crop from the supplied artwork. |

The About page tagline now reads **Present • Equip • Inspire**. The existing user-facing control layouts, navigation,
and workflows are unchanged.

## Assets intentionally retained

- `app/img/kc-world.svg` is decorative About-page background artwork, not a product logo or launcher icon.
- `docs/images/*.png` are screenshots of actual product workflows. They remain unchanged so documentation does not
  misrepresent the application UI.
- Existing fonts, workbook templates, vendor assets, and camera assets are not branding replacements.

## Surfaces not present in this repository

- No dedicated desktop splash-screen asset or splash screen was found.
- The only current login screen is the phone remote's local PIN screen; it now uses the new icon.
- There is no hosted account-login page yet. Apply the supplied logo when that surface is implemented.
- No Mac app bundle or Mac launcher icon exists; do not claim Mac packaging parity.
- Marketplace imagery is not currently part of the application. The supplied source and horizontal/stacked variants
  are suitable inputs if store assets are created later.

## Regenerating and verifying

The source PNG must remain the original 768×768 artwork. To regenerate the application derivatives:

```powershell
python tools/generate_brand_assets.py
```

To regenerate the README and release-page header, start the app and capture its About screen as described in
`docs/development/release-process.md`.

The generator intentionally preserves existing asset paths consumed by the desktop app, remote PWA, workbook
generator, PyInstaller, and installer. Run the packaging self-check and tests after regeneration.
