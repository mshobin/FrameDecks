# Contributing to FrameDecks

Thank you for helping. FrameDecks is used by volunteers on Sunday mornings and on weeknight Bible studies, often
by people who are not technical and who have no time to troubleshoot while a meeting is running. Every contribution,
whether a bug report, a test on a real church PC, a clearer sentence in a guide or a line of code, makes those
services calmer.

> **Simple. Reliable. Worship Ready.** Contributions are judged first by whether they keep a live service safe.

---

## Ways to help

| Way to help | What it involves |
| --- | --- |
| **Report a bug** | Open an issue with the **Bug report** form. Include the version (Settings → About) and, if you can, Settings → Diagnostics → **Copy diagnostics**. |
| **Report a problem during a service** | Use the **Service-day problem** form. Tell us what went wrong and how you recovered. These are triaged first. |
| **Test on a real setup** | Install a build from the Actions tab on the PC your church actually uses and run the [service-safety test script](../docs/development/testing.md#manual-service-safety-test). Real webcams, projectors, PowerPoint versions and Wi-Fi networks find problems a development machine cannot. |
| **Improve the documentation** | Fix unclear steps, add screenshots, answer a question in the [FAQ](../docs/guide/faq.md). Plain English for volunteers is a feature. |
| **Suggest a feature** | Use the **Feature request** form and describe the ministry situation first: who is in the room, what they are trying to do, and what gets in the way. |
| **Translations** | Not yet possible: the interface text is not yet separated from the code. Localization is on the [roadmap](../docs/ROADMAP.md). |
| **Write code** | Read the [developer guide](../docs/development/developer-guide.md), pick an issue, and open a pull request. |

Never post a phone-remote PIN, member names, phone numbers, birthdays or an ESV API key in an issue, a pull request
or a screenshot.

---

## Ground rules

1. **Reliability before features.** A change must never put a live service at risk. If a change touches Go Live,
   stepping, Hide all, Blackout, Freeze, the phone remote or the FrameDecks camera, say so in the pull request
   and describe how you tested it.
2. **Volunteers first.** Use the words the app uses (**Frame**, **Content**, **Go Live**, **Speaker View**), plain
   English, and no jargon. If a setting needs a paragraph to explain, look for a simpler design.
3. **Offline first.** Nothing may require an account, a subscription or an internet connection to run a meeting.
   Online features (the ESV lookup, updates, a workspace, Sync, Members' phones) are optional and only used when
   switched on.
4. **Private by default.** Member data stays on the PC unless the PC is linked to a workspace, where only its owners and
   admins can see it. It is never sent to the phone remote or the overlay pages. Do not add telemetry.
5. **No surprise redesigns.** The visual design (colours, type, components, Book + Candle branding) is deliberate.
   Discuss visual changes in an issue before writing them.
6. **Keep the installer working.** `app/`, `src/vcam/`, `src/server.py`, `src/desktop_app.py` and `packaging/` are bundled by
   PyInstaller and Inno Setup. Moving or renaming files there needs matching changes in `packaging/`.

---

## Getting set up

The short version (the full guide is [docs/development/developer-guide.md](../docs/development/developer-guide.md)):

```bash
git clone https://github.com/mshobin/FRAMEDECKS.git
cd FrameDecks
python src/server.py                 # opens the Studio at the address it prints (it carries this PC's local key; KC_LOCAL_TOKEN=off to turn the key off)
node tests/run.js                # automated tests (Node.js, no packages to install)
python packaging/check.py        # self-check: the program starts and serves its pages
```

The program itself needs only Python 3 and its standard library. The FrameDecks camera, background blur,
screen capture and the desktop window need the packages in `packaging/requirements-desktop.txt` and Windows.

---

## Branches and pull requests

- The default branch is **`main`**. Work on a short-lived branch named for the change: `feature/speaker-clock`,
  `fix/remote-reconnect`, `docs/install-screenshots`. See [docs/development/branching.md](../docs/development/branching.md).
- Keep each pull request to one change. Small pull requests are reviewed faster and are safer to release.
- Fill in the pull request template, including the **service-safety checklist**.
- The **Build Windows installer** workflow runs on every push to `main`, on version tags, and on demand (Actions →
  Build Windows installer → **Run workflow**, choosing your branch). A green run produces an installer you can test.

### Definition of done

A change is ready to merge when:

- [ ] `node tests/run.js` passes, and new behaviour in `app/js/store.js` or the Meeting Workbook has a test.
- [ ] `python packaging/check.py` passes. If you added a page or script the app must serve, add it to the list in
      `packaging/check.py`.
- [ ] You ran the parts of the [service-safety test script](../docs/development/testing.md#manual-service-safety-test)
      your change touches.
- [ ] UI changes include before/after screenshots in the pull request.
- [ ] User-facing changes are described in the user documentation (`docs/`), in the release notes for the next
      version (`docs/releases/vX.Y.md`) and in [CHANGELOG.md](../docs/CHANGELOG.md) under **Unreleased**.
- [ ] Architectural changes add a note to the current version's section of
      [docs/architecture/design-history.md](../docs/architecture/design-history.md).

---

## Licence

FrameDecks is open-source software under the Apache License 2.0 ([LICENSE](../LICENSE)). A contribution you send is
licensed under the same licence (its section 5). The names FrameDecks and FrameDecks vCam and the emblem stay
trademarks of Shobin Mathews. A new dependency or vendored file needs a licence that is compatible with Apache 2.0
(no GPL or AGPL; LGPL only as a separate, replaceable library) and a row in
[THIRD_PARTY_NOTICES.md](../docs/legal/THIRD_PARTY_NOTICES.md) in the same change.

---

## Code of conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Treat others the way you would
want to be treated at church on Sunday.
