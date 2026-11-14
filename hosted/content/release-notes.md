## FrameDecks v26.11.47
Sync no longer makes extra "Frame (from your PC's name)" Frames, and what you add to a Frame stays.
Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over every earlier version and
keeps all your meetings, members, settings, notes, pinned Memory Cards and recordings.

## What's New
- Nothing new in this release: it fixes Sync.

## Enhancements
- The Frames panel's Sync preview no longer says a Frame was "edited in both places" when only this PC changed it.

## Fixes
- **No more extra Frames named after your PC.** When you changed a Frame and then changed it again before the next
  sync had finished, FrameDecks took its own earlier change, coming back from your workspace, for a change made
  somewhere else. It kept a copy of your Frame as "Frame name (from LAPTOP-…)" and put the older version back.
- **What you add stays.** That same mistake removed a scripture or question you had just added (often right after
  Next, when the Frame you were editing left the screen). Your changes now stay on the Frame and reach the workspace.
- **A deleted Frame stays deleted.** A Frame deleted soon after a sync could come back the next time.
- A Frame really changed in two places at once (on two PCs, or on the PC and the website) is still kept twice, so
  nothing is ever lost.

## Performance Improvements
- None in this release.

## Known Issues
- Extra "(from …)" Frames made before this release stay in your workspace until you delete them. They usually hold the
  scripture or question that went missing from the original Frame, so check one before deleting it: keep whichever has
  your latest Content and delete the other.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Each release is checked with Microsoft Defender before it is published.
