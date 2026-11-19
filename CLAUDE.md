# Spendwise (expense-tracker-ai)

Follows Jem's engineering playbook: @~/.claude/playbook/PLAYBOOK.md
(Global standards live in `~/Coding Projects/engineering-playbook`. Anything below overrides them for this project.)

## What this is

Client-only personal expense tracker (demo / MVP). Data lives in `localStorage`; no backend, no auth.

## Stack

- Node 20 (`.nvmrc`), TypeScript strict
- Next.js 14.2 App Router, **static export** (`output: "export"`, `trailingSlash: true`), React 18, Tailwind 3
- Storage: `localStorage` key `expense-tracker:v1` (versioned envelope)
- Tests: Vitest + jsdom + Testing Library; Prettier + ESLint (next/core-web-vitals)

## Commands

```bash
npm ci               # setup
npm run dev          # dev server :3000
npm test             # all tests
npm run lint         # eslint
npm run format:check # prettier
npm run typecheck    # tsc --noEmit
npm run check        # full CI sequence incl. build
```

## Structure

- `src/features/expenses/domain`: pure types/rules (money in cents, ISO dates, validation). No React.
- `src/features/expenses/lib`: filters, analytics, CSV, storage repository.
- `src/features/expenses/state/ExpensesProvider.tsx`: the only place that writes expense storage.
- `src/features/exports`: exports hub. Pure `domain/` (templates, destinations, schedules), `lib/runJob.ts` (step pipeline, injectable deps), `state/ExportHubProvider.tsx` (owns the separate `expense-tracker:exports:v1` key). Simulated destinations must stay labelled Demo ([ADR 0003](docs/adr/0003-exports-hub-with-simulated-cloud-integrations.md)).
- `src/components/ui`: shared primitives; colours are CSS-variable tokens in `globals.css`, mapped in `tailwind.config.ts`.

## Conventions specific to this project

- Mutations persist first, then commit to state; they throw `StorageError` and callers toast the message.
- Inject `now`/`newId`/`storage` for determinism in tests (tests pin `TZ=Australia/Sydney`).
- Category colours are fixed by category slot (`--cat-1..6`), never by rank.
- Dialog initial focus uses `data-autofocus` (not React `autoFocus`) because `showModal()` steals focus.

## Deviations from the playbook

- No server: health endpoints, structured server logs and server-side validation are N/A ([ADR 0001](docs/adr/0001-nextjs-14-static-export-localstorage.md)).
- Hosted on Vercel (git-connected: PR previews, production on merge to `main`). CSP and security headers live in `vercel.json` and allow `'unsafe-inline'` because the static export needs it ([ADR 0002](docs/adr/0002-vercel-hosting-and-security-headers.md)). Re-check the app for CSP violations after changing headers or adding any external resource.
- `main` is protected: changes go through a PR with the CI checks green.
- Next 14 has unpatched advisories; accepted only because production is a static export (ADR 0001).
- No error tracker configured yet. CI (`.github/workflows/ci.yml`) runs the `npm run check` steps, gitleaks and a non-blocking `npm audit` (blocking would always fail on the accepted Next 14 advisories).

## Sensitive areas

- Users' financial data in `localStorage`: never overwrite unreadable data without explicit user confirmation.
