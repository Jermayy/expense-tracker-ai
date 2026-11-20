# Export feature: hybrid build log (branch-only)

> **Scrub before merge.** This folder (`docs/wip/`) is working notes for the
> `feature-data-export-hybrid` branch. CI's "No branch-only docs" check fails on any
> non-draft PR that still contains it. Delete `docs/wip/` in the final commit before marking
> the PR ready. The git tags listed below keep every step reachable after it's gone.

## Why this branch exists

Three competing export approaches were built from `main` and compared:

| Branch                   | Commit    | Approach                                                             |
| ------------------------ | --------- | -------------------------------------------------------------------- |
| `feature-data-export-v1` | `65bb4d0` | One-click CSV button on the dashboard                                |
| `feature-data-export-v2` | `d6a47d3` | Export dialog: filters, preview, summary, CSV/JSON/PDF               |
| `feature-data-export-v3` | `e2bf38f` | `/exports` cloud-style hub; integrations simulated and labelled Demo |

The evaluation recommended a hybrid: **V2's dialog as the base**, **V1's one-click speed**
for the common case, and the **parts of V3 that work without a server**. V3's simulated
integrations (email, share links/QR, Google Sheets, Dropbox, OneDrive, connections, activity
tray, sync pill, history table, fingerprints) were deliberately left out.

## Checkpoints

Each step is one commit with an annotated tag. To see a step: `git show <tag>`; to browse
the app at that point: `git checkout <tag>`.

| Step | Tag                             | Summary                                                |
| ---- | ------------------------------- | ------------------------------------------------------ |
| 1    | `export-hybrid/step-1-scaffold` | This log, the CI guard for `docs/wip/`, CLAUDE.md note |

## Step log

### Step 1: scaffold

- **Added** `docs/wip/export-hybrid.md` (this file).
- **Added** CI job `wip-docs` in `.github/workflows/ci.yml`: fails non-draft PRs containing
  `docs/wip/`; `pull_request` now also triggers on `ready_for_review` so marking a draft ready
  re-runs it. Origin: new, not from V1–V3.
- **Updated** `CLAUDE.md`: documents the `docs/wip/` convention.

### Step 2: export dialog + one-click export

**Taken unchanged** (`git checkout <branch> -- <path>`):

| Path                                                                                                                   | From                              |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `src/features/expenses/export/options.ts`                                                                              | V2 `d6a47d3` (then edited, below) |
| `src/features/expenses/export/runExport.ts`                                                                            | V2 `d6a47d3`                      |
| `src/features/expenses/export/ExportPreview.tsx`                                                                       | V2 `d6a47d3`                      |
| `src/features/expenses/export/formats/{types,csv,json,index}.ts`                                                       | V2 `d6a47d3` (`index.ts` edited)  |
| `src/components/ui/Modal.tsx` (`size` prop)                                                                            | V2 `d6a47d3`                      |
| `src/features/expenses/components/useCsvExport.ts`                                                                     | V1 `65bb4d0`                      |
| `src/features/expenses/lib/csv.ts` (column order)                                                                      | V1 `65bb4d0`                      |
| `tests/csv.test.ts`                                                                                                    | V1 `65bb4d0`                      |
| `tests/exportOptions.test.ts`, `tests/runExport.test.ts`, `tests/exportFormats.test.ts`, `tests/ExportDialog.test.tsx` | V2 `d6a47d3` (edited)             |
| `tests/DashboardView.test.tsx`                                                                                         | V1 `65bb4d0` (edited)             |

**Changed while porting:**

- **Code-split the dialog.** V2's `ExportDialog.tsx` was split into a light provider
  (`ExportDialog.tsx`, always loaded) and `ExportPanel.tsx` (everything else), loaded with
  `next/dynamic` when the dialog first opens. Measured: `/` first load 111 kB vs V2's 115 kB;
  the panel is its own ~17 KB chunk.
- **Focus after lazy load.** The Modal sets initial focus before the panel exists, so the panel
  focuses its `[data-autofocus]` element on mount. Covered by a new test.
- **PDF held back** until step 3: `EXPORT_FORMATS` is `["csv", "json"]`, PDF tests removed for now.
- **One-click export kept (from V1's idea, new component).** `ExportSplitButton.tsx`:
  "Export CSV" downloads immediately via V1's `useCsvExport` hook; the "Options" half opens the
  dialog. On the Expenses page it exports the filtered list and pre-fills the dialog with the
  page's filters (V2 behaviour); on the dashboard it exports everything.
- **CSV column order decided: Date, Category, Amount (AUD), Description** (V1, matching the
  exercise's stated requirement). V2's and `main`'s order was Date, Description, Category,
  Amount. Applies to the quick export and the dialog's CSV.
- **Not taken from V2:** removal of `csvFilename`/`downloadCsv` from `lib/csv.ts` (the quick
  export uses them); V2's replacement of the Expenses page button with a dialog-only "Export…".

### Step 3: PDF report

**Taken unchanged:**

| Path                                                  | From                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `src/features/expenses/export/formats/pdf.ts`         | V2 `d6a47d3`                                                       |
| `src/features/expenses/export/formats/pdfDocument.ts` | V2 `d6a47d3`                                                       |
| `docs/adr/0003-built-in-pdf-writer-for-exports.md`    | V2 `d6a47d3`                                                       |
| `tests/exportFormats.test.ts`                         | V2 `d6a47d3` (CSV expectation re-edited for step 2's column order) |

**Changed while porting:**

- Registered `pdf` in `EXPORT_FORMATS` and `FORMAT_SPECS`.
- **PDF table keeps V2's column order** (Date, Category, Description, Amount): a printed report
  reads best with the right-aligned amount last. The step-2 order decision applies to CSV only.
- Measured: page first-load sizes unchanged from step 2 (111 kB / 102 kB); the PDF writer is in
  the on-demand dialog chunk only.

### Step 4: CSV layouts and financial-year presets

**Adapted (not copied) from V3 `e2bf38f`, `src/features/exports/domain/templates.ts`:**

- V3 had four standalone templates, each choosing its own records (tax report by financial
  year, last N months, all time). Here they're **CSV layouts** that summarise whatever the
  dialog has already filtered, so there's one set of filters and the layout only decides shape:
  - `itemised` (default; the step-2 CSV)
  - `tax-report`: itemised plus category subtotals and a total (V3 `taxReport`). Title names
    the financial year when the range is exactly one.
  - `monthly-summary`: months × categories (V3 `monthlySummary`), now spanning the chosen
    dates (new helper `monthKeysBetween`), including empty months.
  - `category-analysis`: count, total, average, share, largest (V3 `categoryAnalysis`,
    `shareOf` unchanged).
  - V3's "Full data" template isn't needed: it's the dialog's JSON format.
- Code: `src/features/expenses/export/formats/csv.ts`. Layout option and labels in `options.ts`
  (`EXPORT_LAYOUTS`, `isItemisedLayout`).
- **Financial-year helpers** moved from V3's templates into a pure domain module,
  `src/features/expenses/domain/financialYear.ts` (`currentFinancialYear`, `financialYearRange`,
  `financialYearLabel` from V3; `financialYearToDate`, `financialYearOf` new).

**New in this step:**

- Date presets "This FY" (to date) and "Last FY" in the dialog.
- Layout picker, shown only for CSV (JSON and PDF are always itemised).
- Suggested filename follows the layout and range (`tax-report-fy2026`,
  `monthly-summary-2026-11-19`) until the user types their own.
- `describePeriod`/`describeCategories` moved from `formats/pdf.ts` to `formats/describe.ts`
  so CSV and PDF share them.
- Tests: `tests/financialYear.test.ts`, `tests/csvLayouts.test.ts` (both partly adapted from V3's
  `tests/exportTemplates.test.ts`), plus additions to `exportOptions` and `ExportDialog` tests.

**Not taken from V3:** template cards, the `/exports` page, per-template run dialogs.

### Step 5: redaction, "What's in the file", Share via device

**Adapted from V3 `e2bf38f`:**

| Feature                          | V3 source                                                                 | Here                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redact descriptions              | `params.redact` in `domain/templates.ts`, toggle in `RunExportDialog.tsx` | `ExportOptions.redact`; applied once in `buildExportFile` (`runExport.ts`) so every format is covered; preview shows `[redacted]`; JSON gets `redacted: true`; PDF notes it on the cover |
| "What's in the file" panel       | `PrivacyPanel` in `RunExportDialog.tsx`                                   | `FileContents` in `ExportPanel.tsx`; field list from `fileFields()` in `options.ts`, by format and layout; toggle only shown when the file contains descriptions                         |
| Share via device (Web Share API) | `canShareFiles`, `shareFile` in `lib/runJob.ts`                           | `canShareFiles`, `shareExport`, `isShareCancelled` in `runExport.ts`; "Share…" button in the dialog footer, only where supported                                                         |

**Changed while porting:**

- V3 hashed the file before opening the share sheet and had to reorder steps for Safari's
  user-activation rule. There's no hashing here; `shareExport` builds synchronously and calls
  `navigator.share` straight away.
- Dismissing the share sheet (`AbortError`) isn't treated as an error: the dialog stays open, no
  message. Other failures show "Sharing failed. Try Export instead."
- V3's simulated-destination copy ("Demo: nothing leaves this device…") isn't needed: the panel
  says Export saves locally and Share sends to the app the user picks.
- The one-click "Export CSV" button doesn't redact; it's the fast path. Redaction is in the dialog.

**Not taken from V3:** fingerprints (SHA-256), job steps/activity tray, simulated destinations.

### Step 6: backup reminders

**Replaces V3 `e2bf38f`'s schedules** (`domain/schedule.ts`, `SchedulesPanel.tsx`, the due
banner and nav badge). V3 let users set daily/weekly/monthly exports, but a browser-only app
can't run them in the background, so they only ever surfaced as "due" banners. This keeps that
useful part (a timely nudge) and drops the configuration.

**New:**

- `src/features/expenses/lib/backupReminder.ts`: last-backup and snooze timestamps under their
  own key `expense-tracker:backup:v1` (separate from expense data; unreadable state falls back
  to empty). `isReminderDue`: due 7 days after the last backup; someone who has never backed up
  is reminded once their oldest expense is 7 days old, so new users aren't nagged.
- `src/features/expenses/components/BackupReminder.tsx`: dashboard banner with "Download
  backup" (full JSON) and "Remind me in 3 days". The backup code
  (`export/fullBackup.ts`) is loaded on click to keep the dashboard light (measured: `/` 112 kB,
  +1 kB over step 5; it was +3 kB before lazy-loading).
- **What counts as a backup** (`isFullBackup` in `options.ts`): every expense, unredacted, in
  CSV itemised/tax-report or JSON. Recorded from all three paths: the one-click "Export CSV"
  (when it's exporting everything), the dialog's Export, and Share. PDF and summaries don't
  count: they can't be restored from.
- Tests: `tests/backupReminder.test.ts`, `tests/BackupReminder.test.tsx`, additions to
  `DashboardView` and `ExportDialog` tests.

**Not taken from V3:** schedule configuration, frequencies, scheduled cloud uploads, the
header sync-status pill.

### Step 7: browser check and permanent docs

- **Checked in Chrome** on the dev server (dashboard split button, dialog with Tax report
  layout, Last FY preset, redaction, Share… button). No console errors.
- **Fix found by that check:** with steps 4–5 the options column grew long, so the preview
  scrolled out of view leaving empty space. The preview column is now sticky on wide screens
  (`ExportPanel.tsx`).
- **Permanent docs** (these stay after `docs/wip/` is deleted): README features, test count
  and structure; CLAUDE.md structure notes for `export/` and `backupReminder.ts`.
- Final measurements: `/` 112 kB, `/expenses` 103 kB first load (V1: 110 / 100, V2: 115 / 106);
  export dialog and PDF writer load on first open.

### Step 8: filtering docs and nav-link fix

- **Docs** (permanent): `docs/features/filtering.md` and `docs/user-guide/filtering.md`, written
  with the project `/document-feature` command, plus indexes, screenshots in
  `docs/screenshots/filtering/` (production build, sample data, clock pinned to 20 Nov 2026) and
  README/CLAUDE.md cross-references.
- **Bug found while capturing screenshots:** clicking **Expenses** in the nav while on a filtered
  list reset the URL but kept the filters on screen, because `ExpensesView` read the URL only on
  mount. It now adopts URL changes from navigation, and ignores the router's late echoes of its
  own `replaceState` while typing. Regression tests in `tests/ExpensesView.test.tsx`; checked in
  Chrome against the production build.

## Before merging: scrub checklist

1. Decide this is the version to merge (V1–V3 branches and the tags above stay as references).
2. Delete `docs/wip/` in a final commit (`git rm -r docs/wip`).
3. Mark the PR ready; CI's "No branch-only docs" check must pass.
4. Optional: once no branch uses `docs/wip/`, the `wip-docs` CI job can stay (it's harmless and
   reusable) or be removed together with the CLAUDE.md note.

## Known gaps

- Not checked at phone width or in light mode.
- The real download, the device share sheet and the backup banner weren't triggered in a
  browser (covered by automated tests).
- PDF text is Latin-only (ADR 0003).
