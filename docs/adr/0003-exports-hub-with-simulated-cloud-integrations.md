# 0003 · Exports hub with real local exports and clearly simulated cloud integrations

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The exports feature should feel like a connected service: email, share links, Google Sheets,
Dropbox, OneDrive, schedules and history. The app has no server and no accounts (ADR 0001), and
it tells users their data stays in the browser. A real integration would need a backend, OAuth
clients and a privacy policy that covers sending financial data to third parties.

## Options considered

1. **Build real integrations**: needs a server, secrets, OAuth app registrations and a new
   privacy position. Far beyond a client-only MVP.
2. **Mock everything, styled as real**: impressive in a demo, but users could believe a file was
   emailed or uploaded when it wasn't, which breaks the app's privacy promise.
3. **Real where the browser allows, simulated elsewhere, and labelled**: templates, download,
   the Web Share API (the device's own share sheet), history, fingerprints and schedule tracking
   are real. Email, share links and cloud services run the same job pipeline but only simulate
   the delivery step.

## Decision

Option 3. Simulated destinations are marked "Demo" on every surface (destination tiles, job
steps, history rows, toasts, buttons), and the hub page explains it up front. Simulated share
links use the reserved `.example` domain (RFC 2606), so a copied link can never reach a real
site. The QR code is a non-scannable preview, labelled as such. Service tiles use the app's own
palette and letters instead of the services' logos.

Hub state (connections, schedules, history) lives under its own versioned `localStorage` key
(`expense-tracker:exports:v1`) and never touches the expenses key. Unreadable hub state falls
back to empty, because it's settings and a log, not the user's financial records.

## Consequences

- Nothing leaves the device unless the user chooses Download or Share via device.
- Schedules can't run while the app is closed; due exports are surfaced when it's next opened.
- The history stores email recipients the user typed, in this browser only.
- Making an integration real later means replacing its delivery step in `runJob.ts` (behind an
  adapter) and revisiting this ADR, the CSP's `connect-src` and the privacy notice.
