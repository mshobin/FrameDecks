# FrameDecks design system

One look and one voice for the program (`app/`) and the website (`hosted/`). It came out of the October 2026 design
audit (items DD-01 to DD-26). Two checks keep it true: `python tools/css_tokens.py` (tokens) and
`node tests/visual/layout.mjs` (layout, in a browser). Both run in GitHub's "Desktop checks".

## Voice

FrameDecks is for church leaders and volunteers, not engineers. Write for the person running the meeting.

| Do | Don't |
| --- | --- |
| Say what happens: "Hide all clears the screen." | Say how it works: "Clears the overlay layer stack." |
| Name things the way the screen does: **Frame**, **Content**, **FrameDecks vCam**, **Live tools**. | Use internal words: "scene", "layer", "vcam", "L1/L2". |
| Put help in one plain line **under** the control. | Put internals in brackets after the label: "Template (kept for…; not in Previous / Next)". |
| Use sentence case: "Go Live", "Hide all", "Read our story". | Use ALL CAPS or Title Case For Every Word. |
| Ask before anything that removes, naming it: "Disconnect “Sanctuary PC”?" | Ask "Are you sure?" |
| Map service errors to a clear next step; keep technical details out of the interface. | Show database, provider or browser error messages directly. |
| Say what to do next when something is missing: "Link the service PC". | Show error codes or file names to everyone. Keep those for Diagnostics or an admin note. |
| Say the camera is **FrameDecks vCam** and the program is **FrameDecks**. | Call the camera FrameDecks (`tests/test_camera_name.py` fails). |
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
- **One source for both (9.6).** The program's CSS is the source. `python tools/design_tokens.py` writes its colours
  (dark and light), the level colours, radii and type sizes to `hosted/src/app/tokens.css` as `--fd-*`, and the
  website's variables point at them, so a palette change in the program reaches the website with one command.
  `--text-3` stays a literal on the website because its contrast is measured there. Never edit `tokens.css` by hand.
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
- **Program matches the website (8.1):** a soft background light behind the window, rounder cards with a faint gold
  edge, gold-gradient main buttons and larger page titles. Looks only; nothing behaves differently.

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

## Running a meeting

The program has one Studio for planning and running a meeting (`js/service.js`; owner-approved, 27 October; one
Studio since 8.0). There is no Prepare / Run switch, no Run view and no Practice mode.

- The **Studio** holds Frames, the **Decks** section with the selected Frame's Content, the editor, Quick Start and
  + Frame. Previous, Next, Go Live, Hide all and Live tools are always in the top bar, with the list steppers. The
  Share Window is separate and unchanged.
- **Hide all** is calm (neutral) while nothing is on screen and red the moment something is (`body.kc-on-air`).
- **Live tools** are grouped: On screen (Hide the selected Content, Black screen, Freeze, Draw), Teleprompter (one
  entry, *only you see it*: the Teleprompter window above Zoom and Teams) and Emergency, set apart. Esc and clicking
  away close the menu; Esc then does not also hide everything. To try things out before a meeting, Black screen is
  the answer: the program's own previews still show everything.
- **Ready checks** (`KCServiceChecks.list`) are a short list read from the status the program already has: Frames in
  the running order, how people will see it (FrameDecks vCam ready, the Share Window open, or an overlay page open), the
  program responding, the phone remote. Each problem has a button that goes to its fix. The Setup guide's **Ready**
  step shows them.
- **How people see it** (Settings) is one guided choice: FrameDecks vCam, the Share Window, or a projector, TV or OBS. The
  camera and display pages sit under it in the menu.
- Settings that few people need (Transitions, Keyboard shortcuts, Security, Diagnostics) are folded under
  **Advanced**; Find a setting searches them. FrameDecks vCam shows presets first and its exact numbers under **Fine-tune**.

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

## Landing (website, redesigned 28 October; one pinned stage since 26.11.2)

`hosted/src/components/landing.tsx` (the words and the order) with one file per part in
`hosted/src/components/landing/`, styled by `hosted/src/app/landing.css` (loaded after `identity.css`),
`landing-page.css` and `tour.css` (this page only). For every kind of gathering; no church-only words, no named
third-party streaming or camera products (FrameDecks vCam, our own camera, is named), no invented quotes, logos or
numbers. **Every picture of the program is a real screenshot** (`tools/make_product_shots.py`).

- **Approved words, unchanged:** "Prepare with Purpose. Present with Excellence.", the hero paragraph, **Ready to
  Serve?**, every promise and question, the KJV verse above the closing call (Colossians 3:23).
- **Order and parts (26.11.2):**
  1. `landing/nav.tsx`: clear, then blurred navy with a hairline after 20 px; How it works, Features, Download;
     Reduce effects, About, Open Workspace, gold Download · free. **The website is dark until sign-in, and the public
     pages always** (`html.fd-dark-only`, set before the first paint in `layout.tsx`, held by this bar), so the bar
     has no theme button; Light, Dark and Auto live only in the signed-in workspace.
  2. `landing/tour.tsx`, the stage (as in the owner's mockup: the words centred above, the product below, one idea
     per screen). The words are the headline and paragraph, then one chapter each. The stage has no frame: the build
     and the screens float on the page in a soft light coloured by the chapter.
     **One flow (26.11.3):** the finished flowchart holds for `HOLD` (1.2 s since 26.11.13; the first `TAKE` px of scroll carry it at once, and scrolling back up returns to the flowchart) before the Studio takes over; the Studio's
     edges fade into the page (a mask, no border); with motion allowed the scroll itself carries the screens (each
     shares `MIX` of the scroll with its neighbour, rising `RISE` px in as the last rises away, opacity eased), and
     scrolling on before the build has finished finishes it at once. Without motion the chapters change as before.
     **Chat Bubbles (26.11.3)** is the second drawn chapter (with the Teleprompter): a meeting chat with Capture on,
     three messages copied (Ctrl+C) in turn; each copied card arcs onto the FrameDecks vCam picture and pops up as a
     bubble in the program's own overlay style (`overlay.css` `.chat-list`, the same pop curve), in copy order, the
     presenter (a drawn backlit silhouette, never a photo) moving aside to make room, the prayer request pinned in
     gold. `CHAT` / `COPIED` / `COPY_AT` / `PIN_AT` in `tour.tsx`; the flying card shows only with motion.
     The stage (1000 × 620, scaled) is the app's own dark colours in both themes. On arrival, with no scrolling, a
     meeting builds itself in about five seconds: the Frame (gold) types its name, lines grow to its Decks (blue) and
     their Content (violet), then each card flies to its place in the real Studio screenshot (one transform each) and
     fades into it; ↻ Replay plays it again. Scrolling then chooses a chapter, each one real screenshot with the keys
     it uses: Command Center (Alt+Space, the keys pressed as it drops in), Prepare (the one live piece: the Teleprompter
     in the program's own style, its reading band and read words following the scroll word by word; R and V), Engage
     (Spotlight, Ctrl twice and Alt+D), Control (live: T, Alt+→, Alt+H, Alt+B), Phone. The chapter row under the
     stage fills as you go and jumps to a chapter. Each screenshot chapter moves with the scroll, drawn over the
     picture and never into it: a gold ring walks the chips, a pointer goes to the real control and presses it (one
     ripple, its key lights below), a pen stroke runs along the real underline, a fingertip taps Next on the phone.
     **26.11.27 the Studio never leaves** (owner, 9 November: "the features reveal through the Studio"): after it
     lands, the scroll moves one camera over the real Studio screenshot (tour.tsx CAM, blended across MIX of the scroll
     around each chapter boundary). **Command Center**: the Studio dims and recedes, the Command Center drops onto it
     (Alt+Space), the pointer presses Go Live and Next Frame, then Right Ctrl held and "next frame" presses it again.
     **Teleprompter**: the camera moves into the Studio's live picture (redrawn over the screenshot, so it moves with
     it), the Teleprompter docks beside it following the voice, and the verse it hears arrives on the picture word by
     word. **Together**: the camera pulls back and the suite pops out of the Studio's middle, one piece after another:
     Chat Bubbles on the camera, the corner card, the phone remote, members' phones and the sermon notes. The older
     chapters above are folded into these.
  3. Features: four promises on one row.
  4. Questions: the first four; the rest behind **More questions**.
  5. Ready to Serve?: the serif promise, the verse, both buttons → footer.
- **Cost:** one passive scroll listener, attached only while the stage is on screen and batched to one frame; only
  `transform` and `opacity` move; nothing runs at rest (measured: 0.05 % busy, no layout or style work while idle).
  **Reduce effects** shows the finished Studio at once; with less motion asked for, the build still arrives step by
  step, without movement. If the script never runs, the finished Studio shows after 4 s (`tr-fallback`).
- **Motion rules** (`motion.css`, `landing.css`, `components/motion.tsx`): one easing family (`--ease-out` for
  entrances (0.35 s since 9.11.2; the hero's one-off arrival is longer), `--ease-soft` for loops), nothing bouncy. Only `transform` and `opacity` move, except two
  one-off entrances that sharpen from a small blur (hero words, step screens). The stage light (two glows, navy and
  gold) drifts for about a minute after a page opens and then rests. Every endless loop (teleprompter, LIVE dot) is
  declared paused and runs only while its `data-loop` element is on screen (`data-live`); none runs under "reduce
  motion" or **Reduce effects** (`components/effects-toggle.tsx`, `html.fd-calm`, saved in this browser).
  `tests/idle-performance.test.mjs` enforces this.
- **One rhythm (9.11.2):** entrances use `--t-move` (0.35 s) on `--ease-out`, rising 8 px (`fd-reveal`). The finishing
  touches live in `app/flourish.css`, loaded just after first paint (`components/landing/flourish-later.tsx`, held to
  3 KB by `scripts/check-budget.mjs`): button icon nudges and Frame / Deck / Content coming together above Ready to Serve?
  (`.lp-assemble`, drawn `display: none` inline so it stays hidden without that stylesheet). `data-spotlight` also sits
  on the FAQ items, the closing panel and the download cards. `tests/motion-rules.test.mjs` holds the rules: only
  `transform` and `opacity`, all behind reduced motion and `html.fd-motion:not(.fd-calm)`, loops paused unless
  `[data-live]`; since 26.11.2 it holds `app/tour.css` to the same rules.
- **Reveal fix:** `data-reveal` content is visible without JavaScript; it is hidden only after `motion.tsx` has run
  (`html.fd-reveal-ready`) and has already shown whatever is on or above the screen. An IntersectionObserver
  (`rootMargin "0px 0px -8% 0px"`) reveals the rest, and a scroll/hash safety net shows anything passed over by an
  anchor jump or a fast flick, so no section can stay invisible.
- **Measured (29 October, 6.13):** no horizontal scroll at 375, 768, 1366 and 1920 px; Lighthouse mobile (throttled)
  86–89 performance (the paragraph is the largest paint), 100 accessibility; JS 339 KB (was 380 with GSAP) and CSS
  21 KB gzipped (CSS budget 24 KB in `scripts/check-budget.mjs`).

## Setup guide (6.14; a step-by-step wizard since 8.0)

One list of six steps in both places (`app/js/guide-steps.js`, `hosted/src/lib/guide-steps.ts`): Welcome, How people
will see it, Your phone as a remote (optional), Connect to FrameDecks (optional), Make your first Frame, Ready. In the
program a 360 px panel at the right (`app/js/guide.js`, `.gd-*` in `console.css`) shows one step at a time: "Step n of
6" and a progress bar with one segment per step (any step can be opened again), the step's title (optional steps
marked), its sentence and its buttons (the main action in gold, "Show me how", **Skip this step** on optional steps), a
status line saying what the program sees, and **Something not working?** with what to try. At the foot **← Back**,
**Do this later** and **Next →**, which is enabled only when the step is detected as done. A minus shrinks it to a
pill ("n of 6"). "Show me how" dims the window with one box-shadow around the real control and one sentence beside
it. **Ready** shows the ready checks, each problem with a fix button. The finish: the emblem settles once, "You're
ready for your first gathering", **Open the Studio**, **Close**. Motion: one entrance on `cubic-bezier(.16,1,.3,1)`,
nothing loops, nothing under reduced motion. On the website a card on Home (`.fd-guide` in `identity.css`), two
columns of steps, the PC's steps with a dashed ring and "On the PC".

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
first run says **Welcome to FrameDecks** with **Start fresh** as the main choice, which opens the Setup guide.

## Themes

- **Program:** Settings → Meeting & Branding → Look: one of the six looks (Gold & Navy, Morning Light, Chapel Stone,
  Deep Ocean, Forest, Quiet Mono) or **Same as my workspace**, then **Light or dark**: Dark, Light or Match Windows.
  Only the program window changes; the camera picture, overlays and phone remote keep their own look.
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
| `python tools/design_tokens.py --check` | Desktop checks (CI), `tests/test_css_tokens.py` | `hosted/src/app/tokens.css` not what the program's CSS says (run the tool and commit) |
| `node tests/visual/layout.mjs` | Desktop checks → visual (CI) | a Prepare / Run switch; the section under the Frames not called Decks; Hide all red with nothing on screen; Esc leaving Live tools open; the command bar cut short or scrolling at 1100–1920 px; anything over the Studio canvas; first run not focusing Start fresh; Teleprompter empty state without its action; the Settings menu out of line; serif headings |
| `hosted/tests/design-audit.test.mjs` | Hosted companion checks (CI) | missing skip link or `<main>`; "Loading…" text instead of the state kit; text under 12 px or under 4.5:1; links in gold; the light theme not applied before paint |
| `node tests/visual/a11y.mjs` | Desktop checks → visual (CI) | any axe WCAG 2.1 AA violation on any tab, Settings section, the first-run question, or the Teleprompter (`speaker.html`) and Spotlight windows, in dark and light |
| `tests/test_ui_labels.py`, `tests/test_camera_name.py` | Python tests | the program's labels, first run, camera name, the one Studio, Practice mode gone, the Setup guide wizard, Live tools groups, How people see it, Advanced and People |

**Reference screens** are in `tests/visual/baselines/` (from `node tests/visual/layout.mjs --shots`, saved as WebP). When a
change is meant to alter a screen, take new shots and replace the matching file in the same change.
