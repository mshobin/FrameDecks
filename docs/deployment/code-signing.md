# Code signing: free, through SignPath Foundation (M-D1)

How FrameDecks gets a signed installer at no cost. Windows warns about unsigned programs ("Windows protected your
PC"), and some church IT policies block them. SignPath Foundation signs open-source projects for free, with its own
certificate, from builds made on GitHub.

**Who this is for:** the owner, who makes the repository public, applies and sets up SignPath once. After that,
every installer build from `main` and every version tag is signed by itself.

## What is already done in the repository

- **Licence files.** `legal/LICENSE` (Apache 2.0), `legal/NOTICE` and `legal/THIRD_PARTY_NOTICES.md` are in place. The installer
  carries all three in the program folder (`packaging/framedecks.spec`).
- **The Windows build is ready to sign** (`.github/workflows/build-windows.yml`). Once the secret below exists, it:
  1. sends the program folder to SignPath and gets back `FRAMEDECKS.exe` and both camera DLLs signed;
  2. builds the installer from the signed files;
  3. sends the installer to SignPath and gets it back signed;
  4. checks every signature with `Get-AuthenticodeSignature` and fails the build if one is missing;
  5. writes the SHA-256 checksum of the signed installer.

  Without the secret, these steps are skipped and the build is exactly as before.
- **The code signing policy** that SignPath asks projects to publish is in the README ("Code signing policy").

## What the owner does (once)

1. **Check the repository is safe to publish.** Making it public publishes its whole history.
   - No secrets have ever been committed: the companion's test enforces this; `.env*`, `kc-sync.json` and the key
     files are ignored.
   - Before switching, run GitHub's secret scanning: Settings → Code security → Secret scanning.
   - Also review the closed branches listed in `PROJECT_STATUS.md` ("Drift"). Delete any you do not want public.
2. **Make the repository public.** GitHub → Settings → General → Danger Zone → Change visibility.
3. **Apply to SignPath Foundation** at https://signpath.org (the open-source programme). Give:
   - the repository URL;
   - the licence (Apache 2.0);
   - the project's purpose: free presentation software for churches and Bible studies.

   They check the project and set up an organization and a project for it.
4. **In SignPath** (once approved):
   - Connect the GitHub repository as a trusted build system (GitHub.com, with the SignPath GitHub app).
   - Create a project with the slug `framedecks` (or note the slug you choose).
   - Create two artifact configurations with these exact slugs:
     - `program` (signs inside the zip of the program folder):
       ```xml
       <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
         <zip-file>
           <pe-file path="FRAMEDECKS.exe"><authenticode-sign/></pe-file>
           <pe-file-set>
             <include path="_internal/vcam/bin/framedecks_vcam*.dll" min-matches="2" max-matches="2"/>
             <for-each><authenticode-sign/></for-each>
           </pe-file-set>
         </zip-file>
       </artifact-configuration>
       ```
     - `installer`:
       ```xml
       <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
         <zip-file>
           <pe-file-set>
             <include path="FrameDecks v*.exe" min-matches="1" max-matches="1"/>
             <for-each><authenticode-sign/></for-each>
           </pe-file-set>
         </zip-file>
       </artifact-configuration>
       ```
   - Use the signing policy SignPath gives you. It is usually `test-signing` until the first approval, then
     `release-signing`.
   - Create an API token for a CI user that may submit to that policy.
5. **In GitHub** → Settings → Secrets and variables → Actions:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `SIGNPATH_API_TOKEN` | the CI user's API token |
   | Variable | `SIGNPATH_ORGANIZATION_ID` | the organization ID from SignPath |
   | Variable | `SIGNPATH_PROJECT_SLUG` | `framedecks` (or yours) |
   | Variable | `SIGNPATH_POLICY_SLUG` | `release-signing` (or `test-signing` first) |

6. **Run "Build Windows installer"** on `main` (Actions → Run workflow). Each release-signing request waits for an
   approver in SignPath (you); approve it there.
   - The run's log lists each file as `Valid`.
   - On a PC: right-click the installer → Properties → Digital Signatures.

## Until signing is approved (free)

- Publish the SHA-256 checksum next to each installer; the build already writes it.
- Submit each new installer to Microsoft as a false positive at
  https://www.microsoft.com/en-us/wdsi/filesubmission. SmartScreen learns from these submissions and from downloads.
- Keep one stable download place: the Releases page, from version tags.

## If the steps change

The SignPath action's inputs and the XML above follow SignPath's documentation as of October 2026. If SignPath shows
different slugs or settings, change the variables (or the two `artifact-configuration-slug` lines in the workflow), not
the build itself.
