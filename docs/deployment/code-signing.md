# Code signing (7.0: closed source)

Windows warns about unsigned programs ("Windows protected your PC"), and some church IT policies block them. Until
6.14 the plan was SignPath Foundation's free programme. **That programme is for open-source projects only, so it does
not apply from 7.0 on** (FrameDecks is now proprietary, from a private repository).

## Options now

| Option | Cost (October 2026) | Notes |
| --- | --- | --- |
| **Azure Trusted Signing** (recommended) | about USD 10 a month | Microsoft-managed certificate, no hardware token, builds reputation with SmartScreen quickly. Needs identity validation of the publisher (an individual in some countries, otherwise a registered business). Signs from GitHub Actions with Microsoft's `azure/trusted-signing-action`. |
| SignPath (commercial plan) | paid, quoted per project | The workflow's SignPath steps below keep working unchanged with a paid plan. |
| OV or EV certificate from a certificate authority | about USD 200–500 a year | Must be kept on a hardware token or cloud HSM; signing from CI needs the authority's cloud signing service. |

Whichever is chosen:
1. Sign `FRAMEDECKS.exe`, both camera DLLs and the installer, as the steps below describe.
2. Set the repository variable `RELEASE_SIGNED` to `true` (`release-pipeline.md`). The release manifest then says
   `"signed": true`, and the program's updater refuses any installer whose Authenticode signature is not valid and
   issued to the publisher.
3. Update the README's "Code signing policy".

The rest of this page describes the SignPath set-up already wired into the workflow; with Azure Trusted Signing, the
same three signing points get the Trusted Signing action instead (a small workflow change, in 7.1).

## What is already done in the repository

- **Licence files.** `LICENSE` (the FrameDecks proprietary licence), `NOTICE` and `docs/legal/THIRD_PARTY_NOTICES.md`
  are in place. The installer carries all three in the program folder (`packaging/framedecks.spec`).
- **The Windows build is ready to sign** (`.github/workflows/build-windows.yml`). Once the secret below exists, it:
  1. sends the program folder to SignPath and gets back `FRAMEDECKS.exe` and both camera DLLs signed;
  2. builds the installer from the signed files;
  3. sends the installer to SignPath and gets it back signed;
  4. checks every signature with `Get-AuthenticodeSignature` and fails the build if one is missing;
  5. writes the SHA-256 checksum of the signed installer.

  Without the secret, these steps are skipped and the build is exactly as before.

## What the owner does (once)

1. **Choose a plan** with SignPath (commercial) and give them the private repository, the publisher (Shobin Mathews)
   and the product: free presentation software for churches and Bible studies.
2. Install the SignPath GitHub app on the repository (it stays private).
3. Keep the publisher name identical everywhere: the certificate subject, the installer's `AppPublisher` and the
   updater's signature check (`src/updater.py`).
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

## Until installers are signed

- Publish the SHA-256 checksum next to each installer; the build writes it and the download page shows it.
- Submit each new installer to Microsoft as a false positive at
  https://www.microsoft.com/en-us/wdsi/filesubmission. SmartScreen learns from these submissions and from downloads.
- Keep one stable download place: framedecks.com/download (`release-pipeline.md`).

## If the steps change

The SignPath action's inputs and the XML above follow SignPath's documentation as of October 2026. If SignPath shows
different slugs or settings, change the variables (or the two `artifact-configuration-slug` lines in the workflow), not
the build itself.
