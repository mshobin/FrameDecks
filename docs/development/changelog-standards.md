# Changelog standards

FrameDecks keeps two records of every release:

| Record | Audience | Where |
| --- | --- | --- |
| **Changelog** | Everyone: a short, scannable list of changes across all versions. | [`CHANGELOG.md`](../CHANGELOG.md) |
| **Release notes** | Volunteers installing one version: what is new, how to use it, what to watch out for. Published as the GitHub Release text. | `docs/releases/vX.Y.md` |

## CHANGELOG.md

The changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

- Newest version first. An **Unreleased** section at the top collects changes merged since the last release.
- Each version is a heading `## [X.Y] - YYYY-MM-DD` followed by a link to its release notes.
- Group entries under these headings, in this order, and leave out empty ones:

| Heading | Use for |
| --- | --- |
| **Added** | New features. |
| **Changed** | Changes to existing behaviour. |
| **Deprecated** | Features that still work but will be removed. |
| **Removed** | Features that were removed. |
| **Fixed** | Bug fixes. |
| **Security** | Fixes for security problems. |

## Writing entries

- **Write for a volunteer, not a developer.** Describe what they will notice, using the words the app uses.
  - Good: "**Drag to reorder** questions and scriptures in a Frame's list."
  - Not: "Added HTML5 DnD handlers to frame-lists.js."
- **Start with the feature name in bold** when it is a feature people will look for.
- **Say where to find it** when it is new: "**Teleprompter** (Program → Teleprompter)".
- **One line per change** in the changelog; the release notes can explain more.
- **Be honest about limits.** If something needs PowerPoint installed, or works only on Windows, say so.
- **Never include personal data** (church names, member names) in examples.

## Release notes (`docs/releases/vX.Y.md`)

Use this shape:

```markdown
## FrameDecks vX.Y

Download **FrameDecks vX.Y.exe** below and run it. It installs over earlier versions and keeps all your data.
(Any action needed before installing, for example closing Zoom.)

### <First headline feature>
- What it does, in one or two short bullets.
- Where to find it.

### <Next feature or group of changes>
- …

### Removed
- …

### Known limitations
- …
```

The file name must be exactly `docs/releases/vX.Y.md`; the release workflow publishes it as the release text.
