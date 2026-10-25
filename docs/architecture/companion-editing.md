# Editing services in the companion (design)

**Status:** agreed with the owner on 25 October 2026 (E1–E4 as recommended, [§7](#7-decisions-for-the-owner)).
Steps 1 and 2 of [§5](#5-tests-and-delivery) are built: `hosted/src/lib/frame-edit.ts` (tested by
`hosted/tests/frame-edit.test.mjs`) and editing on the Services page (`hosted/src/components/services-panel.tsx`).
Step 3 (the owner's live test) remains. History and restore ([§6](#6-history-and-restore-built-after-steps-12)) are
built too.
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
| Scripture in a Frame's Scripture Content: reference, translation and (optional) text | yes | yes | yes |
| Order of Frames | yes | yes | yes |
| New Frame from a template, duplicate, delete | — | yes | yes |
| Looks (theme), layouts, Meeting & Branding, media | — | — | yes |

The PC does not fetch verse text by itself: a reference saved without text shows as the reference until the operator
fetches it in the Studio's Scripture fetch bar (or the text is typed or pasted in the companion).

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
  is overwritten silently. As built, a save sends only the fields the person changed in the form (`applyDraft`), and
  after a conflict the form shows the latest version with those changes on top (`rebase`): a browser test caught a
  re-save writing back the form's old script over the PC's newer one. Alternative: save the companion's version as a copy ("keep both", as two PCs do).

## 5. Tests and delivery

| Step | What | Proven by |
|---|---|---|
| 1 | Editing helpers in `hosted/src/lib/frame-edit.ts` (change a Frame's name, script, questions, references; reorder) | Node tests on the shared fixtures: after joining the edited records, the desktop's own `store.js` normalize changes nothing; only the edited record changes; live fields and media untouched |
| 2 | Services page editing (owners/admins), conflict and live-Frame messages | Browser tests against stand-in responses, phone and desktop; PGlite: a plain member's push refused |
| 3 | Live test by the owner | Edit a script on the phone; it appears on the PC within a minute; editing the live Frame waits until it leaves the screen |

## 6. History and restore (built after steps 1–2)

The database keeps every replaced or deleted version 30 days (`entity_history`, written by `sync_push`; readable by
workspace members, member records only by owners and admins). The Services page uses it with no database change:

- **History** on every Frame (everyone in the workspace): the current version and the kept ones, newest first, each
  with who made it (a member's name with "(companion)", the PC's name, or a neutral word when unknown), when, and
  what changed (name, group, script, questions, scripture, Content or looks, settings). `hosted/src/lib/history-view.ts`.
- **Restore** (owners and admins, as E2): an older version is saved as the newest with `sync_push`, like an edit, so
  the PC applies it the same way (the Frame on screen waits until it leaves the screen).
- **Deleted in the last 30 days**: Frames deleted on the PC or elsewhere, with who deleted them and when, and Restore
  (back to the last version before the delete; it comes back at the end of the order).

## 7. Decisions for the owner

Answered by the owner on 25 October 2026: **E1–E4 as recommended.**

| # | Question | Decision |
|---|---|---|
| E1 | What can be edited in the companion (§2) | **A**: names, scripts, questions, scripture, Frame order |
| E2 | Who may edit (§3) | **Owners and admins** (no database change) |
| E3 | Editing the Frame that is on screen (§4) | **Allow**; the PC applies it when the Frame leaves the screen |
| E4 | Two people changed the same Frame (§4) | **Reload and ask to save again**, keeping the typed text |
