## FrameDecks v26.11.58
A security and privacy release: signed updates, a safer phone remote, protected member details on the PC, and
clearer privacy information for everyone who uses members' phones.
Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over every earlier version and
keeps all your meetings, members, settings, notes, pinned Memory Cards and recordings.

## What's New
- **Signed updates.** Every update now carries FrameDecks' signature, and FrameDecks installs an update only when the
  signature checks out. A changed or fake update is refused.
- **Confirm it's you on a new phone.** When the PC shows a code to open your own workspace on a phone, the phone now
  also asks for a 6-digit code sent to your email. Someone at the church PC can no longer open your workspace on their
  phone. Codes you make on the website itself work as before.
- **Member details protected on this PC.** The member list and its backups are now locked to your Windows account, so
  other people who use the same PC cannot read them. Nothing to do: FrameDecks converts your list when it starts.
- **Only FrameDecks can change FrameDecks.** The Studio and its windows carry a key made on your PC. Other programs or
  other people's Windows accounts can no longer change your meeting or read member details. Pages you added to OBS or
  open on a second screen keep working as they are.

## Enhancements
- **Phone remote:** phones stay signed in for up to 7 days and are signed out after 12 hours unused. A phone runs the
  whole meeting as before (Frames, Next, show and hide, cards), but can no longer replace your saved plan or library.
- A phone signed in before is no longer locked out when another device guesses the PIN wrong.
- **Members' phones:** room and prayer codes now have 8 characters, so they are much harder to guess. A wrong guess on
  the church Wi-Fi no longer blocks everyone else's prayers, polls and answers.
- Polls, typed answers, slides and notes are removed from the website when the room closes, and rooms that time out
  are cleared within the hour.
- **Team roles:** only the owner adds or removes admins; admins invite and remove members.
- Members' email addresses are shown only to owners and admins.
- Allowing a PC to connect now says how long ago it asked and whether it asked from the same network, with a warning
  when it did not.
- New-device and sign-in emails show device names in quotes and say what FrameDecks never asks you to do.
- The privacy and security pages describe members' phones, what stays on your PC, who is responsible for which data,
  and how long everything is kept.
- The website is protected by a strict security policy, has no analytics or tracking, and loads less.
- A prayer request sent to a closed prayer wall now says the wall is closed.

## Fixes
- Members' phone codes from rooms opened before this update keep working.
- An unlinked PC's members' room and prayer wall close at once.
- Removing a trusted device also ends its live updates on the website.
- A terms acceptance that could not be saved is tried again instead of being lost.
- Download my data now includes your trusted devices and security events.
- The member list is written to disk safely, so a power cut cannot damage it.

## Performance Improvements
- The website downloads less on every page.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Check the download's SHA-256 on the download page first. Each release is checked with Microsoft Defender before it is
  published.
- A bookmark to the Studio opened in an ordinary browser now shows a short page saying how to open FrameDecks; open it
  from the FrameDecks icon instead.
