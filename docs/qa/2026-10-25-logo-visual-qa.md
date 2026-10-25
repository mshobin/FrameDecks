# Logo visual QA, 25 October 2026

The credential-free task from [.ai/NEXT_SESSION.md](../../.ai/NEXT_SESSION.md): check the gold-outline emblem
(`assets/brand/framedecks-emblem.svg`) in the light theme, the teleprompter, remote and Speaker pages, and the 16 px
favicon.

**Method.** The desktop program (`server.py`, version 6.10 on the `claude/peaceful-albattani-6m445e` branch with
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
| Tray icon, packaged Windows run | Not checked here (needs a Windows build). |

## Seen in passing (not logo-related, not changed)

- Speaker View and the Teleprompter window, at 1280×800 and 1000×700: the floating "Frame 1 of 2 · Next Frame…" pill
  overlaps the "No script for …" line. In the light theme the pill's grey text on its dark background is low in
  contrast. Desktop UI is frozen by [CLAUDE.md](../../CLAUDE.md), so this is recorded for the owner, not fixed.
