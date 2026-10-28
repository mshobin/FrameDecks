# FrameDecks documentation

Everything you need to plan, present and support a service with FrameDecks — organized by what you want to
do.

**New here?** Start with [Getting started](guide/getting-started.md). It takes about 15 minutes.

---

## Use FrameDecks

| Guide | What it covers |
| --- | --- |
| [Getting started](guide/getting-started.md) | Your first 15 minutes: the window, a first service, Go Live |
| [Installation](guide/installation.md) | Requirements, installing, updating, uninstalling, where your data lives |
| [Service planning](guide/service-planning.md) | Turning an order of service into Frames, templates, the Excel Meeting Workbook |
| [Presentations](guide/presentations.md) | Running the service live: Go Live, stepping, transitions, Annotate, Freeze, the Teleprompter, the command palette |
| [Frames](guide/frames.md) | Creating, organizing, duplicating and timing Frames |
| [Content](guide/content.md) | Every kind of Content and every setting in Content Settings |
| [Suggested questions](guide/ai.md) | Free AI on your PC (Ollama) drafts discussion questions from a Frame's passage |
| [Media](guide/media.md) | Images, video, PowerPoint, PDF, screen capture, the FrameRelay camera, OBS, projectors |
| [Remote control](guide/remote-control.md) | Setting up the phone remote, Simple and Advanced profiles, drawing from the phone |
| [Troubleshooting](guide/troubleshooting.md) | Problems by symptom, with causes and fixes |
| [FAQ](guide/faq.md) | Church-focused questions and honest answers |

## Serve on a team

| Guide | For |
| --- | --- |
| [Church operations hub](guide/roles/README.md) | How the roles work together, onboarding and training plans |
| [Worship leaders](guide/roles/worship-leaders.md) | Leaders who plan and lead the service |
| [Media team](guide/roles/media-team.md) | Cameras, projection, streaming, media preparation |
| [Volunteers](guide/roles/volunteers.md) | Anyone new to the team |
| [Service operators](guide/roles/service-operators.md) | The person at the PC during the service |
| [Remote operators](guide/roles/remote-operators.md) | The person with the phone remote |
| [Service-day checklist](guide/roles/service-day-checklist.md) | A printable checklist and emergency card |

## Understand and build it

| Guide | What it covers |
| --- | --- |
| [Architecture](development/architecture.md) | How the parts fit, with six diagrams |
| [Developer guide](development/developer-guide.md) | Running from source, project layout, adding features and tests |
| [Environment](deployment/environment-variables.md) | Runtime and development configuration, data locations, and secrets |
| [Deployment](deployment/deployment-guide.md) | Desktop release builds and hosted Vercel deployment |
| [Domains on Cloudflare](deployment/cloudflare-domains.md) | framedecks.com as the one address: DNS, redirects, TLS, cache, security and WAF |
| [Coding standards](development/coding-standards.md) | JavaScript, Python, CSS, and interface-writing conventions |
| [Development process](development/README.md) | Branching, releases, changelog standards, testing, code style |
| [Repository structure](development/repository-structure.md) | The folder layout and naming every repository follows |
| [Performance](development/performance.md) | How the program stays fast, with measurements |
| [Building the installer](development/building-the-installer.md) | Producing the Windows installer with GitHub Actions |
| [FrameDecks branding assets](reference/branding-assets.md) | Logo source, current asset mapping, generated variants, and intentionally retained graphics |
| [Design history](architecture/design-history.md) | The engineering log, one section per version |

## Project history

Finished plans, audits and assessments, kept for the record.

| Document | What it covers |
| --- | --- |
| [Engineering assessment](project/history/2026-10-22-engineering-assessment.md) | Current stack, architecture, security, performance, PWA/SaaS readiness, and technical debt |
| [SaaS migration roadmap](project/history/2026-10-22-saas-migration-roadmap.md) | Proposed hosted architecture and phased migration from the local-first desktop product |
| [FrameDecks repository audit](project/history/2026-10-22-repository-audit.md) | Repository baseline, security, performance, SaaS/PWA/offline readiness, and migration risks |
| [FrameDecks modernization plan](project/history/modernization.md) | Target architecture, authentication, pairing, synchronization, deployment, and rollback |
| [FrameDecks modernization status](project/history/modernization-status.md) | Resumable milestone status, blockers, and validation record |
| [FrameDecks branding audit](project/history/2026-10-22-branding-audit.md) | Remaining legacy-name references, their locations, and compatibility rationale |
| [Repository audit](project/history/2026-10-18-v6.6-repository-audit.md) | Scored review of the product and the repository |

## Reference

Detailed guides written alongside earlier versions. They remain accurate for the features they describe.

| Document | Contents |
| --- | --- |
| [User guide (v6.8)](guide/user-guide.md) | The original all-in-one user guide |
| [Feature documentation](reference/features.md) | How each feature is built and its limits |
| [Configuration guide](reference/configuration-guide.md) | Camera, app window, settings files, environment variables |
| [Meeting Workbook and branding](reference/meeting-workbook-and-branding.md) | The Excel workbook in detail; Meeting Name, logo and colours |
| [PowerPoint](reference/powerpoint.md) | What is technically possible with PowerPoint, and what the app does |

## Releases

- [Changelog](CHANGELOG.md) — every version at a glance
- [Release notes](releases/) — full notes for each version
- [Roadmap](ROADMAP.md) — where FrameDecks is going

## Conventions in these docs

- **Bold** names a button, menu or setting exactly as it appears in the app.
- Keys are written as **T**, **Esc**, **Shift + →**.
- "Meeting" is the app's word for a service or meeting; a **Frame** is one screen or moment of it; **Content** is
  what a Frame shows.
- Screenshots were taken with the app's built-in test camera.
