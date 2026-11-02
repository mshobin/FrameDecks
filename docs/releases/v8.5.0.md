## FrameDecks v8.5.0

Plan more than one meeting in the same workspace, each with its own Frames, and see the meeting Frame by Frame on a
timeline beside the plan. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over
8.4.0 and earlier and keeps all your meetings, members, settings and recordings.

**Workspace owners, once:** run `0012_meetings.sql` in Supabase (SQL Editor) before making a second meeting. It keeps
the meeting list safe from service PCs that are still on an older version. Until it has run, the website plans one
meeting as before and says so.

## What's New
- **Several meetings.** On the website's Plan page, **New meeting** makes another meeting, with its own name, date,
  notes and Frames. Choose a meeting at the top to plan it; **Rename** renames it, and its Frames stay with it.
- **One meeting at a time on the PC.** Above the Frames, the **Meeting** list chooses the meeting this PC shows and
  runs. **New** makes another. Next, Previous, the phone remote and the Teleprompter follow only that meeting's Frames.
- **The timeline.** Beside the plan, the timeline shows the meeting from its name down to the last Frame, with a
  picture of each Frame. Drag a Frame to move it, select it and press Alt + ↑ or ↓, or delete it there. Frames glide
  to their new place. **Hide timeline** folds it away; on a phone it sits under the plan.
- **A .frame file per meeting.** **Export for Service PC** exports the meeting you are planning. On the PC, **Use this
  plan** replaces only that meeting; the PC's other meetings and their Frames are kept.

## Enhancements
- The Help guide's steps and screenshots show the meetings and the timeline.
- Each meeting at the top shows its date and how many Frames it has.
- The timeline respects the system's "reduce motion" setting: Frames then move without gliding.

## Fixes
- No separate fixes in this version.

## Performance Improvements
- The timeline's movement uses the browser's own animation, with no extra download; the Plan page's styles stay
  within the same size budget.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Service PCs on 8.4 or earlier show every Frame of every meeting together. Update them to 8.5 to see one meeting at
  a time.
