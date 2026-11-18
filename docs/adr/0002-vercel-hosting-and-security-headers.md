# 0002 · Host on Vercel, with security headers in `vercel.json`

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

ADR 0001 made production a static export and noted that security headers would have to come
from the static host. The app now needs a public demo that redeploys itself when `main` changes.

## Options considered

1. **Vercel**: detects Next.js, builds on push, gives per-PR preview deployments and HTTPS with
   HSTS by default, and sets custom headers from a file in the repo. Free for a personal project.
2. **GitHub Pages**: free and in the same place as the code, but it can't set custom response
   headers, so there's no CSP.
3. **S3 + CloudFront**: full control over headers, but more infrastructure to own for a demo.

## Decision

Option 1. The project is connected to the GitHub repo: pushes to `main` deploy to production
(https://spendwise-jermayy.vercel.app) and pull requests get preview deployments.
`vercel.json` sets these headers on every response:

- `Content-Security-Policy`: everything from the site's own origin; `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri` and `form-action` restricted to the site.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` (camera, microphone, location etc. disabled), `Cross-Origin-Opener-Policy`.

The CSP allows `'unsafe-inline'` for scripts and styles. A Next static export embeds inline
bootstrap scripts, and server-rendered `style` attributes (used for chart sizes) are inline
styles. Nonces need a server per request, which a static export doesn't have; hashes would
have to be regenerated on every build. With no third-party scripts, no user HTML rendering
and `connect-src 'self'`, the remaining risk is low.

## Consequences

- Headers are versioned and reviewed like code. They were checked against the production build
  in a browser (no CSP violations; load, filter, export and add flows work).
- Preview deployments sit behind Vercel Authentication; production is public.
- Rollback: promote a previous deployment (`vercel rollback` or the dashboard).
- Moving hosts means moving these headers too.
- Follow-up: a build step that hashes the inline scripts into `script-src`, so
  `'unsafe-inline'` can be dropped.
