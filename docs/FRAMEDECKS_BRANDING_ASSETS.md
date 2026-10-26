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
| `app/img/kc-emblem.webp` | Dashboard, phone remote, teleprompter, About page, and tray source family | Gold-only transparent 1024×1024 version of the new logo's icon crop, so it sits on the page background instead of showing a baked-in matte. Same placements and proportions. See "Transparent emblem" below. |
| `hosted/public/framedecks-emblem.webp` | Hosted companion sidebar and welcome mark, favicon metadata | Identical copy of `app/img/kc-emblem.webp`. |
| `app/icons/remote-180.png` | iOS home-screen icon | Regenerated from the new logo icon. |
| `app/icons/remote-192.png` | PWA icon and Windows tray image | Regenerated from the new logo icon. |
| `app/icons/remote-512.png` | PWA launcher icon | Regenerated from the new logo icon. |
| `app/icons/remote-maskable-512.png` | Maskable PWA launcher icon | Regenerated with safe-area padding. |
| `app/icons/favicon-16.png`, `favicon-32.png` | Browser favicons | Added from the new logo icon and linked in `remote.html`. |
| `packaging/framedecks.ico` | Windows executable and installer icon | Regenerated with multiple icon sizes; existing reference path retained. |
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
- There is no hosted account-login page yet. Apply the supplied logo when that surface is implemented. The hosted
  overview page already uses the transparent emblem.
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

## Transparent emblem

The current emblem is a gold-outline, transparent vector mark: `assets/brand/framedecks-emblem.svg` (master) rendered
to `assets/brand/framedecks-emblem-1024.png`. Every emblem derivative comes from that PNG:

```powershell
python tools/make_emblem_assets.py
```

It writes `app/img/kc-emblem.webp` and `hosted/public/framedecks-emblem.webp` (identical, lossless 1024 RGBA), the
`app/icons/` favicons and remote icons, the navy maskable icon, `packaging/framedecks.ico`, `kc-mark.png`,
`framedecks-logo-icon.png` (brand and hosted) and `hosted/src/app/icon.png`. Pillow only. If the SVG changes,
re-render the PNG first (resvg at 1024 px width, transparent background).

`tools/generate_brand_assets.py` rebuilds the horizontal and stacked logos from the master emblem PNG, keeping the
gold wordmark and tagline cropped from the legacy `framedecks-logo-source.png` (that file is now only the wordmark
source). `kc-about-header.webp` comes from `tools/make_readme_header.py` as before. The previous opaque and gold-only
emblems remain in git history.

In the desktop light theme, `theme.css` darkens the header logos (`.cmdbar`, `.console-top`, speaker `.sp-mark`) so the
gold keeps contrast on cream. The About and phone-remote logos sit on fixed navy and are not filtered.
