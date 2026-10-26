# FRAMEDECKS production audit, 26 October 2026

> **Status (26 October, evening):** roadmap steps 1 and 2 are built on `main` for **6.11.1**:
> - H3: build inputs pinned, Dependabot, a separate release job;
> - M1: the anti-framing headers;
> - M3: the cross-site guard;
> - M8: swallowed errors logged;
> - M10: migration `0009`, which the owner runs;
> - H1: plan-file recovery and the sync mass-delete guard.
>
> Everything else below is still open.

This is a read-only review. **No code, UI, settings, data formats or behaviour were changed.** Every recommendation below
is a proposal that needs the owner's approval.

**What was audited:** `main` at `8072493`:
- the desktop program (`server.py`, `desktop_app.py`, `desktop_win.py`, `cloud_sync.py`, `cloud_remote.py`, `vcam/`,
  `app/`);
- the website (`hosted/`);
- the database (`hosted/supabase/migrations/0001`–`0008`);
- the build and release pipeline (`.github/workflows/`, `packaging/`);
- the Stream Deck plugin, the dependencies and the docs.

**How:**
- read the code and the SQL;
- scanned the files and the full git history for secrets;
- ran `npm audit`;
- measured the website and the program's local server with Playwright and Chrome's performance metrics;
- ran the existing test suites.

**Not covered:** the live database and the website could not be reached from the audit environment. Nothing was tested
on Windows (WebView2, the camera driver, Credential Manager). No dynamic penetration test was run against the live site.

---

## 1. Executive summary

FRAMEDECKS is in good security shape for a small product:
- **Local server:** it listens on this PC only, checks the Host and Origin headers, guards file paths, and limits each
  upload to 8 MB. The phone remote needs a 6-digit PIN and locks out repeated wrong guesses.
- **Database:** row-level security is on every table. Every privileged function pins its search path and validates
  input. Anonymous access is limited to PC linking, which is capped and expires.
- **Secrets:** none appear in the files or in git history.
- **Dependencies:** both npm projects report no known vulnerabilities.

The main risks are about **reliability and release trust**, not about breaking in:
1. **A damaged plan file can wipe the shared workspace.** If the PC's plan file cannot be read, the program quietly
   starts from defaults. Sync then sends a delete for every Frame to the workspace and to every other linked PC (H1).
2. **No trusted release channel.** The installer is not code-signed and there is no update check (H2).
3. **The build trusts code by mutable tags.** The camera driver's source and two third-party build actions are
   fetched by version tag, not by exact commit. The driver is installed system-wide with administrator rights (H3).
4. **Never tested end to end.** The cloud features have only been tested against stand-ins, never live (M13).

**Recommendation:** **Conditional GO** for the current pilot (the owner's own fellowship, supervised).
**NO-GO** for a broad public release until H1–H3 are fixed and live tests A–G have passed.

## 2–6. Scores

| Area | Score | Basis |
|---|---|---|
| Security | **76 / 100** | Strong local and database controls. Gaps: website headers, plaintext phone remote, release signing, supply-chain pinning |
| Production readiness | **64 / 100** | Unsigned installer, no update path, data-loss path through sync, never tested end to end live |
| Maintainability | **66 / 100** | Good tests (131 Python, 4 desktop JS, 109 website) and docs. Large single files, many broad `except Exception` |
| Performance | **82 / 100** | Website idle cost fixed today. Program server idles at about 0.1% CPU and 62 MB. Minor items remain |
| Technical debt (higher = more debt) | **40 / 100** | Moderate: monolith files, duplicate OpenCV packages, upgrade-only legacy code, AI-session artifacts |

## 7. Critical findings

**None confirmed.** No remotely exploitable flaw and no secret exposure was found.

## 8. High-priority findings

### H1: A damaged plan file resets to defaults and sync deletes every Frame in the workspace

- **Severity:** High
- **Files:**
  - `server.py` `load_state()` (lines 158–166);
  - `cloud_sync.py` `Engine._push()` (lines 239–255).
- **Risk:**
  - `load_state()` turns any read or parse error into `{"rev": 0}`, with no message.
  - The next save overwrites the damaged file.
  - On a linked PC, `_push()` sends `deleted: True` for every record this PC knows about but no longer has locally.
  - The member list has a guard for this (`_rebuild_members`). The plan has none.
- **User impact:** after a power cut, a full disk, antivirus interference or a bad file edit, the service plan
  disappears on that PC and on every PC in the workspace. Recovery is one Frame at a time from History (14 days), or
  from the local daily backups, which users do not know about.
- **Recommendation:**
  1. On a parse error, rename the file to `kc-…json.corrupt-<time>`.
  2. Load the newest daily backup, log the event and show the existing error toast.
  3. In sync, add a mass-delete guard: hold the push and ask for confirmation in the log or diagnostics when one cycle
     would delete more than a threshold, for example more than 50% of known Frames, or when the plan has none left.
- **Effort:** 1–2 days, with tests.
- **Regression risk:** Low.
- **Unchanged UI, UX and workflows:** yes. Normal use never triggers the guard.
- **Category:** REVIEW REQUIRED (sync behaviour in an edge case).

### H2: Unsigned installer and no update channel

- **Severity:** High
- **Files:** `.github/workflows/build-windows.yml` (signing is off until a secret exists), `packaging/installer.iss`.
- **Risk:**
  - Windows SmartScreen warns on every install.
  - A tampered download cannot be detected: the `.sha256` file sits on the same page as the installer.
  - Users never learn about fixes. 6.11 already needs a fix release (website "Forbidden" error, Teleprompter freeze).
- **User impact:** trust warnings at install, and leaders keep running old versions with known bugs.
- **Recommendation:**
  1. Finish SignPath Foundation signing (planned as E1–E3).
  2. Add a notify-only update check that reads the GitHub Releases API. It shows "6.x is available" and never
     downloads by itself.
- **Effort:** signing: owner steps plus about half a day; update notice: 1 day.
- **Regression risk:** Low.
- **Unchanged UI, UX and workflows:** signing, yes. The update notice adds one new notice, so it needs approval.
- **Category:** SAFE (signing) and REVIEW REQUIRED (update notice).

### H3: The build trusts code by mutable tags

- **Severity:** High (supply chain)
- **Files:** `.github/workflows/build-windows.yml`, which:
  - clones softcam with `git clone --branch v1.8.1`;
  - uses `softprops/action-gh-release@v2`, `signpath/github-action-submit-signing-request@v1` and the `actions/*@v4/v5`
    actions;
  - runs the whole job with `permissions: contents: write`.
- **Risk:**
  - The softcam source is compiled into a DLL that the installer registers system-wide with administrator rights.
  - If a tag is moved upstream, the next build silently ships different code.
  - Third-party actions on mutable tags run with write access to the repository and its releases.
- **User impact:** a compromised upstream could ship malicious code inside a signed FRAMEDECKS installer.
- **Recommendation:**
  1. Pin softcam to a commit SHA and check it (`git rev-parse HEAD`).
  2. Pin every action to a full commit SHA, with the version in a comment.
  3. Give `contents: write` only to the release job, or only for tag runs.
  4. Enable Dependabot for `github-actions`.
- **Effort:** half a day.
- **Regression risk:** None to Low.
- **Unchanged UI, UX and workflows:** yes.
- **Category:** SAFE.

## 9. Medium-priority findings

| # | Finding | Files | Risk and impact | Recommendation | Effort | Regr. | Category |
|---|---|---|---|---|---|---|---|
| M1 | Missing website security headers: no Content-Security-Policy, no `frame-ancestors`/`X-Frame-Options`, no Permissions-Policy. Sign-in tokens live in `localStorage` (supabase-js default). | `hosted/public/_headers` | Live-page buttons (Go live, Blackout) could be clickjacked inside another site's frame. Any future XSS could read sign-in tokens. | Add `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` (SAFE). Add a full CSP (`default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'`, plus a hash for the one inline script) after testing. | 0.5 d | Low (frame), Medium (CSP) | SAFE / REVIEW |
| M2 | The phone remote uses plain HTTP on the local network, with 30-day sessions | `server.py` (`SESSION_DAYS = 30`, the remote cookie) | On shared church Wi-Fi, someone listening could copy the PIN or the session cookie and control the screen. | Shorter sessions (for example 12 h), "sign out all phones" when the PIN changes, and an optional new PIN for each meeting. HTTPS is impractical on a LAN, so record this as an accepted risk. | 1 d | Low | REVIEW |
| M3 | Local GET endpoints with side effects can be triggered by other websites | `server.py` GET `/api/remote-cloud/next` (removes queued commands); state-changing GETs in general | A page open in the PC's browser could use `<img src="http://127.0.0.1:8750/api/remote-cloud/next">` to swallow commands sent from the website. It cannot read any data. | Reject requests with `Sec-Fetch-Site: cross-site`, or require a custom header such as `X-FrameDecks: 1` on local API calls (the program window adds it). | 0.5 d | Low | SAFE |
| M4 | Anyone can fill the PC-linking queue | `0003_sync.sql` `computer_link_start` (cap 1000, 10 min) | An anonymous script can create 1000 pending links and block real linking for 10 minutes. | Lower the TTL; add a per-key-hash limit; add a Supabase rate limit or an edge rule. A new numbered migration. | 0.5 d | Low | REVIEW |
| M5 | Database backups: unauthenticated encryption, and exposure if the repository becomes public | `tools/db_backup.sh` (`aes-256-cbc -pbkdf2`, no MAC), `db-backup.yml` artifacts (30 days) | CBC without a MAC cannot detect tampering. If E1 makes the repository public, any GitHub user could download the encrypted dumps, so their safety rests on the passphrase alone. | Run backups from a private repository or upload them to private storage. Use `age`, or GPG with a signature, or add an HMAC. Document how strong the passphrase must be. | 0.5–1 d | Low | REVIEW |
| M6 | Member personal data is unencrypted on the PC | `kc-members-private.json`, `kc-remote-sessions.json` (data folder) | Birth dates, phone numbers and email addresses can be read by anything running as that Windows user, and by backup or sync tools. | Encrypt at rest with Windows DPAPI (CryptProtectData), and keep reading the plain file for compatibility. This is a file-format change. | 1–2 d | Medium | HIGH RISK |
| M7 | Two OpenCV packages are installed | `packaging/constraints.txt` pins both `opencv-python==5.0.0.93` and `opencv-python-headless==4.14.0.94`, while `requirements-desktop.txt` asks for the headless `<5` | Both install the same `cv2` module, so which one loads is undefined. The self-check loads **OpenCV 5.0**, against the stated `<5`. The installer is larger, and camera or blur behaviour can change between builds. | Find which package pulls `opencv-python` (probably `windows-capture`), keep exactly one OpenCV, and make the version check fail the build on a mismatch. | 0.5 d plus a camera test | Medium | REVIEW |
| M8 | Errors are swallowed | About 110 `except Exception` blocks (35 in `desktop_app.py`, 19 in `server.py`, 12 each in `vcam/screen.py` and `vcam/powerpoint.py`), many with `pass` | Failures like the Teleprompter freeze leave nothing in the log, which makes support slow. | Log every swallowed exception to `kc-app-log.txt` (rate-limited) without changing control flow. | 1 d | None | SAFE |
| M9 | Other window operations may freeze like the Teleprompter did | `desktop_app.py` `win()`: `minimize`, `toggle-max`, `hide` and `destroy` call pywebview from the web-server thread | The same freeze is possible for these operations. Only `on-top` was changed today, and that change is untested on Windows. | After the owner confirms the `on-top` fix, apply the same non-blocking pattern (ShowWindowAsync, or work handed to the UI thread). | 1 d | Medium | REVIEW |
| M10 | Every sync read also writes to the database | `0003_sync.sql` `request_computer()` updates `last_seen_at` on each call | Each poll from a PC writes one row, which adds write-ahead-log and I/O load on the free tier. | Update only when `last_seen_at < now() - 1 minute`. A new numbered migration. | 0.25 d | None | SAFE |
| M11 | Live end-to-end tests have never run | `docs/qa/live-test-guide.md` A–G | Sync, phone control, editing, history, members and the website Meeting Form are proven only against stand-ins. | Run tests A–G before any wider release. | Owner time | n/a | n/a |
| M12 | Off-PC backup of the plan depends on sync | `server.py` `backup_now`/`daily_backup` (10 copies, same disk) | Disk failure on an unlinked PC loses everything. | Offer "Export backup" to a chosen folder, or recommend linking. Documentation first. | Docs | None | SAFE (docs) |

## 10. Low-priority findings

| # | Finding | Files | Recommendation | Regr. | Category |
|---|---|---|---|---|---|
| L1 | The service-worker cache keeps old build files forever (fixed cache name) | `hosted/public/sw.js` | Name the cache after the build ID, or trim entries not in the current build. | Low | SAFE |
| L2 | State writes skip fsync (atomic `os.replace` without flush) | `server.py` `_write_state_file` | Add `flush` and `os.fsync` before the replace, or rely on H1's recovery. | None | SAFE |
| L3 | Python dependencies are not hash-pinned | `packaging/constraints.txt` | `pip install --require-hashes` with a hashed lock file. | Low | SAFE |
| L4 | Upgrade-only legacy code (old names, folders and firewall rules) | `legacy.py`, `installer.iss`, `server.py` `OLD_FIREWALL_RULES` | Keep it for two more releases, then remove it with a release note. | Low | REVIEW |
| L5 | Zip-era helper scripts in the repository root | `Allow iPad Remote - run once.bat`, `Start FRAMEDECKS*.bat/.command`, `Undo iPad Remote permission.bat` | Confirm they are still needed; otherwise move them to `tools/legacy/`. | Low | REVIEW |
| L6 | Very large single files | `server.py` (2,552 lines), `app/js/workspace.js`, `app/js` (33k lines) | Split by area (HTTP routes, camera, remote, sync glue) in a separate refactor release with no behaviour change. | Medium | HIGH RISK (refactor) |
| L7 | The phone and overlay pages announce their presence every 4 s | `app/js/store.js` `presence` | Fine at small scale; could become 10 s. | Low | REVIEW |
| L8 | GitHub warns that Node 20 actions are deprecated | build logs | Update the action versions (with H3 pinning). | Low | SAFE |
| L9 | The website's Live page polls every 2 s while visible | `hosted/src/components/live-panel.tsx` | By design (it pauses when hidden). Could slow to 5 s when nothing changed. | Low | REVIEW |

## 11. Safe fixes that can be applied immediately

These involve no expected change to the UI or to behaviour:
1. **H3:** pin softcam and all actions by commit SHA; give write permission only to the release step; enable Dependabot.
2. **M1:** add `X-Frame-Options: DENY` and `frame-ancestors 'none'` to `_headers`.
3. **M3:** reject cross-site requests (`Sec-Fetch-Site`) on local `/api/*` calls.
4. **M8:** log every swallowed exception.
5. **M10:** throttle the `last_seen_at` write (new migration `0009`).
6. **L1, L2, L3, L8.**

## 12. Fixes requiring review (behaviour in edge cases, needs testing)

- **H1:** recover the plan file and add the sync mass-delete guard. **This is the top priority.**
- **H2:** the update notice. Signing itself is SAFE.
- **M1:** a full Content-Security-Policy, tested against sign-in with Google, Microsoft and email.
- **M2:** remote session length and PIN rotation.
- **M4:** limits on the linking queue.
- **M5:** where backups go and how they are encrypted.
- **M7:** keep one OpenCV package; retest the camera and blur.
- **M9:** non-blocking window operations.
- **L4, L5, L7, L9.**

## 13. High-risk changes (change formats or structure; plan them for a dedicated release)

- **M6:** encrypting local member data (file-format change; needs a migration path and rollback).
- **L6:** splitting `server.py` and the large front-end files (refactor; needs a full regression pass).

## 14. AI artifact findings

| Finding | Where | Shipped to users? | Recommendation |
|---|---|---|---|
| AI-assistant guide and handoff files | `CLAUDE.md`, `.ai/NEXT_SESSION.md`, `PROJECT_STATUS.md`/`PROJECT_ROADMAP.md` (continuity) | No (not in the installer or the website build) | Keep them for development. Before making the repository public (E1), decide whether to keep them or move them to a private repository. |
| Commit trailers naming an AI model and linking to private sessions | 128 commits carry `Co-Authored-By: Claude …` and `Claude-Session: https://claude.ai/code/…` | Only in git history | History cannot be rewritten (owner's rule). Accept it, or publish a squashed public mirror. |
| Automation branch names | `claude/…` branches; `docs/development/branching.md` | No | Delete merged branches. |
| AI reference in a code docstring | `sync_entities.py` line 4 ("branch claude/saas-phase2") | Inside the Python bundle (a comment) | Reword the docstring to "Phase 2 branch" (SAFE, comment only). |
| AI design-tool metadata | `docs/design/framedecks-redesign.html` (`<meta name="claude:viewport-fit-sides">`) | No | Remove the tag (SAFE, docs only). |
| Mentions in architecture docs | `docs/architecture-review.md`, `docs/migration-plan.md`, `docs/post-migration-report.md`, `docs/FRAMEDECKS_MODERNIZATION_STATUS.md`, `docs/project/*audit*.md`, `docs/qa/2026-10-25-logo-visual-qa.md`, `docs/architecture/{metadata-sync,remote-control,meeting-form}.md` | No | Optional wording clean-up before going public. |
| Embedded prompts, placeholder text, mock code in production paths | none found | n/a | The Supabase stand-in (`hosted/tests/pglite-supabase.mjs`) and the AI stand-in are test-only. No TODO, FIXME or lorem ipsum in source. |
| Third-party verification file | `hosted/public/google6253c73d49e9f98f.html` | Website | Expected (Google Search Console). Keep. |

## 15. Dependency findings

| Component | Status | Notes |
|---|---|---|
| Website npm (production and all dependencies) | **0 known vulnerabilities** | Next.js 16, @supabase/supabase-js, lucide-react |
| Stream Deck npm | **0 known vulnerabilities** | |
| SheetJS (vendored, `app/vendor/xlsx.full.min.js`) | **0.20.3**, which includes the fixes for CVE-2023-30533 and CVE-2024-22363 | Not on npm (CDN distribution). Track releases by hand. It goes away with the 6.12 Excel removal (W3). |
| OpenCV | **Duplicate packages** (see M7) | Undefined which one loads; OpenCV 5.0 is used in practice |
| pywebview 6.2.1, pyinstaller 6.22.3, python-pptx 1.0.2, pypdfium2, windows-capture 2.0.1 | Pinned exactly; no hashes | L3 |
| softcam v1.8.1 (MIT, compiled in CI) | Fetched by tag | H3 |
| GitHub Actions | Tag-pinned, Node 20 deprecation warnings | H3 and L8 |
| Licences | Apache-2.0 project; `THIRD_PARTY_NOTICES.md` lists the vendored code | Keep a row for every new dependency |

## 16. Final release-readiness assessment

The product works and its security fundamentals are sound. Three things stand between it and a confident wide release:
1. **Data safety:** H1 is a single-event, workspace-wide data-loss path.
2. **Release trust:** H2 (signing and update awareness) and H3 (pinned build inputs).
3. **Evidence:** the cloud features have never run end to end live (M11).

None of these needs a UI or workflow change except the optional update notice.

## 17. GO / NO-GO

- **Pilot (owner's own fellowship, supervised): CONDITIONAL GO.**
  1. Run live tests A–G.
  2. Keep the daily backups.
  3. Ship the pending 6.11 fixes as a point release.
- **Broad or public release: NO-GO** until H1, H2 (signing) and H3 are done and the live tests pass.

## 18. Prioritized remediation roadmap

| Order | When | Items | Category |
|---|---|---|---|
| 1 | This week | H3 (pin build inputs), M1-frame (anti-framing header), M3 (cross-site guard), M8 (log swallowed errors), M10 (throttle `last_seen_at`) | SAFE |
| 2 | This week | H1 (plan recovery and sync mass-delete guard), with tests; release as 6.11.1 together with today's fixes | REVIEW |
| 3 | Next 2 weeks | M11 live tests A–G; M9 (non-blocking window operations, after the owner confirms the Teleprompter fix); M7 (single OpenCV) | REVIEW |
| 4 | Before going public | H2 signing (SignPath) and update notice; M5 (backup location and crypto); AI-artifact clean-up in docs; M1 full CSP | SAFE / REVIEW |
| 5 | Next minor release | M2 (remote sessions), M4 (link queue), M12 (export backup), L1–L3, L8 | SAFE / REVIEW |
| 6 | Dedicated release | M6 (encrypt member data), L6 (split the monolith files), L4 (retire legacy code) | HIGH RISK |

---

## Re-audit after 6.11.1 (26 October, `main` at `2fd852f`)

**Method:**
- re-checked every fixed finding in the code;
- re-ran every suite: Python 141 OK, desktop JS 4/4, packaging 6.11.1, website and database 110/110;
- ran `npm audit` again on both npm projects;
- re-ran the secret scan;
- confirmed the CI runs on `2fd852f` (installer, website and Stream Deck builds, and the first Dependabot run) are
  green.

### Verified fixed

| Finding | Evidence |
|---|---|
| H1 plan loss through sync | `server.load_state` recovery and `PLAN_RECOVERY`; `Service.adopt_workspace`; `MASS_DELETE_FRAMES` guard; 7 new tests |
| H3 build supply chain | 0 unpinned `uses:`; softcam commit checked in CI and `build.bat`; `contents: read` by default, `write` only in the `release` job; Dependabot active |
| M1 framing | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Permissions-Policy in `_headers` |
| M3 cross-site calls | `cross_site_api` on GET and POST; `tests/test_local_guard.py` |
| M8 swallowed errors | 0 silent `except Exception: pass` left (the one in `errlog.py` is the logger's own safety net) |
| M10 write per poll | `0009_seen_throttle.sql` with an undo script and tests (**not yet run in the live database**) |

### New finding

**N1: the Stream Deck plugin depends on a vulnerable zod**
- **Severity:** Medium (High upstream, but low exposure here)
- **File:** `streamdeck/package-lock.json`. The chain is `@elgato/streamdeck@3.0.3`, which depends on
  `@elgato/utils@0.6.1`, which depends on `zod@3.25.76`.
- **Advisory:** GHSA-mrhx-c7xc-m3w5, memory exhaustion when validating oversized collections.
- **Exposure:** the plugin only talks to the Stream Deck app on the same PC, so practical exposure is low.
- **Correction:** the first audit wrongly reported 0 vulnerabilities here; its output was read truncated.
- **Recommendation:** update when Elgato ships `@elgato/utils` on zod ≥ 4.6.6. `npm audit fix --force` would
  downgrade to 1.4.1, a breaking change, so do not run it. Until then, accept the risk and record it here.
- **Category:** REVIEW REQUIRED.

### Still open

- **H2:** unsigned installer and no update notice. 6.11.1 is built but **not yet published**.
- **M2, M4, M5, M6, M7, M9, M11, M12** and the Low items, as listed above.
- Not yet verified on Windows: the H1 recovery, the Teleprompter fix, the website "Forbidden" fix, and the FRAMECAST
  camera.

### Scores

| Area | Before | Now | Why it moved |
|---|---|---|---|
| Security | 76 | **82** | H3, M1 and M3 fixed. N1 found. M2, M4, M5 and the full CSP are still open |
| Production readiness | 64 | **72** | H1 fixed and errors are logged. Still unsigned, no update notice, live tests not run, 6.11.1 unpublished, `0009` not run |
| Maintainability | 66 | **68** | Central error logging and 17 more tests. The monolith files and broad exception handlers remain |
| Performance | 82 | **84** | M10, plus the idle website. M7 (two OpenCV packages) remains |
| Technical debt (higher = more debt) | 40 | **37** | Silent failures removed and the pipeline pinned. N1, M7 and L4–L6 remain |

### Release recommendation

- **Pilot (supervised): GO**, once 6.11.1 is published and tested on Windows.
- **Public release: still NO-GO** until H2 (signing) is done and live tests A–G pass.
