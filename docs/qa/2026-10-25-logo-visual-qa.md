# Logo visual QA, 25 October 2026

The credential-free task from [.ai/NEXT_SESSION.md](../../.ai/NEXT_SESSION.md): check the gold-outline emblem
(`assets/brand/framedecks-emblem.svg`) in the light theme, the teleprompter, remote and Speaker pages, and the 16 px
favicon.

**Method.** The desktop program (`src/server.py`, version 6.10 on the `claude/peaceful-albattani-6m445e` branch with
`main` merged in) was started with an empty data folder and opened in Chromium (Playwright, 2× scale). The favicons
were drawn at real size on four browser-tab colours and enlarged 8× without smoothing. Images:
[header-dark.png](2026-10-25-logo/header-dark.png), [header-light.png](2026-10-25-logo/header-light.png),
[pages.png](2026-10-25-logo/pages.png) (remote, Speaker dark, Speaker light, teleprompter),
[favicons-8x.png](2026-10-25-logo/favicons-8x.png).

## Results

| Where | Result |
|---|---|
| Studio header, dark theme | Clear: gold outline on navy. |
| Studio header, light theme | Clear: the darker light-theme mark reads well on the cream bar. |
| Speaker View / Teleprompter window header, dark and light | Clear in both. |
| Phone remote header (390 px wide) | Small and faint on navy, but recognisable. Not changed. |
| Favicon 32 px | Clear on light and dark tabs. |
| Favicon 16 px, dark tabs | Clear. |
| **Favicon 16 px, light tabs (white, light grey)** | **Faint.** The outline is about one pixel and gold on white, so the rear frames nearly vanish; the front frame and play mark remain. Confirms the earlier finding. A heavier-stroke small-size variant would fix it but changes the approved mark, so it needs owner approval. |
| Tray icon (`app/icons/remote-192.png`, scaled by Windows) and program icon (`packaging/framedecks.ico`, the new emblem despite its old file name; 16–256 px) at 16, 20, 24 and 32 px ([tray-and-ico-6x.png](2026-10-25-logo/tray-and-ico-6x.png); rows: tray, .ico on a dark taskbar, then on a light one) | **Dark taskbar** (the Windows 11 default): readable at 16–20 px, clear at 24–32 px. **Light taskbar:** faint at 16–20 px (100–125 % display scaling), the same thin-outline issue as the favicon; fine from 24 px. A heavier small-size variant would fix both. |
| Packaged Windows run | The installer is built on GitHub from this branch (Build Windows installer); a person still has to look at the real tray. |

## Follow-up: heavier small-size emblem (approved by the owner, 25 October 2026)

`assets/brand/framedecks-emblem-small.svg` is the same mark drawn for 16–32 px: heavier strokes, no glow, the rear
frames at full strength and a filled play mark. `tools/make_emblem_assets.py` uses it only for the favicons
(`app/icons/favicon-16.png`, `favicon-32.png`, `hosted/src/app/icon.png`), the tray icon (`app/icons/tray-64.png`,
used by `src/desktop_app.py`) and the 16–32 px images in the program icon. Everything at 48 px and above, and every
in-app emblem, still uses the approved master unchanged (pixel-identical). In
[small-emblem-before-after-6x.png](2026-10-25-logo/small-emblem-before-after-6x.png) each background has three rows
at 16, 20, 24 and 32 px: the old mark, the new small mark, the new tray file as Windows scales it. On white and light
grey the outline and play mark now read at 16 px; on dark backgrounds both were already fine. Still to do: a person
looks at the real tray on an installed PC.

## Seen in passing (not logo-related, not changed)

- Speaker View and the Teleprompter window, at 1280×800 and 1000×700: the floating "Frame 1 of 2 · Next Frame…" pill
  overlaps the "No script for …" line. In the light theme the pill's grey text on its dark background is low in
  contrast. Desktop UI is frozen by [PROJECT_GUIDE.md](../../PROJECT_GUIDE.md), so this is recorded for the owner, not fixed.
