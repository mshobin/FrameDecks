# FrameDecks design system

One look and one voice for the program (`app/`) and the website (`hosted/`). It came out of the October 2026 design
audit (items DD-01 to DD-26). Two checks keep it true: `python tools/css_tokens.py` (tokens) and
`node tests/visual/layout.mjs` (layout, in a browser). Both run in GitHub's "Desktop checks".

## Voice

FrameDecks is for church leaders and volunteers, not engineers. Write for the person running the meeting.

| Do | Don't |
| --- | --- |
| Say what happens: "Hide all clears the screen." | Say how it works: "Clears the overlay layer stack." |
| Name things the way the screen does: **Frame**, **Content**, **FRAMECAST**, **Live tools**. | Use internal words: "scene", "layer", "vcam", "L1/L2". |
| Put help in one plain line **under** the control. | Put internals in brackets after the label: "Template (kept for…; not in Previous / Next)". |
| Use sentence case: "Go Live", "Hide all", "Read our story". | Use ALL CAPS or Title Case For Every Word. |
| Ask before anything that removes, naming it: "Disconnect “Sanctuary PC”?" | Ask "Are you sure?" |
| Map service errors to a clear next step; keep technical details out of the interface. | Show database, provider or browser error messages directly. |
| Say what to do next when something is missing: "Link the service PC". | Show error codes or file names to everyone. Keep those for Diagnostics or an admin note. |
| Say the camera is **FRAMECAST** and the program is **FrameDecks**. | Call the camera FrameDecks (`tests/test_camera_name.py` fails). |
| Use the words in the [glossary](../guide/glossary.md): **Black screen**, **Running order**, **People**, **Up next**. | Use two words for one thing (Blackout and Black screen, Services and Running order). |

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
- **One palette file.** Every colour the program writes out lives in `app/css/palette.css`, named by hue and lightness
  (`--blue-150`, `--gold-650`; 0 is black, 1000 is white). Translucent colours take their channels from `--rgb-*`:
  `rgba(var(--rgb-gold-650),.14)`. `python tools/css_palette.py` moves any new colour there (safe to rerun);
  `tools/css_tokens.py` fails on a colour literal anywhere else outside a token definition. The legacy LAN remote's
  `teleprompter.css` is the one exception (it does not load the palette).
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
  (`--shadow-modal`, dialogs), and `--el-2-up` for bars docked to the bottom edge. Focus and selection rings are not
  elevations. Mixed corners use the same scale (`8px 8px 0 0`).
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
| Dialog | `modal()` in `app-bridge.js` (focus lands on the main button) | Native `<dialog>`; `useConfirmation()` for named destructive actions |
| Navigation | the command bar, Settings menu (grouped, Find a setting) | sidebar; bottom tab bar under 860 px |
| Dates | — | `When` / `relativeTime()` from `src/lib/when.ts` ("2 h ago", exact time on hover) |
| Content preview | — | `KindIcon` (`content-kind.tsx`) + first line, reference or count |

## Running a service

The program has two modes, switched at the top of the window (`js/service.js`; owner-approved, 27 October):

- **Prepare** is the Studio for planning: Frames, Content, the editor, Quick Start, + Frame.
- **Run** is the Studio during a service. It shows the running order, what is on screen, **Up next**, Previous, Next,
  Go Live, Hide all, the Live tools and the list steppers. Every editor is hidden, and renaming, dragging, menus,
  Delete, cut, paste and undo do nothing in the Studio. Double-clicking a Frame still puts it on screen.
- **Hide all** is calm (neutral) while nothing is on screen and red the moment something is (`body.kc-on-air`).
- **Live tools** are grouped: On screen (Hide the selected Content, Black screen, Freeze, Draw), Teleprompter (one
  entry: in this window, over Zoom, own window) and Emergency, set apart. Esc and clicking away close the menu; Esc
  then does not also hide everything.
- **Before you start** (in Run, while nothing is on screen) reads the status the program already has: Frames, how
  people will see it, the program, the phone remote.
- **Practice mode** turns on the black screen for the audience; the program's own previews add `practice=1` and show
  everything. Turning the black screen off any other way ends Practice.
- **How people see it** (Settings) is one guided choice: FRAMECAST, the Share Window, or a projector, TV or OBS. The
  camera and display pages sit under it in the menu.
- Settings that few people need (Transitions, Keyboard shortcuts, Security, Diagnostics) are folded under
  **Advanced**; Find a setting searches them. FRAMECAST shows presets first and its exact numbers under **Fine-tune**.

## Identity (website, 27 October)

One direction, built in `hosted/src/app/identity.css` (loaded after the older look, before the light theme):

- **Premium, not busy** (owner's brief, 27 October, which replaced the earlier "restraint" pass). The one main action
  is warm gold with a soft lift on hover and one sweep of light; everything else is bordered. The ambient light behind
  every page is back (painted once).
- **Frame corners.** `.fd-framed` puts gold corner marks on a product picture or the demo screen: the Frame, the
  product's own idea. Use it on at most one or two things per page.
- **Serif for scripture.** EB Garamond (`--serif`, `.fd-serif`; a 36 KB latin subset in `public/fonts/`) for verses,
  the next service's title and the landing timeline; Source Sans 3 for everything else.
- **Places.** Home · Plan · Live · People, then Settings: Branding, Service PCs, Help. Your account is the avatar.
- **Words.** Team, Service PCs, People, Go Live (`docs/guide/glossary.md`). The name is always **FrameDecks**.

## Landing (website, redesigned 28 October)

`hosted/src/components/landing.tsx` (the words and the order) with one file per part in
`hosted/src/components/landing/`, styled by `hosted/src/app/landing.css` (loaded after `identity.css`). For every kind
of gathering; no church-only words, no named third-party streaming or camera products (FRAMECAST, our own camera, is
named), no invented quotes, logos or numbers. Built from the owner's written spec of 28 October (the reference mock-up
file was not in the repository).

- **Approved words, unchanged:** "Prepare with Purpose. Present with Excellence.", the hero paragraph, **Ready to
  Serve?**, the steps **Day 1 … Day 4**, every feature, demo frame and question. New: a KJV verse above the closing
  call (Colossians 3:23) and four more gatherings in the marquee.
- **Order and parts:** `landing/nav.tsx` (clear, then blurred navy with a hairline after 20 px; How it works, See it
  work, Features, Questions; Reduce effects, theme, About, Sign in, gold Download · free) → `landing/hero.tsx` (words
  rise blur-to-sharp, the second line in gold that sweeps once; the Studio window arrives tilted, rotateX 28°, lower and
  at 0.92, settles flat, then leans toward the mouse up to 6° on desktop; the phone floats over its corner; gold corner
  brackets; a gold light beam sways behind) → audience marquee (gold-outlined chips, pauses on hover, faded edges) →
  `landing/how-it-works.tsx` + `landing/step-screens.tsx` → `next-demo.tsx` (16:9 room screen, wire, phone; Next,
  Previous, Hide all, Black screen; ripple; a gold dot runs along the wire on every tap; a question drains its gold
  timer) → 12-column bento with `landing/feature-previews.tsx` (Teleprompter with a gliding script and a gold reading
  line; FRAMECAST picture with soft background, LIVE, logo and lower third) and four small tiles → `landing/statement.tsx`
  (the serif promise; words light up one by one as you scroll) → FAQ (a gold plus turns to ×) → Ready to Serve? (verse,
  gold sweep on "Serve?", light beam, both download buttons) → footer.
- **How it works (the 4-step guide):** on screens wider than 960 px with motion allowed, GSAP ScrollTrigger pins the
  section with `end: "+=" + innerHeight * 1.6` (about 40% of a viewport of scrolling per step) and
  `snap: { snapTo: [0, 1/3, 2/3, 1], duration: { min: 0.2, max: 0.45 }, ease: "power2.out", delay: 0.05 }`; the step is
  `Math.round(progress * 3)` and the gold rail fills with the progress. One normal wheel flick moves exactly one step
  (measured: snaps land 410 px apart at 1366 × 768). Clicking a step scrolls to its snap point. GSAP is imported only
  there (`gsap.matchMedia`, reverted on unmount): phones and "reduce motion" never download it. Elsewhere the steps are
  pill tabs with the description below, moving on every 4 s while on screen until someone taps one (never under reduce
  motion or Reduce effects). Each screen's small story replays when it becomes active and ends within about 1.2 s, and
  a gold callout sits at the window's corner. **TODO (real screenshots):** capture each step at 1200 × 750 as WebP into
  `hosted/public/product/step-*.webp` and pass `image` per step in `landing.tsx`; the drawn screens are the fallback.
- **Motion rules** (`motion.css`, `landing.css`, `components/motion.tsx`): one easing family (`--ease-out` for
  entrances of 600–1100 ms, `--ease-soft` for loops), nothing bouncy. Only `transform` and `opacity` move, except two
  one-off entrances that sharpen from a small blur (hero words, step screens). The stage light (two glows, navy and
  gold) drifts for about a minute after a page opens and then rests. Every endless loop (marquee, beam, phone float,
  teleprompter, LIVE dot) is declared paused and runs only while its `data-loop` element is on screen (`data-live`);
  none runs under "reduce motion" or **Reduce effects** (`components/effects-toggle.tsx`, `html.fd-calm`, saved in
  this browser). `tests/idle-performance.test.mjs` enforces this.
- **Reveal fix:** `data-reveal` content is visible without JavaScript; it is hidden only after `motion.tsx` has run
  (`html.fd-reveal-ready`) and has already shown whatever is on or above the screen. An IntersectionObserver
  (`rootMargin "0px 0px -8% 0px"`) reveals the rest, and a scroll/hash safety net shows anything passed over by an
  anchor jump or a fast flick, so no section can stay invisible.
- **Measured (28 October):** no horizontal scroll at 375, 768, 1366 and 1920 px; Lighthouse desktop 100 performance,
  100 accessibility; mobile (throttled) 89–90, the old landing 88–90 on the same test; JS 380 KB and CSS 21 KB
  gzipped (CSS budget raised to 24 KB on purpose in `scripts/check-budget.mjs`).

## Signed-in pages (28 October visual pass)

The same principles without changing any layout or flow: the stage light behind every page, cards with a faint gold
top edge and a deep soft shadow (the `--shadow` token in `globals.css` and `light.css`), gold eyebrows, a short gold
rail on the active place in the sidebar, every transition on `--ease-out`, and **Reduce effects** next to the theme
switch in the top bar.

## States

Every list or page that loads has the same four states (`hosted/src/components/states.tsx` on the website):

1. **Loading:** grey shapes where the content will be (`PageSkeleton`, `ListSkeleton`), never just "Loading…".
2. **Empty:** a title, one sentence and at most one action (`EmptyState`), e.g. "No Frames yet".
3. **Error:** what happened in words and **Try again** (`ErrorState`).
4. **Done:** the content.

In the program the same rule holds: the Teleprompter without a script shows one message and **Write a script**; the
first run says **Welcome to FrameDecks** with **Start fresh** as the main choice and a small card, **Your first service
in four steps** (branding, a Frame, how people see it, practising in Run).

## Themes

- **Program:** Dark, Light or Match Windows (Settings → General).
- **Website:** follows the device; the top-bar button switches Auto → Light → Dark. The choice is applied before the first
  paint, so pages never flash.

## Accessibility

- A visible focus ring (`--focus`) on every link, button and field reached by keyboard.
- A **Skip to content** link and one `<main>` on every website page.
- Status never by colour alone ("Ready", "Off air", "Online", "On screen").
- Icon-only buttons have a name and a tooltip.
- **No axe violations** (WCAG 2.1 A and AA) on any program screen, in either theme: `tests/visual/a11y.mjs`. Rows with
  their own buttons inside are list items (`aria-current` for the selected one), not `option`s; jump links are not tabs.
  An automatic scan finds about half of the problems; a pass with NVDA or Narrator is still worth doing before a release.
- **Build hidden sections on first open** where they are made by a script (`buildOnce` in `settings.js`, the About
  story's `toggle`), so the page stays light.

## Checks and baselines

| Check | Where | What fails it |
| --- | --- | --- |
| `python tools/css_tokens.py` | Desktop checks (CI), `tests/test_css_tokens.py` | a font size, weight or radius off the scale; a hand-written drop shadow; a colour outside the palette; more `!important` than the baseline (program 16, website 7) |
| `node tests/visual/layout.mjs` | Desktop checks → visual (CI) | Run showing an editor or no Up next; Hide all red with nothing on screen; Esc leaving Live tools open; the command bar cut short or scrolling at 1100–1920 px; anything over the Studio canvas; first run not focusing Start fresh; Teleprompter empty state without its action; the Settings menu out of line; serif headings |
| `hosted/tests/design-audit.test.mjs` | Hosted companion checks (CI) | missing skip link or `<main>`; "Loading…" text instead of the state kit; text under 12 px or under 4.5:1; links in gold; the light theme not applied before paint |
| `node tests/visual/a11y.mjs` | Desktop checks → visual (CI) | any axe WCAG 2.1 AA violation on any tab, Settings section, the first-run question, or the Speaker, Teleprompter and Spotlight windows, in dark and light |
| `tests/test_ui_labels.py`, `tests/test_camera_name.py` | Python tests | the program's labels, first run, camera name, Prepare / Run, Live tools groups, How people see it, Advanced and People |

**Reference screens** are in `tests/visual/baselines/` (from `node tests/visual/layout.mjs --shots`, saved as WebP). When a
change is meant to alter a screen, take new shots and replace the matching file in the same change.
