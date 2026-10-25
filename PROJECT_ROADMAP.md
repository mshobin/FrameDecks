# PROJECT ROADMAP

Phases follow [docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md), which is authoritative for detail.

| Step | State |
|---|---|
| Audit, branding, architecture decisions | Done |
| Hosted Next.js shell + CI + Vercel | Done |
| PWA manifest + safe service worker | Done (device acceptance pending) |
| Tenant schema + RLS | Done; tested in-repo on PGlite; live Supabase DB pending |
| Supabase project, providers, sign-in UI | Next (needs owner credentials) |
| Live RLS tests against Supabase | After sign-in |
| Secure device pairing + runtime channel | Later |
| Real-device PWA acceptance, operations | Later |
| Packaged Windows run, tray icon check | Later |
| Logo visual QA (light theme, teleprompter, remote, speaker, 16px favicon) | Done 25 Oct ([report](docs/qa/2026-10-25-logo-visual-qa.md)); heavier small-size emblem added for 16–32 px |
| Resolve drift: open PRs #8–#16 vs this plan (see PROJECT_STATUS.md) | Needs owner decision |
