# FRAMEDECKS design system

One look and one voice for the program (`app/`) and the website (`hosted/`). It came out of the October 2026 design
audit (items DD-01 to DD-26). Two checks keep it true: `python tools/css_tokens.py` (tokens) and
`node tests/visual/layout.mjs` (layout, in a browser). Both run in GitHub's "Desktop checks".

## Voice

FRAMEDECKS is for church leaders and volunteers, not engineers. Write for the person running the meeting.

| Do | Don't |
| --- | --- |
| Say what happens: "Hide all clears the screen." | Say how it works: "Clears the overlay layer stack." |
| Name things the way the screen does: **Frame**, **Content**, **FRAMECAST**, **Live tools**. | Use internal words: "scene", "layer", "vcam", "L1/L2". |
| Put help in one plain line **under** the control. | Put internals in brackets after the label: "Template (kept for…; not in Previous / Next)". |
| Use sentence case: "Go Live", "Hide all", "Read our story". | Use ALL CAPS or Title Case For Every Word. |
| Ask before anything that removes, naming it: "Disconnect “Sanctuary PC”?" | Ask "Are you sure?" |
| Say what to do next when something is missing: "Link the service PC". | Show error codes or file names to everyone. Keep those for Diagnostics or an admin note. |
| Say the camera is **FRAMECAST** and the program is **FRAMEDECKS**. | Call the camera FRAMEDECKS (`tests/test_camera_name.py` fails). |

## Type

- **One interface typeface:** Source Sans 3 in the program (`app/fonts/SourceSans3.ttf`) and on the website (a Latin
  subset, `hosted/public/fonts/SourceSans3-latin.woff2`). Headings are the same family, weight 700.
- **Serif only where people read scripture:** the verse editors and previews, the room-screen cards (`overlay.css`) and the
  quoted lines on the About page (EB Garamond).
- **Type scale (px):** 12, 13, 14, 15, 16, 18, 20, 24, 30. Nothing smaller than 12 px (keyboard hints may use 11 px).
  Larger display sizes use `clamp()` on the website.
- **Weights:** 400, 500, 600, 700, 800. No 650 or 750.

## Colour

- **Tokens, not raw colours.** Program: `--ink`, `--muted`, `--faint`, `--surface`, `--raised`, `--line`, `--accent`
  (gold), `--live` (green), `--red`, `--warn` in `app/css/theme.css`, for dark and light. Website: `--text`, `--text-2`,
  `--text-3`, `--surface`, `--hairline`, `--gold`, `--green`, `--red`, `--focus` in `hosted/src/app/globals.css`, with the
  light values in `light.css`.
- **Contrast:** body text and the faintest text are at least 4.5:1 on every surface, in both themes
  (`hosted/tests/design-audit.test.mjs` measures it).
- **Gold is for two things only:** the main action on a screen (Go Live, Next, Save, Plan the meeting) and what is
  selected (the current page, the chosen style, the Frame on screen). Links are the text colour with an underline. Small
  actions (Edit, Members, Rename) are neutral. Status has its own colours: green for on screen or online, red for
  problems, always with words.
- **Destructive actions** (Disconnect, Remove, Leave, Delete, cancel an invitation) are neutral text in a red outline,
  red on hover, and always ask first.

## Shape and depth

- **Corner radii (px):** 4, 8, 12, 16, 20 and the pill (999).
- **Elevations:** `--el-1` (hairline lift), `--el-2` (cards and menus), `--el-3` (`--shadow-pop`, pop-overs), `--el-4`
  (`--shadow-modal`, dialogs). Focus and selection rings are not elevations.
- **Spacing helpers in scripts:** `.u-mt-4`, `.u-mt-8`, `.u-mt-12`, `.u-mb-8`, `.u-ml-8`, `.u-m0`, `.u-pad-20`, `.u-grow`,
  `.u-inline-m0`. Inline styles in the scripts are only for values worked out at runtime (positions, chosen colours).

## Icons

Lucide, everywhere, one stroke width (2), monochrome: `lucide-react` on the website and `app/js/icons.js` (the same paths,
only the icons used) in the program, through `KCIcon(name, size)` or `<i data-icon="name">`. No emoji or symbol glyphs
as icons. Where a page has no icon set (the Teleprompter window), a plain-text fallback is used.

## Components

| Component | Program | Website |
| --- | --- | --- |
| Button: main / normal / quiet / destructive | `.btn.primary`, `.btn`, `.btn.quiet`, `.btn.danger` | `.fd-btn-primary`, `.fd-btn-glass`, `.fd-btn-ghost`, `.member-action.member-danger` |
| Menu of rarer actions | `<details class="ip-more">` (Frame actions), `.io-menu` (Members Import / Export), Live tools | the phone **More** sheet |
| Checkbox with help | `checkCtl(label, value, onChange, help)` in `workspace.js` | label + `.workspace-hint` |
| Dialog | `modal()` in `app-bridge.js` (focus lands on the main button) | `about-dialog.tsx` |
| Navigation | the command bar, Settings menu (grouped, Find a setting) | sidebar; bottom tab bar under 860 px |
| Dates | — | `When` / `relativeTime()` from `src/lib/when.ts` ("2 h ago", exact time on hover) |
| Content preview | — | `KindIcon` (`content-kind.tsx`) + first line, reference or count |

## States

Every list or page that loads has the same four states (`hosted/src/components/states.tsx` on the website):

1. **Loading:** grey shapes where the content will be (`PageSkeleton`, `ListSkeleton`), never just "Loading…".
2. **Empty:** a title, one sentence and at most one action (`EmptyState`), e.g. "No Frames yet".
3. **Error:** what happened in words and **Try again** (`ErrorState`).
4. **Done:** the content.

In the program the same rule holds: the Teleprompter without a script shows one message and **Write a script**; the
first run says **Welcome to FRAMEDECKS** with **Start fresh** as the main choice and a small Getting started card.

## Themes

- **Program:** Dark, Light or Match Windows (Settings → General).
- **Website:** follows the device; the top-bar button switches Auto → Light → Dark. The choice is applied before the first
  paint, so pages never flash.

## Accessibility

- A visible focus ring (`--focus`) on every link, button and field reached by keyboard.
- A **Skip to content** link and one `<main>` on every website page.
- Status never by colour alone ("Ready", "Off air", "Online", "On screen").
- Icon-only buttons have a name and a tooltip.

## Checks and baselines

| Check | Where | What fails it |
| --- | --- | --- |
| `python tools/css_tokens.py` | Desktop checks (CI), `tests/test_css_tokens.py` | a font size, weight or radius off the scale; a hand-written drop shadow; more `!important` than the baseline |
| `node tests/visual/layout.mjs` | Desktop checks → visual (CI) | the command bar cut short or scrolling at 1100–1920 px; anything over the Studio canvas; first run not focusing Start fresh; Teleprompter empty state without its action; the Settings menu out of line; serif headings |
| `hosted/tests/design-audit.test.mjs` | Hosted companion checks (CI) | missing skip link or `<main>`; "Loading…" text instead of the state kit; text under 12 px or under 4.5:1; links in gold; the light theme not applied before paint |
| `tests/test_ui_labels.py`, `tests/test_camera_name.py` | Python tests | the program's labels, first run and camera name |

**Reference screens** are in `docs/design/baselines/` (from `node tests/visual/layout.mjs --shots`, saved as WebP). When a
change is meant to alter a screen, take new shots and replace the matching file in the same change.
