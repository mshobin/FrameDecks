# Migration plan: FrameDecks to the target architecture

The plan that follows from the [architecture review](architecture-review.md) (25 October 2026). It moves FrameDecks
the rest of the way to the target split (cloud for people, templates, settings, AI and audit; desktop for media,
rendering, the camera and meeting delivery) **without breaking anything that works today and without visible UI
changes** unless the owner approves them first.

**Who this is for:** the owner, who makes the decisions in §8, and maintainers, who carry out the steps in §7.

**Ground rules for every step** (from `CLAUDE.md` and the owner's brief):
- Additive and backward compatible: new tables, new optional fields, adapters behind a switch. Nothing is removed or
  rewritten.
- One step per pull request, with tests, and the four continuity files updated in the same PR.
- Desktop UI, branding and functions unchanged. Anything visible waits for an owner decision (§8).
- Presenting never depends on the cloud. Paid services are never required.

---

## 1. Current state

Summarised from [architecture review §1](architecture-review.md#1-current-architecture-assessment).

- **Cloud (Supabase + Vercel).**
  - Sign-in by emailed link; Google and Microsoft are ready to switch on.
  - Workspaces, owner/admin/member roles, invitations, "Can run services", with RLS on every table.
  - Synced records: Frames, templates, library, looks, meeting and members.
  - 30-day record history; 7-day command log.
- **Desktop (Windows).**
  - Studio, camera engine, softcam virtual camera, Share Window, OBS overlay pages, PowerPoint control.
  - Local media, Stream Deck plugin, cloud sync and companion control.
  - Works offline.
- **Already done on this branch (PR #32).**
  - Audit P1–P4 (less disk, CPU, memory and copying during a service).
  - C2: a watchdog restarts FrameDecks after a crash.
  - The Stream Deck plugin.

## 2. Target state

| Area | Target | How FrameDecks gets there |
|---|---|---|
| Members | The cloud is the store; PCs keep a cache that can be rebuilt | M-D2 option A (step 5) |
| Groups | Member groups in the cloud | M-D6 (step 8) |
| Audit | One log of who did what: membership, invitations, roles, PC link/revoke | Step 1 |
| AI | Optional, free by default (Ollama on the PC); results cached; paid providers only as plug-ins with keys kept server-side | M-D3 (step 6) |
| Templates | Shared within a workspace (now); a shared store later | Unchanged for now |
| Media | Local-first, $0 cloud cost; Frames name their files reliably across PCs | Step 3 |
| PPTX export, audio | Local features | M-D4 (step 7) |
| Secrets | No secret in plain text on PCs | Step 2 |
| Distribution | Apache 2.0, signed installer at no cost | M-D1 (step 4) |
| Hosting | A free plan whose terms allow a ministry, or self-hosted | M-D5 |

## 3. Gaps

From [architecture review §2](architecture-review.md#2-architecture-gap-analysis), in priority order:

1. **No general audit log.**
   - Membership, invitation, role and PC changes leave no trace.
   - No decision needed.
2. **ESV API key stored in plain text** in the data folder. No decision needed.
3. **Media references are file names only.**
   - A Frame synced to another PC can name a file that PC lacks, and nobody is warned.
   - Audit C8. No decision needed.
4. **No licence, unsigned binaries.** Needs M-D1.
5. **The PC is the source of the member list** (rule 3). Needs M-D2.
6. **No AI.** Needs M-D3.
7. **No PPTX export, no audio Content.** Both need UI, so they need M-D4.
8. **No member groups.** Needs M-D6.
9. **Hosting terms.** The Vercel Hobby plan is for personal, non-commercial use. Needs M-D5.

## 4. Risks

| Risk | Where | Mitigation |
|---|---|---|
| A sync change corrupts or loses a plan | Steps 3, 5 | Only add optional fields; old PCs ignore them. Fixtures (`tools/make_sync_fixtures.py`) and round-trip tests must stay green. Record history keeps 30 days |
| A migration breaks the live cloud | Steps 1, 5, 8 | New numbered migrations only, never edits to old ones. Tested on PGlite in `npm test`. The owner runs them in the SQL editor with a rollback script beside each one |
| Members disappear from a PC that is offline or unlinked | Step 5 | Option A keeps the cache. A PC that is not linked stays exactly as today. The cache is only replaced by a full, successful download |
| The ESV key is lost when moving it | Step 2 | Read the old file if Credential Manager has nothing; delete the file only after the new store reads back the same key |
| Licence obligations missed | Step 4 | Third-party notices file built from the licence table in [architecture review §9](architecture-review.md#9-technical-debt-review) |
| AI slows or blocks the program | Step 6 | Off unless a provider answers. Every call has a timeout and runs off the UI and camera threads. Results are cached |
| A visible change slips in | All | UI frozen by rule. PR checklist: "no visible change" or the M-D decision that allows it |
| Cloud is unreachable during a service | All | Nothing in this plan puts the cloud in the presenting path |

## 5. Rollback strategy

- **Code.** Each step is one PR, reverted with `git revert` of its merge commit. A new release then replaces the
  installed one. The old installer stays on the release page.
- **Switches.** New behaviour sits behind an app setting or environment variable, off by default where it changes
  behaviour. Rollback without a release means turning it off:
  - `memberAuthority` = `pc` / `cloud` (step 5);
  - `ai.provider` = `none` (step 6).
- **Database.** Every migration ships with an undo script in `hosted/supabase/rollback/` (`NNNN_<name>_down.sql`;
  kept out of `migrations/` so it is never run by mistake). Undo scripts drop only what that migration added. Data in existing tables is never changed by a migration.
- **Sync data.** Fields are additive, so a PC on an older version keeps working against newer records. Record history
  (30 days) can restore any record from the companion.
- **Member cache (step 5).** Before the cloud becomes the source, a backup of `kc-members-private.json` is kept.
  Switching `memberAuthority` back to `pc` uses it.

## 6. Validation plan

**After every change** (Phase 4 of the brief), all of these must pass before pushing:

| Check | Command |
|---|---|
| Python tests (desktop, sync, supervisor, resources, local commands) | `python -m unittest discover -s tests -p "test_*.py"` |
| Desktop JS tests | `node tests/run.js` |
| Packaging | `python packaging/check.py` |
| Companion (in `hosted/`) | `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` |
| Stream Deck (in `streamdeck/`) | `npm test`, `npm run build`, `npm run validate` |
| Docs | `python tools/check_doc_links.py`, `git diff --check` |
| CI | Green on the PR head, including the Windows build |

**Also, by step:**
- **Sync changes.** Rebuild fixtures, then show an old PC's record still loads and a new PC's record still loads on
  an old version (round-trip tests).
- **Desktop runtime.** Run the real program in a browser:
  - Go Live, Next, blackout, Hide all;
  - the camera keeps producing frames;
  - no new toast or control appears.
- **Live checks by the owner**, using [live-test-guide.md](qa/live-test-guide.md):
  - migrations in Supabase;
  - Google/Microsoft sign-in;
  - the virtual camera in Zoom, Teams and OBS;
  - PowerPoint;
  - Stream Deck.

  This cloud environment cannot reach `*.supabase.co` or a Windows camera.

**Results go into** `docs/post-migration-report.md` once the steps are done.

## 7. Implementation order

Steps 1–3 need no decision and no visible change; **built on PR #32** (see
[post-migration-report.md](post-migration-report.md)). The rest wait for the decision named.

| # | Step | Needs | Visible change | Size |
|---|---|---|---|---|
| 1 | **Audit log.** Migration `0006`: an `audit_log` table (workspace, who, action, target, when, small detail) written by triggers on `memberships`, `invitations`, `computers` (linking ends in a `computers` row, so `computer_links` needs none). Readable by owners and admins via RLS; kept 1 year. Nothing reads it yet. **Built** | — | None | Small |
| 2 | **ESV key to Windows Credential Manager.** Same store as the PC's sync key; moved on first start; falls back to the file elsewhere (tests, non-Windows). **Built** | — | None | Small |
| 3 | **Missing-media check** (audit C8). **Built:** the PC lists Frames whose files are not in its media folder (`/api/media/check`, this PC only; in Diagnostics), and says so in its log when a sync brings such a Frame. No media moves. **Not built yet:** size and hash in sync records (two PCs holding different files under one name would keep rewriting each other's reference; it needs a small design first), and showing the check on screen (one line in an existing status text: owner approval) | — | None | Medium |
| 4 | **Licence and free signing.** `LICENSE` (Apache 2.0), `NOTICE`, third-party notices. Then make the repository public and apply to SignPath Foundation; sign the installer and DLLs in the Windows build | M-D1 | None | Small + owner |
| 5 | **Members from the cloud** (option A). When linked, the workspace is the source; the PC's list becomes a cache rebuilt from the cloud; desktop edits go up as today. Unlinked PCs unchanged. Switch `memberAuthority` | M-D2 | None | Medium |
| 6 | **AI provider layer and first feature.** One interface; Ollama on the PC first; self-hosted endpoint; paid plug-ins through a Supabase Edge Function with server-side keys; cached by hash. Hidden when no provider answers | M-D3 | One entry for the chosen feature | Medium |
| 7 | **PPTX export and audio Content** | M-D4 | One menu item; one Content type | Medium each |
| 8 | **Member groups** in the companion (table, column, filter) | M-D6 | Companion only | Small |
| — | **Hosting plan** | M-D5 | None | Owner |

## 8. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| **M-D1** | **Licence and free code signing.** SignPath Foundation signs open-source projects for free, but only for a public repository under an OSI licence. A private repository has no free signing option | Apache 2.0, public repository, apply to SignPath Foundation. Until approved: keep SHA-256 checksums, submit each release to Microsoft Defender as a false positive, keep one stable release page. Cheapest paid alternative: Azure Trusted Signing (about $10 a month) |
| **M-D2** | **Who owns the member list.** A: the cloud is the source and PCs keep a rebuildable cache (works offline). B: cloud only, no copy on PCs (needs a sign-in state on the desktop Members screen; birthdays need the cloud) | **A** |
| **M-D3** | **First AI feature**, if any: discussion questions from a passage; a tidied Teleprompter script; translated card text | Discussion questions from a passage |
| **M-D4** | **PPTX export and audio Content**: build them (each adds one entry in existing styles), or not now | Owner's call; both are optional |
| **M-D5** | **Hosting terms.** Confirm Vercel's plan suits a ministry, move the companion to a free tier that allows organizations, or self-host (Next.js and Supabase both can be) | Confirm the plan first; self-hosting stays possible |
| **M-D6** | **Member groups**: add them to the companion (desktop unchanged), or not now | Add, companion only |

None of steps 4–8 starts without its decision.

**The owner's answers (25 October 2026):**
- **M-D1:** Apache 2.0, a public repository, and SignPath.
- **M-D2:** option A. The cloud is the source; each PC keeps a copy it can rebuild, so it works offline.
- **M-D3:** discussion questions from a Bible passage, with Ollama on the PC (free).
- **M-D4:** build both PPTX export and audio Content. Each adds one entry on screen, in existing styles.
- **M-D5:** the long-term recommendation is in [architecture/hosting.md](architecture/hosting.md):
  - the companion moves to Cloudflare as static files before a public launch or a second church;
  - Supabase stays Free while it is a pilot, then Pro.
- **M-D6:** member groups in the companion only; the desktop is unchanged.
