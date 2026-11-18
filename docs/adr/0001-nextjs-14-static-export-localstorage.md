# 0001 · Next.js 14 as a static export, data in localStorage

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

The brief asked for Next.js 14 (App Router), TypeScript and Tailwind, with data kept in
`localStorage` for this demo. There's no backend, no accounts, and no data leaves the browser.

On 2026-11-18 `npm audit` showed Next.js 14.2.35 (the last 14.x release) with many open
advisories, including critical RCE in the Image Optimization API and DoS/SSRF in Server
Actions and RSC endpoints. The fixes exist only in 15.5.x / 16.x. Next 14 no longer gets updates.

## Options considered

1. **Next 14 on a Node server (`next start`)**: what the brief describes, but it exposes the vulnerable server features in production.
2. **Next 14 with `output: "export"`**: production is plain static HTML/JS. There's no Next server, image optimizer, Server Actions or RSC endpoint to attack. It fits an app that only uses the browser.
3. **Upgrade to Next 16**: patched and supported, but it isn't what was asked for, and the upgrade involves breaking changes (async request APIs, React 19).

## Decision

Option 2. The app is fully client-side, so a static export loses nothing and removes the
server-side attack surface those advisories target. Data lives in `localStorage` under a
versioned envelope (`expense-tracker:v1`) and is checked on every load.

## Consequences

- `npm audit` still reports the advisories, because the package is installed. They apply to `next dev`/`next start`, not to the exported `out/` folder. Use `next dev` only on localhost.
- No server features: no API routes, middleware, ISR or security headers set by Next. Headers (CSP etc.) must come from the static host.
- Data is per-browser, per-device, and the browser can evict it. CSV export is the user's backup.
- Follow-ups: upgrade to a supported Next major; if multi-device sync is needed, add a backend and auth (new ADR).
