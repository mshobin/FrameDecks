# Branching strategy

FrameDecks uses **trunk-based development**: one long-lived branch, `main`, and short-lived branches for each
change. The goal is that `main` is always something a church could install on Saturday night.

## Branches

| Branch | Purpose | Lifetime |
| --- | --- | --- |
| `main` | The default branch. Always builds, always passes the tests. Every push builds an installer (Actions → Build Windows installer). | Permanent |
| `feature/<short-name>` | A new feature, for example `feature/song-library`. | Days, not weeks |
| `fix/<short-name>` | A bug fix, for example `fix/remote-reconnect`. | Hours to days |
| `docs/<short-name>` | Documentation only, for example `docs/install-screenshots`. | Hours to days |
| `release/<version>` | Optional: final preparation of a version (notes, version bump) when `main` must keep moving. | Until the tag |
| `hotfix/<version>` | An urgent fix for the released version during a service week (see below). | Hours |

Branches created by automation follow the same rules: they are short-lived and merge into
`main` through a pull request.

Use lowercase and hyphens. Keep one change per branch.

## Protecting `main`

Recommended repository settings for `main`:

- Require a pull request before merging, with at least one approving review.
- Require the **Build Windows installer** workflow to pass (it runs the self-check and the tests).
- Do not allow force pushes or deletion.

## Pull requests

1. Create a branch from the latest `main`.
2. Commit in small, descriptive steps. Write commit messages that say what changed and why, in plain English
   ("Hold list redraws during a drag"). Release commits are prefixed with the version ("v6.6: …").
3. Open a pull request and fill in the template, including the **service-safety checklist**.
4. Run **Build Windows installer** on your branch (Actions → Run workflow) for any change that affects the installed
   app, and test the installer.
5. Address review comments with new commits; don't rewrite history others have reviewed.

## Merging

- **Squash and merge** for small, single-purpose branches, so `main` reads as one commit per change.
- **Merge commit** for larger branches whose individual commits are meaningful (for example a release branch).
- Delete the branch after merging.

## Hotfixes during a service week

When a released version has a problem that would affect next Sunday:

1. Branch `hotfix/<version>` from the release tag (for example from `v6.6`).
2. Make the smallest possible fix. No refactoring, no unrelated changes.
3. Bump the version (for example 6.6 → 6.7, since versions are major.minor), add release notes, and run the full
   [release process](release-process.md), including the manual service-safety test on a real PC.
4. Tag and publish, then merge the hotfix back into `main`.

Avoid merging risky changes to `main` late in the week. If a change can wait until Monday, let it wait.
