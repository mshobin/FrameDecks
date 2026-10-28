# Roadmap

> **Simple. Reliable. Worship Ready.**
> **Connect. Present. Worship.**

This roadmap describes where FrameDecks is heading. It is a statement of direction, **not a promise of dates or
features**. Priorities change when churches tell us what gets in their way on a Sunday. To suggest something, open a
**Feature request** issue and describe the ministry situation.

---

## Principles

Every item below is weighed against these principles, in this order:

1. **Reliability over features.** Nothing ships that could interrupt a live service. A feature that works 99% of the
   time is not ready.
2. **Volunteer-friendly.** A new volunteer should run a meeting after one short walkthrough. Defaults must be right;
   settings are for exceptions.
3. **Local-first presenting.** Live presentation, media playback, camera output, and service-day operation must not
   depend on the internet. Optional cloud metadata sync must resume after reconnection.
4. **Private by default.** Presentation media and member data stay on the church's own computer. Cloud sync is
   limited to account/profile data, settings, themes, templates, presentation definitions, pairing records, and
   security audit logs. No product-usage telemetry.
5. **No subscriptions.** FrameDecks is church software, not a service with tiers, seats or billing.
6. **Fast operation.** The common actions (Go Live, next, hide, black screen) are one key or one tap, and respond at
   once.

---

## Where we are (6.9)

FrameDecks runs a complete meeting from one Windows PC: Frames and Content, questions and scriptures with
answers and notes, PowerPoint and media, the FrameDecks camera for Zoom, Teams and Google Meet, OBS overlay pages,
a Presentation window for projectors and screen sharing, annotation, a Speaker View, and a phone remote. See
[CHANGELOG.md](CHANGELOG.md).

## Modernization direction

FrameDecks is being modernized incrementally as a free, cloud-connected platform while preserving the current
local presentation runtime and user workflows. The hosted control plane is planned around Next.js, TypeScript,
Tailwind CSS, shadcn/ui, Supabase, and Vercel. The mobile PWA remains a remote-control client; presentation rendering
and media playback remain on local runtimes.

Cloud synchronization is metadata-only. Images, video, audio, presentation assets, and media libraries remain local.
The product remains completely free: no payments, subscriptions, paywalls, trials, licensing restrictions, or
feature gating. Initial deployments use Vercel-provided URLs; Cloudflare edge integration is deferred until a custom
domain is available.

Implementation is tracked in [the modernization status](project/history/modernization-status.md), with the
[architecture and migration plan](project/history/modernization.md). This direction does not authorize removing
existing features or making live presenting dependent on cloud connectivity.

---

## Now: hardening for Sunday use

| Item | Why |
| --- | --- |
| Field testing on real church PCs, webcams, projectors and PowerPoint versions | Development tests use a simulated camera and PowerPoint. Real hardware finds what simulation cannot. |
| **Code signing** for the installer | Removes the "Windows protected your PC" warning that worries volunteers and IT administrators. |
| Automated interface tests (Playwright) in CI | The service-critical flows (Go Live, stepping, Hide all, remote, annotation, Speaker View) are tested by hand today. |
| Update the build's GitHub Actions to current major versions | The current actions run on a deprecated Node.js runtime. |
| **Choose and publish a licence** | An open decision for the maintainer. Until then the repository has no licence file and all rights are reserved. |

## Next: worship services

| Item | Why |
| --- | --- |
| **Song and lyrics library** | Today lyrics are shown with Text Content or PowerPoint. A song library would hold songs with verses, choruses and bridges, an arrangement order, author and copyright lines, and a **CCLI song number** field, with quick stepping by section. |
| **Stage display for musicians and speakers** | The Speaker View is a start. A stage display would show current and next lyrics, a countdown and messages from the operator, on a second screen or a tablet. |
| **Service order (run sheet) view** | One view of the whole service, in order, with timings, built from Frames. |
| **Better multi-output** | Clearer control of what goes to the projector (Presentation window), the stream (FrameDecks camera, OBS pages) and the stage at the same time. |
| **Media library** | A searchable place for the church's backgrounds, videos and images, reusable across meetings. |

## Later: broader ministry

| Item | Why |
| --- | --- |
| **Offline Bible translations** | Scripture without the internet, for translations whose licences allow it. Today: ESV online with a key, or typed text. |
| **Localization** | The interface in the languages our churches speak. Requires separating interface text from the code first. |
| **Accessibility review** | Keyboard paths, screen reader labels and contrast checked against WCAG for the dashboard and the remote. |
| **macOS** | Only if there is clear demand. The FrameDecks camera, screen capture and PowerPoint control are Windows-specific and would need new implementations. |

---

## Not planned

- Payments, subscriptions, paywalls, trials, licensing restrictions, or feature gating.
- Cloud storage or streaming of presentation media.
- Advertising or product-usage telemetry.
- Features that need a permanent internet connection to run a service.
