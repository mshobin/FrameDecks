# FrameDecks Privacy Policy

*Effective 29 October 2026 · Version 2026-10-29 · Updated 16 November 2026 (members' phones, legal basis, who is responsible, who processes data, children)*

FrameDecks is made by **Shobin Mathews** ("we", "us"). Contact: privacy@framedecks.com. Who is responsible for which
data is set out under "Who is responsible" below.

## The short version

- The FrameDecks program runs on your own PC and works without a workspace online. Your pictures, video files, the
  camera picture and your files stay on that PC.
- If you open **Members' phones**, the words on screen, pictures of the PowerPoint slides you show and the sermon notes
  you share are stored online while the room is open, so people can follow on their phones. Prayer requests, poll
  answers and typed answers from phones also pass through the website (see "Members' phones" below).
- A workspace on framedecks.com is needed only to plan together and to sync a PC with it. You open it with a passkey or a
  one-time email code; there are no passwords.
- No advertising, no tracking, no selling or sharing of your data.

## What we keep, and why

| Data | Why | Kept |
| --- | --- | --- |
| Your email address | To send you one-time links that open your workspace, and to show who did what | Until you delete your data |
| Your display name, workspaces and role in each | To give you access to the right workspaces | Until you delete your data |
| When you accepted these terms (version and time) | To show you agreed | Until you delete your data |
| Your Trusted Devices: the name you give each, when it was trusted and last used, and a hash of its device token (never the token itself) | To open your workspace on those devices without a new link, and to let you remove them | Until you remove the device, at most 180 days |
| Security events: links asked for (your address and network only as hashes), links opened, devices trusted, removed or expired | Security and accountability | One year |
| A workspace's plan: Frame names, words (scripture, questions, scripts) and order, with 30 days of earlier versions | To sync the plan between the PC and the website, and to undo changes | While the workspace exists; earlier versions 30 days |
| A workspace's member list (names and, if the workspace adds them, country, phone, email, birth date, role, groups) | For the workspace's own use: birthdays, invitations, groups | While the workspace keeps them |
| Linked PCs' names, and a log of who changed people, roles, invitations, PCs and Trusted Devices, and when the workspace synced | Security and accountability | Log: one year |
| Your passkeys: the public key and the name of each (the private key never leaves your device) | To open your workspace without a code | Until you remove the passkey or delete your data |
| Commands sent to a PC from the website (who sent which command, and when) | To run a meeting from the website, and to show the PC what was asked | 7 days |
| Device alerts: a new PC or device in the workspace, with its name and when | To tell owners and admins | One year (the last 30 days are shown) |
| Wrong codes: a hash of the network address a wrong code came from | To stop people guessing codes | One hour |
| Update checks from the program: the program version and Windows version | To offer the right update | Not stored with any identity; Cloudflare keeps request logs briefly |

## Members' phones

When the leader opens one of these on the PC, people in the meeting can use framedecks.com on their phones with no
account:

| Data | Why | Kept online |
| --- | --- | --- |
| The room: what is on screen as words (the Frame's name, a question, a scripture), the sermon notes the leader shares, and a picture (JPEG), title and words of each PowerPoint slide shown | So phones can follow along | Until the room is closed or the next one is opened; a room closes by itself after at most 12 hours |
| Prayer requests: the request, the first name if the person gives one, and a hash of the network address it came from | So the leader can read them and choose what to show | Until the church PC takes it in, at most 24 hours. On the PC it is kept in memory only and is gone when the wall or FrameDecks is closed |
| Poll answers: the choice, and a hash of a random number the phone keeps (`fd-voter`) so each phone answers once | To count answers | Until the next poll replaces it, or the PC is unlinked |
| Typed answers: the answer (up to 280 characters) and the same hash | So the leader can read them and choose what to show | Until the next question replaces it, or the PC is unlinked |

A request sent without a name does not show the leader who sent it. It is not fully anonymous: the network hash above
is kept with it for up to 24 hours to stop abuse.

## On your PC

The program keeps your plan, songs, notes, member list, settings and daily backups in your Windows user folder. They
are protected by your Windows sign-in; we never see them unless your workspace syncs them (above). Two features work
only when you switch them on:

- **Capture Chats** reads text you copy (Ctrl+C) while it is on and turns it into Memory Cards. It uses the name of the
  program the text came from and, for a browser, the web page's address only to label the card; neither is kept.
  Unpinned cards stay in memory only; pinned cards are kept on the PC.
- **Listen for scripture** and **Follow my voice** hear the PC's sound (which in an online meeting includes other
  people's voices) and turn speech into words on the PC itself. Nothing is recorded or sent.

If you use these in a meeting with other people, tell them.

## Why we may use it (legal basis)

| Purpose | Legal basis |
| --- | --- |
| Opening your workspace, syncing the plan, members' phones, commands, updates | The contract with you (providing the Service you asked for) |
| Security events, the workspace log, device alerts, network hashes against guessing | Our legitimate interest in keeping workspaces and members safe |
| Recording that you accepted these terms | Our legal obligation and legitimate interest in showing your agreement |
| Member lists, prayer requests and anything that shows religious belief or health | The church's own basis. Churches usually rely on explicit consent (GDPR Article 9(2)(a)) or on processing by a not-for-profit religious body for its members (Article 9(2)(d)). We process this data only on the church's instructions |

## Who is responsible

- **Your own account** (your email, passkeys, trusted devices, security events, terms acceptance): we are responsible
  (the controller).
- **A workspace's plan, member list and members' phones data:** the church or group that runs the workspace is
  responsible (the controller). We process this data for it (as its processor), only to provide the Service. People on
  a church's member list, and people using members' phones, should ask that church first about their data; we help the
  church answer.

### Data processing terms for churches

For data a workspace holds, we:

- process it only to provide the Service and on the workspace's instructions (what its owners and admins do in
  FrameDecks);
- make sure anyone who processes it for us is bound to keep it confidential;
- protect it as described on the Security page;
- use only the processors listed below, and announce a new one here before using it;
- help the workspace answer requests from the people whose data it is, and with security and data protection
  questions;
- tell the workspace's owners without undue delay if a breach affects its data;
- delete it when the workspace is deleted (backups within 30 days), and let owners export it before then;
- answer reasonable questions to show we follow these terms.

## Who processes it for us

| Processor | What it does | Where |
| --- | --- | --- |
| **Supabase** | The database, sign-in and one-time links, members' phones | The project's chosen region; may involve the United States |
| **Cloudflare** | The website, downloads, the update service and email forwarding | Global network |
| **Resend** | Delivering the one-time email codes, new-device emails to owners and admins, and the email telling you when your workspace was opened with your email code (the computer's browser and system, and the time) | United States |

Where data leaves the UK or the European Economic Area, these processors use the European Commission's Standard
Contractual Clauses (and the UK Addendum) or an adequacy decision.

The program also contacts, only when you use them: **Crossway's ESV API** (api.esv.org) with your church's own key, to
fetch passages you ask for; and, to download the speech model the first time you use voice features,
downloads.framedecks.com or the model's own publisher. Only the request itself is sent.

## Who processes it for us

- **Supabase** — the database, and sending the one-time links, for workspaces.
- **Cloudflare** — the website, downloads, the update service and email forwarding.
- **Resend** — delivering the one-time email codes, the new-device emails to owners and admins, and the email telling you when your workspace was opened with your email code (the computer's browser and system, and the time).

## Cookies and storage

framedecks.com uses only essential storage in your browser (your workspace session, a Trusted Device's token, your
theme, your choices). There are no
advertising or tracking cookies. See the Cookie Policy.

## Your rights

You can see, correct, export and delete your data:

- **Export:** Your workspace → **Download my data** gives you a file with your profile, your workspaces and the
  workspace records you can see.
- **Delete:** Your workspace → **Delete my data** removes your profile, your memberships, invitations, Trusted Devices
  and security events at once. A workspace you are the only person in is deleted with it. Your name is removed from
  the change log.
- **Devices:** Manage Devices lists your Trusted Devices and removes any of them at once.
- Workspace owners and admins can remove members and whole workspaces.
- Encrypted nightly backups are kept 30 days, so deleted data leaves the backups within 30 days.
- Your export has your profile, workspaces and records; ask privacy@framedecks.com for your security events and
  device list too.

Depending on where you live, you may also have the right to object, to restrict processing, and to complain to your
data protection authority. Write to privacy@framedecks.com; we answer within one month.

## Children

Workspaces are not meant for children under 16. A workspace may list young people as members (for example, a youth
group); the workspace is responsible for having permission from their parents or guardians.

The members' phone pages need no account and ask for no personal details. We do not knowingly collect personal
information from children under 13: the only identifier is the random number a phone keeps for polls, used for
nothing else. A church that uses members' phones with children should tell parents and avoid asking children for
their names in prayer requests or typed answers.

## Changes

We will post changes here and, if they matter, tell you when you next open your workspace.
