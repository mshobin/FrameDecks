# FrameDecks Privacy Policy

*Effective 18 November 2026 · Version 2026-11-18 (England and Wales as governing law; complaints contact; data breaches; regional information for Europe, the UK, India, the United States and the Middle East; 18+ accounts)*

FrameDecks is made and run by **Shobin Mathews** ("we", "us"), an individual (not a company) and a citizen of India.
Contact: privacy@framedecks.com. Complaints: grievance@framedecks.com (see "Your rights"). Who is responsible for
which data is set out under "Who is responsible" below. These terms are governed by the laws of England and Wales; the
sections under "Regional information" explain how they meet the laws where you live.

## The short version

- The FrameDecks program runs on your own PC and works without a workspace online. Your pictures, video files, the
  camera picture and your files stay on that PC.
- If you open **Members' phones**, the words on screen, pictures of the PowerPoint slides you show and the sermon notes
  you share are stored online while the room is open, so people can follow on their phones. Prayer requests, poll
  answers and typed answers from phones also pass through the website (see "Members' phones" below).
- A workspace on framedecks.com is needed only to plan together and to sync a PC with it. You open it with a passkey or a
  one-time email code; there are no passwords.
- Member details (names, phones, emails, birthdays) stay on your church's PC. They are copied to the workspace only if
  its owner turns on **Share member details**, and turning it off removes them from the cloud at once.
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
| A workspace's member list (names and, if the workspace adds them, country, phone, email, birth date, role, groups), only if the workspace owner turns on **Share member details** (new workspaces start with it off, so member details stay on your church's PC) | For the workspace's own use: birthdays, invitations, groups | While sharing is on; turning it off removes them, their earlier versions and group assignments from the cloud at once |
| Linked PCs' names, and a log of who changed people, roles, invitations, PCs and Trusted Devices, and when the workspace synced | Security and accountability | Log: one year |
| Your passkeys: the public key and the name of each (the private key never leaves your device) | To open your workspace without a code | Until you remove the passkey or delete your data |
| Commands sent to a PC from the website (who sent which command, and when) | To run a meeting from the website, and to show the PC what was asked | 7 days |
| Device alerts: a new PC or device in the workspace, with its name and when | To tell owners and admins | One year (the last 30 days are shown) |
| Wrong codes: a hash of the network address a wrong code came from | To stop people guessing codes | One hour |
| Update checks from the program: the program version and Windows version | To offer the right update | Not stored with any identity; Cloudflare keeps request logs briefly |
| A helper phone's anonymous sign-in (a phone that runs a meeting from the website without an account) | So that phone can act for the PC it was linked to | Removed 30 days after it was last used |

Network addresses we store ourselves are kept only as a hash. Supabase, which runs sign-in for us, also keeps its own
sign-in logs (including the network address and browser of each sign-in) for its security, under its own retention;
Cloudflare keeps short request logs the same way.

## Members' phones

When the leader opens one of these on the PC, people in the meeting can use framedecks.com on their phones with no
account:

| Data | Why | Kept online |
| --- | --- | --- |
| The room: what is on screen as words (the Frame's name, a question, a scripture), the sermon notes the leader shares, and a picture (JPEG), title and words of each PowerPoint slide shown | So phones can follow along | Until the room is closed or the next one is opened; a room closes by itself after at most 12 hours, and what it held is removed within an hour after that |
| Prayer requests: the request, the first name if the person gives one, and a hash of the network address it came from | So the leader can read them and choose what to show | Until the church PC takes it in, at most 24 hours. On the PC it is kept in the Prayer journey (see "On your PC") |
| Poll answers: the choice, and a hash of a random number the phone keeps (`fd-voter`) so each phone answers once | To count answers | Until the next poll replaces it or the room closes |
| Typed answers: the answer (up to 280 characters) and the same hash | So the leader can read them and choose what to show | Until the next question replaces it or the room closes |
| A first name, if the person types one, a raised hand ("I'd like to share") and when, with the same hash | So the leader can invite people to share in turn; the leader's PC may also keep the first names for Care and attendance (see "On your PC") | Online: until the room closes or gets a new code |
| Quiz answers: the choice, how quickly it came, and the same hash | To show the right answer, and a leaderboard by first name on the meeting screen (so everyone in the meeting sees the names of the top players) | Until the next question replaces it or the room closes |
| The take-home page: the meeting's name and date, scriptures, questions, song titles, the sermon notes if shared, prayer requests the leader marked OK to share (never with a name), and when the next meeting is | So members can look back during the week | Up to 14 days (the leader chooses), or until the leader removes it |

A request sent without a name does not show the leader who sent it. It is not fully anonymous: the network hash above
is kept with it for up to 24 hours to stop abuse.

## On your PC

The program keeps your plan, songs, notes, member list, settings and daily backups in your Windows user folder. They
are protected by your Windows sign-in; we never see them unless your workspace syncs them (above). The member list
syncs only if the workspace owner turns on Share member details. Two features work
only when you switch them on:

- **Capture Chats** reads text you copy (Ctrl+C) while it is on and turns it into Chat Bubbles. It uses the name of the
  program the text came from and, for a browser, the web page's address only to label the card; neither is kept.
  Unpinned cards stay in memory only; pinned cards are kept on the PC.
- **Listen for scripture** and **Follow my voice** hear the PC's sound (which in an online meeting includes other
  people's voices) and turn speech into words on the PC itself. Nothing is recorded or sent.

- **Prayer journey** keeps every prayer request from members' phones (the words, the first name if given, and whether it
  is still being prayed for or answered), encrypted to your Windows account. You can remove any request.
- **Care and attendance** keeps the first names people chose to type on their phones, with the date of each meeting,
  encrypted to your Windows account. It is for the leader only; you can remove any meeting or name, and meetings older
  than 12 months are removed by themselves. Tell people in your meeting that first names are kept for this.

On the phone, framedecks.com remembers in that browser only the first name the person typed, the prayer requests it
sent (so it can show whether each is still being prayed for or answered) and their Transpose and Capo choice.

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
  responsible (the controller; under India's Digital Personal Data Protection Act, 2023, the "Data Fiduciary"). We
  process this data for it (as its processor; the "Data Processor"), only to provide the Service. People on a church's
  member list, and people using members' phones, should ask that church first about their data; we help the church
  answer.

### Data processing terms for churches and organisations

These terms form an agreement between us and each organisation that uses a workspace (GDPR Article 28 and UK GDPR
Article 28; section 8 of India's Digital Personal Data Protection Act; and the equivalent rules elsewhere). The
organisation accepts them by using a workspace. For data a workspace holds, we:

- **process it only on the organisation's instructions:** what its owners and admins do in FrameDecks, these Terms and
  the Privacy Policy. We tell the organisation if we think an instruction breaks the law;
- **keep it confidential:** anyone who processes it for us is bound to keep it confidential;
- **protect it:** encryption in transit, access rules in the database so each workspace sees only its own data,
  encrypted backups and the other measures on the Security page;
- **use only the sub-processors listed under "Who processes it for us"**, under contracts that protect the data at
  least as well. We announce a new sub-processor on this page at least 14 days before using it; an organisation that
  objects may stop using the workspace and export or delete its data;
- **transfer it abroad only with safeguards:** the European Commission's Standard Contractual Clauses (and the UK
  Addendum), an adequacy decision, or what the law of the organisation's country allows;
- **help the organisation** answer requests from the people whose data it is, and with security, breach and data
  protection questions, including impact assessments;
- **tell the organisation's owners without undue delay**, and within 72 hours where we can, if a breach affects its
  data, with what we know and what we are doing about it;
- **delete it** when the workspace is deleted (backups within 30 days), and let owners export it before then;
- **show we follow these terms:** answer reasonable written questions, and give the information an organisation needs
  for its own records.

The organisation, in turn, is responsible for having a lawful basis or consent for the data it puts in (explicit
consent for information that shows religious belief where the law needs it), for parents' or guardians' permission for
children, for telling the people concerned, and for answering their requests.

## Who processes it for us

| Processor | What it does | Where |
| --- | --- | --- |
| **Supabase** | The database, sign-in and one-time links, members' phones | The project's chosen region; may involve the United States |
| **Cloudflare** | The website, downloads, the update service, email forwarding and the encrypted nightly database backups (R2) | Global network |
| **GitHub** | Runs the nightly backup: the database copy is made and encrypted on a GitHub Actions machine, then stored in Cloudflare R2 (nothing is kept at GitHub) | United States |
| **Resend** | Delivering the one-time email codes, new-device emails to owners and admins, and the email telling you when your workspace was opened with your email code (the computer's browser and system, and the time) | United States |

Where data leaves the UK or the European Economic Area, these processors use the European Commission's Standard
Contractual Clauses (and the UK Addendum) or an adequacy decision.

The program also contacts, only when you use them: **Crossway's ESV API** (api.esv.org) with your church's own key, to
fetch passages you ask for; and, to download the speech model the first time you use voice features,
downloads.framedecks.com or the model's own publisher. Only the request itself is sent.

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
- Your export also includes your Trusted Devices and your security events. Passkeys are kept by Supabase's sign-in
  service; ask privacy@framedecks.com if you want a list of them.

Depending on where you live, you may also have the right to object, to restrict processing, to nominate someone to use
your rights if you die or cannot act, and to complain to your data protection authority (see "Regional information").
Write to privacy@framedecks.com; we answer within one month, and sooner where the law says so.

**Complaints.** Write to grievance@framedecks.com (Shobin Mathews, also our Grievance Officer for users in India). We
acknowledge a complaint within 24 hours and aim to resolve it within 15 days. If you are not satisfied, you may
complain to your data protection authority: in the UK the Information Commissioner's Office, in the EU the authority
where you live, in India the Data Protection Board of India.

## Data breaches

If a breach of security affects personal data, we will contain it, find out what happened, and tell the people and
organisations affected without undue delay, with what happened, what it means for them and what they can do. Where the
law requires it, we also tell the regulator (for example the Information Commissioner's Office in the UK or the
relevant authority in Europe within 72 hours, or the Data Protection Board of India).

## Children

Workspace accounts are for people aged **18 and over**. A workspace may list young people as members (for example, a
youth group); the church or group is responsible for having permission from their parents or guardians where the law
requires it (for example under the UK GDPR, the EU GDPR or India's Digital Personal Data Protection Act), and we do not
track children or show them advertising.

The members' phone pages need no account. When the leader switches them on, a phone can send a first name, a raised
hand, quiz answers (shown on a leaderboard by first name) and prayer requests, and the leader's PC may keep first names
for Care and attendance. We do not knowingly collect personal information from children ourselves, and these features
are run by the church. A church that uses members' phones with children should tell parents first, leave **Ask for a
first name** and the **Bible quiz** off for groups of children, and avoid asking children for their names in prayer
requests or typed answers.

## Regional information

The same practices apply to everyone. These notes explain how they meet the law where you live.

- **Europe (EU and EEA):** the General Data Protection Regulation applies. Our legal bases are in "Why we may use it".
  You have the rights listed under "Your rights", including portability and the right to object, and you may complain
  to the data protection authority of the country where you live or work. Transfers outside the EEA use the European
  Commission's Standard Contractual Clauses or an adequacy decision.
- **United Kingdom:** the UK GDPR and the Data Protection Act 2018 apply in the same way. The regulator is the
  Information Commissioner's Office (ico.org.uk). Transfers use the UK Addendum to the Standard Contractual Clauses or
  UK adequacy regulations.
- **India:** the Digital Personal Data Protection Act, 2023 and its Rules apply. This notice is our notice to you; where
  we rely on your consent you may withdraw it as easily as you gave it (for example by deleting your data). You have the
  rights to information, correction, erasure, grievance redressal and to nominate someone. Contact our Grievance
  Officer (above); you may then approach the Data Protection Board of India. We report personal data breaches to the
  Board as the law requires. For a workspace's data, the church is the Data Fiduciary and we are its Data Processor.
- **United States:** we do not sell or share personal information (as those words are used in California and other
  state privacy laws), we do not use it for targeted advertising, and we do not use sensitive information to infer
  things about you. You may ask to know, correct or delete your information at privacy@framedecks.com, and we will not
  treat you differently for asking.
- **Middle East (including Saudi Arabia, the United Arab Emirates, Qatar, Bahrain and Kuwait):** you may ask to see,
  correct or delete your information, and to withdraw consent. Information that shows religious belief is treated as
  sensitive and handled only on the church's instructions with its consent. The Service stores data with Supabase and
  Cloudflare outside the region; we use them under contracts that protect it, as listed under "Who processes it for
  us".

## Changes

We will post changes here and, if they matter, tell you when you next open your workspace.
