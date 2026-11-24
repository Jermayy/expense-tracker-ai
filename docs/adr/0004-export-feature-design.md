# 0004 · Export feature design: a hybrid of three prototypes

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Before this change, `main` had one export: an **Export CSV** button on the Expenses page that
downloaded the filtered list (Date, Description, Category, Amount). Nothing else, and no prompt to
back up, even though data lives only in `localStorage` and can be evicted (ADR 0001).

Three approaches were built from `main` and compared:

| Branch                   | Approach                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `feature-data-export-v1` | One-click CSV button on the dashboard                                     |
| `feature-data-export-v2` | Export dialog: filters, live preview, summary, CSV/JSON/PDF               |
| `feature-data-export-v3` | `/exports` cloud-style hub; email, Drive, Dropbox etc. simulated as demos |

`feature-data-export-hybrid` combined them and was merged. Each build step is tagged
`export-hybrid/step-N-*` (e.g. `git show export-hybrid/step-4-layouts`); the prototype branches
are kept as references.

## What changed compared with `main`

| Area             | `main` before                    | Now                                                                                  |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| Entry point      | Export CSV button, Expenses page | Split button (**Export CSV** + **Options**) on the dashboard and the Expenses page   |
| Formats          | CSV                              | CSV, JSON, PDF report                                                                |
| CSV columns      | Date, Description, Category, Amt | Date, Category, Amount, Description                                                  |
| CSV shapes       | Itemised                         | Itemised, tax report, monthly summary, category analysis                             |
| Choosing data    | Whatever the page filters showed | Dialog date range (presets incl. this/last financial year) and categories            |
| Privacy          | —                                | "What's in the file" list; optional description redaction                            |
| Sending the file | Download                         | Download, or **Share…** via the device share sheet (Web Share API) where supported   |
| Backups          | Advice in the README             | Dashboard reminder after 7 days without a full backup; one-click JSON backup         |
| Bundle           | —                                | Dialog, encoders and PDF writer load on first open; `/` first load 112 kB            |
| Other            | —                                | Nav-link filter reset fix; filtering docs; `Modal` `size` prop; CI `docs/wip/` guard |

## Decisions, with pros and cons

1. **A dialog as the main export UI (from V2)**, not a separate `/exports` page (V3).
   - Pros: export stays where the data is; one set of filters; preview before download.
   - Cons: a lot of options in one modal (the preview column had to be made sticky); no
     history of past exports.
2. **Keep one click for the common case (idea from V1)**: a split button, "Export CSV" downloads
   immediately, "Options" opens the dialog, pre-filled with the page's filters.
   - Pros: no regression for people who used the old button; power features are opt-in.
   - Cons: two paths to maintain; the one-click path never redacts.
3. **CSV column order changed to Date, Category, Amount, Description** (the exercise's stated
   requirement). The PDF keeps Date, Category, Description, Amount so the amount reads last.
   - Pros: matches the requirement; amount sits next to the fields it's usually grouped by.
   - Cons: **breaking** for anyone whose spreadsheet or script expects the old order; CSV and
     PDF orders differ.
4. **Code-split the dialog** with `next/dynamic`; the provider stays light.
   - Pros: first load is smaller than V2 (112 kB vs 115 kB on `/`) despite more features.
   - Cons: a short delay on first open; focus has to be set after the panel mounts.
5. **PDF from a built-in ~180-line writer** (see [ADR 0003](0003-built-in-pdf-writer-for-exports.md)).
   - Pros: no dependency, no CSP change, deterministic and unit-tested.
   - Cons: Latin-only text, no charts or custom fonts.
6. **CSV layouts summarise the dialog's selection** rather than V3's standalone templates that
   each picked their own records. Financial-year helpers moved into the pure domain layer.
   - Pros: one mental model (filter, then choose a shape); layouts are pure and easy to test.
   - Cons: summaries are CSV-only; JSON and PDF are always itemised.
7. **Redaction applied once in `buildExportFile`**, so every format and the preview honour it.
   - Pros: one place to get right; can't be missed by a new format.
   - Cons: all-or-nothing on descriptions; no per-field control.
8. **Device sharing instead of simulated cloud integrations.** V3's email, share links, Google
   Sheets, Dropbox, OneDrive, sync pill and activity tray were dropped.
   - Pros: everything shown actually works with no server, and nothing leaves the device unless
     the user sends it; nothing pretends to be real.
   - Cons: no direct cloud upload; the Share button is hidden on browsers that can't share
     files through the Web Share API.
9. **Backup reminders instead of V3's schedules.** A browser-only app can't run scheduled
   exports, so this keeps the useful part, a timely nudge. State lives under its own key
   (`expense-tracker:backup:v1`); only a full, unredacted CSV (itemised/tax) or JSON counts.
   - Pros: addresses the real risk of `localStorage` eviction; new users aren't nagged (first
     reminder when their oldest expense is 7 days old).
   - Cons: it's still only a reminder; and if the browser clears site data it also clears the
     reminder state.

## Consequences

- Export code lives in `src/features/expenses/export/`; one encoder per format behind
  `FORMAT_SPECS`, so a new format is a new file plus a registration.
- Test suite grew from 84 to 184 tests.
- Known gaps: not checked at phone width or in light mode; the real download, share sheet and
  backup banner were covered by automated tests but not triggered in a browser.
- Revisit if the app gains a backend: real scheduled backups and cloud destinations (V3's ideas)
  become possible then.
