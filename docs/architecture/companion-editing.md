# Editing services in the companion (design)

**Status:** proposed on 25 October 2026, waiting for the owner's answers to E1–E4 ([§6](#6-decisions-for-the-owner)).
**Builds on:** sync ([metadata-sync.md](metadata-sync.md)). D3 there chose "view first; editing as the next step".

## In short (for the owner)

- **What it adds:** on the companion's **Services** page, change a Frame's name, its Teleprompter script and the
  questions and scripture references of its Content, and put Frames in a different order. The service PC picks the
  change up within about a minute, the same way it picks up changes from another PC.
- **What stays as it is:** the desktop program. Its screens do not change; edits arrive through the sync it already
  has. Pictures, videos, looks and layouts are still changed on the PC only.
- **Safe by default:** a Frame that is on screen is never changed under the operator. The edit waits on the PC
  until that Frame leaves the screen (the rule sync already follows).

## 1. How it works

The companion already reads every record with `sync_pull` and joins them with `hosted/src/lib/sync-entities.ts`.
Editing changes one record's body in the browser and sends it back with `sync_push`, carrying the revision it was
read at (`baseRev`). The database stores it only if nobody changed that record in the meantime. The PC's next pull
applies it through the normal save path (`cloud_sync.py`), which holds back a change to the live Frame.

```mermaid
sequenceDiagram
  participant Ph as Companion (Services)
  participant DB as Supabase
  participant PC as Service PC (cloud_sync.py)
  Ph->>DB: sync_pull (Frames, order, rev of each)
  Ph->>DB: sync_push [{kind: frame, id, baseRev: 7, body: …new script…}]
  DB-->>Ph: ok, rev 8   (or "conflict": someone changed it first)
  PC->>DB: sync_pull (every minute, or after its own save)
  DB-->>PC: frame rev 8
  PC->>PC: apply; if that Frame is live, hold it until it leaves the screen
```

No new database function is needed for owners and admins: `sync_push` already accepts a signed-in owner or admin of
the workspace, and records who made each change (`updated_by`) for the 30-day history.

## 2. What can be edited (decision E1)

| | Recommended (A) | B: more | C: everything |
|---|---|---|---|
| Frame name, group | yes | yes | yes |
| Teleprompter script (`notes`) | yes | yes | yes |
| Questions in a Frame's Question Content (add, edit, remove, reorder) | yes | yes | yes |
| Scripture references in a Frame's Scripture Content (the PC fetches the text as today) | yes | yes | yes |
| Order of Frames | yes | yes | yes |
| New Frame from a template, duplicate, delete | — | yes | yes |
| Looks (theme), layouts, Meeting & Branding, media | — | — | yes |

A covers getting a service ready from home (the words of the service) and leaves the visual design to the PC. B adds
making and removing Frames, which needs the templates' layout logic in the companion (more code, more risk).
C means re-creating much of the Studio on the web, which the rules rule out for now.

## 3. Who may edit (decision E2)

- **Recommended:** owners and admins, as `sync_push` allows today (no database change).
- Alternative: also members given a new "Can edit services" permission (a new migration `0006`, like "Can run
  services" in Phase 5).

## 4. The Frame on screen and conflicts (decision E3, E4)

- **E3, the live Frame.** Recommended: allow the edit; the companion says "This Frame is on screen now: the PC applies
  your change when it leaves the screen". Alternative: refuse editing the Frame that is on screen.
- **E4, two people at once.** If the record changed after the companion read it, `sync_push` answers "conflict" and
  stores nothing. Recommended: the companion reloads that Frame, keeps the person's unsaved text in the box, and says
  "Changed on the PC (or by someone else) while you were editing. Check and save again." Nothing is lost and nothing
  is overwritten silently. Alternative: save the companion's version as a copy ("keep both", as two PCs do).

## 5. Tests and delivery

| Step | What | Proven by |
|---|---|---|
| 1 | Editing helpers in `hosted/src/lib/sync-entities.ts` (change a Frame's name, script, questions, references; reorder) | Node tests on the shared fixtures: the edited record joins on the PC (`sync_entities.py`) to the same plan with only that change; live fields and media untouched |
| 2 | Services page editing (owners/admins), conflict and live-Frame messages | Browser tests against stand-in responses, phone and desktop; PGlite: a plain member's push refused |
| 3 | Live test by the owner | Edit a script on the phone; it appears on the PC within a minute; editing the live Frame waits until it leaves the screen |

## 6. Decisions for the owner

| # | Question | Recommendation |
|---|---|---|
| E1 | What can be edited in the companion (§2) | **A**: names, scripts, questions, scripture references, Frame order |
| E2 | Who may edit (§3) | **Owners and admins** (no database change) |
| E3 | Editing the Frame that is on screen (§4) | **Allow**; the PC applies it when the Frame leaves the screen |
| E4 | Two people changed the same Frame (§4) | **Reload and ask to save again**, keeping the typed text |
