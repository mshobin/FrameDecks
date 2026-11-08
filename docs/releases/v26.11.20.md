## FrameDecks v26.11.20

Hold a key and say "next frame", and every press answers at once. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over every earlier version and keeps all your meetings, members, settings,
notes, pinned Memory Cards and recordings.

## What's New
- **Voice commands, hold to talk.** Switch them on in Settings → Scripture → Voice commands. While a Frame is live,
  hold **Right Ctrl** (or F8), say what to do, and let go: "next frame", "go back", "frame three", "next question",
  "next scripture", "next slide", "show question", "show scripture", "show both", "hide all", "black screen",
  "picture back", "freeze", "unfreeze", "mute", "camera", or a verse such as "show John three sixteen". It works with
  Zoom or Teams in front. Only what you say while holding counts, so talking in the meeting never moves anything.
  Go Live, Leave, Share screen and Emergency are never voice commands: they stay a press.
- **Hold to talk in the Command Center and on the phone.** Control's header has a microphone to hold, and the phone
  and tablet remote have a big Hold to talk button in Control. What was heard shows for a moment ("Next Frame ✓").

## Enhancements
- The Keys list shows the hold-to-talk key.

## Fixes
- **Presses could wait several seconds.** Each FrameDecks window kept several requests waiting at the program (the
  picture, Listen for scripture, Memory Cards, the companion's remote), and Windows' web view allows only about six
  for all windows together, so a press such as Next Frame or a chip waited for one to come back: up to 10 seconds.
  Each window now keeps one, and the rest travel with it. A press answers in a few milliseconds.
- **The Show and Dismiss buttons of a verse heard** in the Command Center's Control header were drawn as tall as the
  big buttons in 26.11.19. They are small again and the header stays one line.

## Performance Improvements
- Voice commands use the microphone and speech model Follow my voice and Listen for scripture already share, and hear
  the command words only while held.
- The companion's remote waits at the program only while Run from the companion is on.

## Known Issues
- Voice commands hear this PC's microphone and need the FrameDecks app on Windows. The speech model downloads the first
  time it is used (as for Follow my voice).
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Each release is checked with Microsoft Defender before it is published.
