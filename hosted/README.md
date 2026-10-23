# FRAMEDECKS hosted companion

This is the separate, online-first FRAMEDECKS web companion. It does not connect
to the desktop app's local HTTP server. Authentication, cloud data, and device
pairing are not implemented yet; the current screen is a static foundation
preview and must not be treated as a live service dashboard.

## Local development

From the `hosted/` directory, install the locked dependencies and start Next.js:

```powershell
npm ci
npm run dev
```

The development server is available at `http://localhost:3000`. This local
development URL is not a runtime integration with FRAMEDECKS desktop.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The boundary test prevents explicit local HTTP addresses from being added to
hosted source. It does not replace security review or browser/device testing.

## Vercel deployment

Use `main` as the Production Branch and set the Root Directory to `hosted`.
The Root Directory must not be the repository root: Next.js gives a root
`app/` folder priority over `src/app`, and the desktop app's `app/` folder
would hide this app's routes. Choose the Next.js framework preset and leave
the build and output settings at their defaults.
The app currently requires no environment variables. Keep preview and
production credentials separate when authenticated services are introduced.
The app uses the Vercel-provided HTTPS URL; no custom domain or Cloudflare
configuration is required.
