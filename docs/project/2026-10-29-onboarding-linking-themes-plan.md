# Onboarding, one-click linking, a shorter front page and synced themes (plan, 29 October 2026)

The owner's brief of 29 October, turned into a plan that fits what FrameDecks already is: a Windows program that
presents offline, a static website on Cloudflare Pages, and Supabase for accounts and sync. When written, nothing here was built
yet; section 6 orders the work by impact and effort. Rules that still hold: the program must stay light next to a
meeting app on an 8 GB PC, presenting never depends on the internet, no tracking, and run migrations (0001–0009) are
never edited; new database work goes in `0010_*` and later.

**Status (29 October):** the owner approved all four decisions in section 7. Version 6.13 built one-click linking
(section 2, with "Type a code instead" kept) and the four-screen front page (section 3, GSAP removed). Next: the Setup
guide (6.14), then the six workspace looks (6.15).

## 1. Onboarding and guided tour

### What exists
- Program: the first-run dialog "Welcome to FrameDecks" (import or start fresh, `app/js/app-bridge.js`), a
  getting-started checklist, **Before you start** in Run, Practice mode.
- Website: the four-step first-service card on Home (`components/overview.tsx`, `FirstSteps`).

They are separate pieces. The brief asks for one guided path with progress, checkmarks and a clear finish.

### Recommendation: one "Setup guide", the same steps in both places
A calm side panel, not a wall of pop-ups. It opens on first run, can be skipped, remembers where you were, and
reopens from **Help → Guided tour** (program and website) and **Settings → About → Guided tour** (program).

| # | Step | Done when (detected, never "click to tick") | Where |
| --- | --- | --- | --- |
| 1 | Welcome: what kind of gathering? | a choice is made (sets the starting template; "Skip" keeps Blank) | both |
| 2 | How people will see it | a choice under Settings → How people see it: FrameRelay, Share Window or a screen | program |
| 3 | Your phone as a remote | a phone has connected once (the remote's first `/api` call) | program |
| 4 | Connect to FrameDecks (optional) | the PC is linked (section 2; one click) | program |
| 5 | Make your first Frame | a Frame with at least one piece of Content exists | both |
| 6 | Rehearse safely | Practice mode turned on and Next pressed once | program |
| 7 | Ready | every **Before you start** line is green | program |

**Mock-up (program, right side, 360 px wide, over the Studio):**

```
┌──────────────────────────────────────┐
│  Setup guide                 3 of 7  │   ◔ progress ring, gold
│  ────────────────────────────────    │
│  ✓ Welcome                           │   done: green tick, text dimmed
│  ✓ How people will see it            │
│  ● Your phone as a remote            │   current: gold dot, expanded
│    Scan this with your phone's       │
│    camera. It works on this Wi-Fi.   │
│    ┌────────┐                        │
│    │  QR    │   Waiting for a phone… │   live: turns ✓ by itself
│    └────────┘                        │
│  ○ Connect to FrameDecks  (optional) │
│  ○ Make your first Frame             │
│  ○ Rehearse safely                   │
│  ○ Ready                             │
│  ────────────────────────────────    │
│  Skip for now        Show me how  ▸  │   "Show me how" spotlights the control
└──────────────────────────────────────┘
```

- **"Show me how"** dims the window and cuts a soft-edged spotlight around the real control (the + for a new
  Frame, the Practice switch) with one sentence beside it. One spotlight at a time; Esc or a click outside ends it.
- **Finish:** a short, still celebration (the emblem settles, "You're ready for your first gathering", **Open Run**,
  **Close**), no confetti loop. The guide then shrinks to a "✓ Setup complete" chip in Help.
- **Motion:** the same rules as the website: entrances 600–1100 ms on `--ease-out`, nothing loops, nothing under
  reduced motion or Reduce effects.

### Architecture
- One step list shared by both sides: `app/js/guide-steps.js` (program) and `hosted/src/lib/guide-steps.ts`
  (website), kept equal by a test, like `tests/workspace-settings.test.mjs` does for settings.
- Progress per PC in `kc-app-settings.json` (`guide: {seen, skipped, done: [...]}`); on the website in the browser.
  Each step is detected from state the app already has (store, vcam status, remote presence, sync status), so the
  guide can never claim something that is not true.
- "New user" = no plan file and no `guide.seen` yet. People upgrading never see it unless they ask for the tour.
- Size: one panel component, CSS only, under 10 KB; the spotlight is one positioned element with a box-shadow mask.

## 2. One-click account linking

### What exists
`0003_sync.sql`: the PC makes a secret key, sends only its hash and gets an 8-character code
(`computer_link_start`, 10 minutes); a signed-in owner or admin types the code on the website
(`computer_link_approve`); the PC asks every few seconds whether it was approved (`computer_link_poll`). That is the
OAuth 2.0 *device authorisation grant* (RFC 8628). The secret never leaves the PC, which is the right design. Only
the typing is the problem.

### Recommendation: keep the protocol, carry the code in the link (RFC 8628's `verification_uri_complete`)
1. Program: **Connect to FrameDecks** → it calls `computer_link_start` as today and opens the default browser at
   `https://framedecks.com/connect#code=K7PM2XQ9&name=Hall%20PC&check=47`. The code is in the fragment, so it never
   reaches a server log, analytics or a `Referer` header.
2. Website `/connect`: not signed in → sign in first (Google, Microsoft or email), then come back here. Signed in →
   the authorisation screen:

```
┌──────────────────────────────────────────────┐
│            [emblem]                          │
│   Allow "Hall PC" to use your workspace?     │
│                                              │
│   Workspace  [ BSF Study            ▾ ]      │   only workspaces where you are owner/admin
│                                              │
│   This PC will be able to:                   │
│   ✓ Get your service plans and scripts       │
│   ✓ Get the workspace's member list          │
│   ✓ Send its changes back                    │
│                                              │
│   Check: FrameDecks on the PC shows  47      │   anti-phishing number
│   Requested 20 seconds ago                   │
│                                              │
│   [ Cancel ]            [ Allow ]  (gold)    │
└──────────────────────────────────────────────┘
```

3. **Allow** → `computer_link_approve(code, workspace)` as today. The page shows "Connected. You can return to
   FrameDecks" and opens `framedecks://linked` once, which brings the program to the front (the installer already
   registers `framedecks://`).
4. The program learns about the approval from its own poll. Make the poll quicker only while waiting (every 1.5 s
   for up to 10 minutes), so "connected" appears within about 2 seconds of **Allow**. Nothing secret travels through
   the browser or the deep link.

Why not a `localhost` callback or tokens in the deep link: the program would have to accept a credential from a
web page. Any page could then try to post one, and any app can register `framedecks://` on a PC. The poll keeps the
credential on the PC. The only new risk is **consent phishing**: someone sends you a link with *their* code. Answers:
- the check number shown on both screens;
- the PC's name and how long ago it asked;
- the 10-minute expiry;
- a rate limit on approvals (already 20 failures an hour);
- an email to the workspace owners when a PC is added.

### Database: `0010_link_by_url.sql`
- `computer_link_peek(code text) returns jsonb`: name, `requested_at` and the check number, for an
  authenticated user. Rate-limited like approve; answers "expired" rather than "unknown" for old codes.
- `computer_links`: add `check_digits smallint` (set in `computer_link_start`, 10–99) and `requested_at`.
- Keep typing the code as a fallback (a "Type a code instead" link), for PCs without a default browser and for
  older program versions.

### Program
`src/cloud_sync.py`: `link_start()` returns the URL; `server.py` opens it with `webbrowser.open`; Settings →
FrameDecks account shows "Waiting for you to allow this PC in your browser…" with **Open the page again** and
**Cancel**. Tests: the URL is built with the code in the fragment; the fast poll stops on approval, expiry or cancel.

## 3. A shorter front page and a new "How it works"

### Measured today
At 1366 × 768 the front page is about 9 screens tall, plus 1.6 more while "How it works" is pinned. The demo, the
features and the FAQ each take a full screen.

### Recommendation: about 4 screens, everything important above the fold

```
┌─ above the fold (1366 × 768) ───────────────────────────────────────────────┐
│ Prepare with Purpose.            ┌──────────── Studio window ─────────────┐ │
│ Present with Excellence.         │   (real picture; phone over its corner) │ │
│ one-line promise                 └─────────────────────────────────────────┘ │
│ [Download for Windows · free] [Plan online first]                            │
│ ✓ Free & open source  ✓ Works offline  ✓ Phone remote  ✓ Every screen+stream │
└──────────────────────────────────────────────────────────────────────────────┘
 Screen 2  How it works: one window, four steps that play by themselves (below)
 Screen 3  "See it work" demo | features as tabs: Present · Plan · Team · Private
 Screen 4  Questions (4 shown, "More questions" opens the rest) + Ready to Serve? + footer
```

- **Hero:** two columns (words left, product right) so both are above the fold. The audience chips become the
  one-line "For meetings, classes, conferences, events and services" plus four proof ticks.
- **How it works** (replaces the scroll-pinned version, and GSAP with it, saving about 45 KB of JavaScript):
  - Four tabs across the top, each with a thin gold progress bar that fills over about 6 seconds and then moves on,
    like "stories".
  - Hover, keyboard focus or a tap pauses it; clicking a tab jumps there.
  - It stops after one full round, so it does not loop forever.
  - The screens and their small stories (`landing/step-screens.tsx`) are kept.
  - It runs only while visible, and shows step 1 still under reduced motion.

```
 [ Day 1 Plan ▬▬▬▬▬ ][ Day 2 Rehearse ▭▭ ][ Day 3 Check ▭▭ ][ Day 4 Present ▭▭ ]
 ┌──────────── one app window: the active step's screen ───────────┐  Day 1
 │                                                                  │  Plan together
 │                                                                  │  two lines of text
 └──────────────────────────────────────────────────────────────────┘  [‹] [❚❚] [›]
```

- **Features as tabs:** four tabs, each a picture on one side and three short lines on the other, instead of a
  six-tile bento.
- **Demo:** kept, but beside the feature tabs at desktop width rather than a section of its own.
- **Questions:** the four most asked open in place; the rest sit behind "More questions" (progressive disclosure).
- **The statement** "Every screen. Every stream. Every member of your team." moves into the closing panel.

Cost and checks: about the same CSS; JavaScript drops by GSAP. The existing tests (approved words, Day 1–4, no
church-only words, loops only on screen) still apply. Check at 375 / 768 / 1366 / 1920 and with Lighthouse.

## 4. Themes that sync from the website to the PC

### What exists
- The program's interface: Dark / Light / Match Windows, kept on each PC (`app/js/nav.js`, `kc-theme`).
- The website: the same three, per browser.
- What the audience sees: the brand colour (eight swatches, synced as `brand`) and the card looks (synced as
  `theme` records, `src/sync_entities.py`).

### Recommendation: two kinds of theme, with clear names
1. **Workspace look** (what the room and the stream see), chosen on the website under **Branding → Look**, synced to
   every linked PC. A gallery of six curated looks, each a bundle:
   - accent colour;
   - card style (glass, solid, minimal);
   - serif or sans for scripture;
   - lower-third style;
   - transition style.

   The looks: Gold & Navy (today's default), Morning Light, Chapel Stone, Deep Ocean, Forest, Quiet Mono. Plus
   "Custom" built from the existing swatches.
   - Stored as a new single synced record `look` (add to `SINGLE` in `sync_entities.py` and the matching TS helper).
   - The PC applies it as soon as it pulls, **except while something is on screen**: the existing live hold keeps
     the change until the screen is clear, so a look never jumps mid-sentence.
2. **Interface appearance** (the program's own window): stays a personal choice. Add "Follow my workspace" as a
   fourth option that uses the workspace look's light or dark base and its accent.

**Mock-up (website, Branding → Look):** a grid of six cards, each a live miniature of a question card and a verse on
a dark or light stage, the chosen one with gold corners (the frame motif). Below the grid: "Applies to 2 linked PCs.
A PC that is presenting changes once its screen is clear."

### Architecture
- No new table: the `look` record goes through the existing sync path (outbox, pull every minute, conflict rules).
- The look is applied with CSS variables in the program's overlay and FrameRelay renderer
  (`app/css/palette.css`, `src/vcam/overlay.py`), so switching never reloads anything.
- Tests:
  - every look's text is readable (contrast at least 4.5 : 1 on its own card);
  - the TS and Python look lists match;
  - a live hold delays the change.

## 5. What would set FrameDecks apart

### Differentiators to say louder (already true; most presentation tools lack them)
- Presents fully offline; the internet is only for planning together.
- Runs the room screen, the stream and video meetings from one place (FrameRelay, the program's own virtual
  camera, with cards and background blur).
- A phone remote that also works across town (the companion's Live page).
- Practice mode: the audience sees black while you rehearse.
- A Teleprompter over the meeting window.
- Scripture with references and versions built in.
- Free, open source, no adverts, no tracking. Pictures and video never leave the PC.

### New ideas, in order of delight per effort
1. **One-click linking** (section 2): the first moment people judge the product.
2. **Setup guide** (section 1): fewer "how do I…" messages, faster first gathering.
3. **"Take it home" page:** a QR on the last Frame opens a phone page with the night's verses, questions and notes.
   It is a static snapshot from the website, no account needed, and nothing is collected. Groups keep coming back.
4. **Run-through timer:** in Practice mode, record how long each Frame takes. Run shows "about 42 min" and warns
   when the plan is longer than the slot.
5. **Safe Next:** a 1-second hold on Next shows the next Frame's preview on the phone before it goes to the room.
6. **Backup operator:** a second linked PC (or phone) follows Live and can take over with one tap if the main PC
   stops, using the existing relay and "can run services" permission.
7. **Workspace looks gallery** (section 4).
8. **Volunteer rota with reminders**, from the People list (who runs the PC, who leads, who reads).
9. **Weekly carry-over:** "Start this week from last week" copies the plan, keeping the regular Frames and clearing
   the ones that change.
10. **Calm status light:** one place that says "All good: camera, phone, screen" and, when something is wrong,
    the single thing to do.

Avoid: song lyrics (licensing), usage analytics (the no-tracking promise), always-on AI or live captions on the
presenting PC (they would slow the PC down during a meeting; keep AI on demand, as today).

## 6. Priorities: impact against effort

| Item | Impact | Effort | Order |
| --- | --- | --- | --- |
| One-click linking (URL carries the code, authorisation page, fast poll, check number) | High | Medium (1 migration, 1 page, small program change) | **1** |
| Front page to 4 screens; How it works as an autoplay stepper (drop GSAP) | High | Medium (website only) | **2** |
| Setup guide in the program (7 detected steps, spotlight, Guided tour button) | High | Medium–High | **3** |
| Workspace looks synced from the website (6 curated + custom) | Medium–High | Medium (sync record, overlay CSS variables, renderer) | **4** |
| Setup guide on the website (same steps, shared list) | Medium | Low once 3 exists | 5 |
| Run-through timer | Medium | Low | 6 |
| "Take it home" phone page | High delight | Medium | 7 |
| Safe Next preview | Medium | Low–Medium | 8 |
| Backup operator | High for larger events | High | 9 |
| Volunteer rota and reminders | Medium | Medium | 10 |

**Suggested releases**
- **6.13:** items 1 and 2, plus the email to owners when a PC is linked.
- **6.14:** item 3, and item 5 on the website.
- **6.15:** item 4.
- After that, items 6–10 one at a time, each with a live test in `docs/qa/live-test-guide.md`.

## 7. Decisions for the owner
1. Linking: keep "Type a code instead" as a fallback? (Recommended: yes, small and quiet.)
2. Looks: approve the six names and palettes before building (mock-ups first).
3. Front page: approve the 4-screen layout and removing the scroll-pinned guide (and GSAP).
4. Which of the new ideas in section 5 go on the roadmap.
