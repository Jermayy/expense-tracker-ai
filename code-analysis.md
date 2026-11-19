# Data export: code analysis of three implementations

Systematic comparison of the three export branches of Spendwise (client-only Next.js 14 static
export, React 18, TypeScript strict, data in `localStorage`). Each branch was checked out and its
diff against `main` examined file by file; each branch's test suite was run on its own checkout.

| Branch                   | Commit    | Approach                                                                     |
| ------------------------ | --------- | ---------------------------------------------------------------------------- |
| `feature-data-export-v1` | `65bb4d0` | Simple: one-button CSV export                                                |
| `feature-data-export-v2` | `d6a47d3` | Advanced: export dialog with filters, preview, CSV/JSON/PDF                  |
| `feature-data-export-v3` | `e2bf38f` | Cloud-style: `/exports` hub with templates, destinations, schedules, history |

**Baseline on `main`:** `src/features/expenses/lib/csv.ts` already had `expensesToCsv`,
`escapeCsvCell` (CSV injection guard), `downloadCsv` and a filtered-view "Export CSV" button on
the Expenses page. `lib/download.ts` has `downloadFile` (Blob + object URL + temporary `<a>`).
All three branches build on these.

**How numbers were obtained.** Files and line counts: `git diff --numstat main..<branch>`.
Tests: `npx vitest run` on each checkout. Bundle sizes: `next build` output recorded when each
branch was built during development (first-load JS, shared chunks included). Pattern counts:
`grep` over each branch's added/modified source files.

---

## Summary matrix

|                                   | V1 Simple                    | V2 Advanced              | V3 Cloud hub                                           |
| --------------------------------- | ---------------------------- | ------------------------ | ------------------------------------------------------ |
| Source lines added / removed      | 45 / 17                      | 1,130 / 30               | 2,284 / 7                                              |
| Test lines added                  | 65                           | 515                      | 509                                                    |
| Files changed (incl. docs, tests) | 7                            | 22                       | 31                                                     |
| New source files                  | 1                            | 10                       | 19 (+1 route)                                          |
| Tests on branch (total / files)   | 86 / 12                      | 130 / 15                 | 117 / 16                                               |
| New npm dependencies              | none                         | none                     | none                                                   |
| `/` first load JS                 | 110 kB                       | 115 kB                   | 109 kB                                                 |
| `/expenses` first load JS         | 100 kB                       | 106 kB                   | 100 kB                                                 |
| New route                         | –                            | –                        | `/exports` (108 kB)                                    |
| Persisted state added             | none                         | none                     | `expense-tracker:exports:v1`                           |
| Formats                           | CSV                          | CSV, JSON, PDF           | CSV (4 templates), JSON                                |
| Real destinations                 | download                     | download                 | download, Web Share API                                |
| Simulated features                | none                         | none                     | email, share link/QR, Google Sheets, Dropbox, OneDrive |
| Raw HTML / `eval` / network calls | none                         | none                     | none                                                   |
| Largest file                      | `useCsvExport.ts` (23 lines) | `ExportDialog.tsx` (407) | `RunExportDialog.tsx` (344)                            |

---

## V1: Simple CSV export (`feature-data-export-v1`, `65bb4d0`)

### Files created / modified

| File                                                 | Change                                       | Lines    |
| ---------------------------------------------------- | -------------------------------------------- | -------- |
| `src/features/expenses/components/useCsvExport.ts`   | **new**                                      | +23      |
| `src/features/expenses/components/DashboardView.tsx` | modified: "Export Data" button in header     | +12 / −3 |
| `src/features/expenses/components/ExpensesView.tsx`  | modified: inline export replaced by the hook | +8 / −12 |
| `src/features/expenses/lib/csv.ts`                   | modified: column order                       | +2 / −2  |
| `tests/DashboardView.test.tsx`                       | **new**                                      |          |
| `tests/csv.test.ts`                                  | modified: expected header                    |          |
| `README.md`                                          | modified                                     |          |

### Code architecture overview

No new module. The change sits entirely in the existing `features/expenses` slice:

```
DashboardView ──┐
                ├─► useCsvExport() ──► lib/csv.expensesToCsv ──► lib/csv.downloadCsv ──► lib/download.downloadFile
ExpensesView ───┘        │
                         └─► useToast() (success / error)
```

The Expenses page's existing inline `exportCsv` function was extracted into a hook, so both
pages share one implementation.

### Key components and responsibilities

- **`useCsvExport()`**: returns a memoised `(expenses) => void` that builds the CSV, triggers the
  download and toasts the result. Owns the only `try/catch`.
- **`DashboardView`**: renders the "Export Data" button only when `status === "ready"` and there
  are expenses; passes **all** expenses.
- **`ExpensesView`**: passes the **filtered** list (unchanged behaviour), button disabled when the
  filter matches nothing.
- **`lib/csv.ts`**: header and row order changed to Date, Category, Amount (AUD), Description.

### Libraries and dependencies

None added. Browser APIs: `Blob`, `URL.createObjectURL`/`revokeObjectURL`, anchor `download`
attribute (all via the existing `downloadFile`).

### Implementation patterns

- **Custom hook for a side effect** (`useCallback` with `[toast]` dependency).
- **Reuse over rewrite**: the CSV builder, escaping and download helper were already on `main`.
- **Render guard** for empty/loading/error states (the button doesn't exist until there's data).

### Code complexity

Very low. One branch point (`try/catch`), no state, no async. Cyclomatic complexity of the hook
is 2. Reviewable in a minute.

### Error handling

- `try/catch` around build + download; logs `console.error("[export] csv failed", err)` and shows
  an error toast. Success toast states the count.
- Not reachable in practice: CSV building is pure string work; `downloadFile` only fails if Blob
  or object URLs are unavailable.

### Security considerations

- **CSV/formula injection**: inherited `escapeCsvCell` prefixes cells starting with
  `= + - @ \t \r` with `'` and quotes cells containing `" , \r \n`. Covered by existing tests.
- **Filename**: fixed (`expenses-YYYY-MM-DD.csv`), no user input reaches it.
- No new storage, no network, no new browser permissions.

### Performance implications

- Bundle: effectively zero change (`/` 110 kB, `/expenses` 100 kB).
- Runtime: O(n) string building on the main thread. Synchronous; for thousands of rows it's
  milliseconds. No loading state is shown, and none is needed at this scale.

### Extensibility and maintainability

- Easy to maintain: tiny surface, one shared hook.
- Not extensible on its own: adding formats, filters or options means building the V2-style
  structure anyway.
- **Behaviour change risk**: the column order change alters the existing Expenses-page export.
  Anyone with spreadsheets keyed to the old columns would notice.

### Technical deep dive

- **How export works:** click → `exportCsv(list)` → `expensesToCsv(list)` (array of string
  arrays, each cell escaped, joined with `,` and `\r\n`) → `downloadCsv` prepends a UTF-8 BOM →
  `downloadFile([BOM, csv], "text/csv;charset=utf-8", name)` creates a Blob, an object URL and a
  temporary `<a download>`, clicks it, removes it and revokes the URL.
- **File generation approach:** in-memory string → `Blob`. RFC 4180 line endings; the BOM makes
  Excel read UTF-8.
- **User interaction:** single button; outcome communicated via toast (`aria-live` region in the
  existing Toast component).
- **State management:** none added. Reads `expenses` from the existing `ExpensesProvider` context.
- **Edge cases:** no expenses → button hidden (dashboard) or disabled (filtered view); formula
  injection and embedded quotes/newlines escaped; non-ASCII text preserved (UTF-8 + BOM).
  Not handled: nothing to handle beyond these. The "export everything" semantics on the
  dashboard can't be narrowed.

---

## V2: Advanced export dialog (`feature-data-export-v2`, `d6a47d3`)

### Files created / modified

| File                                                                                                                   | Change                                         | Lines     |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------- |
| `src/features/expenses/export/ExportDialog.tsx`                                                                        | **new**: provider, panel, pickers              | +407      |
| `src/features/expenses/export/formats/pdfDocument.ts`                                                                  | **new**: PDF 1.4 writer                        | +185      |
| `src/features/expenses/export/formats/pdf.ts`                                                                          | **new**: report layout                         | +142      |
| `src/features/expenses/export/options.ts`                                                                              | **new**: pure option logic                     | +132      |
| `src/features/expenses/export/ExportPreview.tsx`                                                                       | **new**: summary stats + preview table         | +93       |
| `src/features/expenses/export/runExport.ts`                                                                            | **new**: build + download                      | +50       |
| `src/features/expenses/export/formats/json.ts`                                                                         | **new**                                        | +43       |
| `src/features/expenses/export/formats/types.ts`                                                                        | **new**: `ExportFormatSpec`, `ExportContext`   | +19       |
| `src/features/expenses/export/formats/index.ts`                                                                        | **new**: `FORMAT_SPECS` registry               | +13       |
| `src/features/expenses/export/formats/csv.ts`                                                                          | **new**                                        | +12       |
| `src/features/expenses/components/DashboardView.tsx`                                                                   | modified: "Export" button                      | +16 / −3  |
| `src/features/expenses/components/ExpensesView.tsx`                                                                    | modified: "Export…" opens dialog pre-filled    | +9 / −13  |
| `src/components/ui/Modal.tsx`                                                                                          | modified: `size` prop (`md` / `xl`)            | +5 / −2   |
| `src/app/providers.tsx`                                                                                                | modified: `ExportDialogProvider`               | +4 / −1   |
| `src/features/expenses/lib/csv.ts`                                                                                     | modified: removed `csvFilename`, `downloadCsv` | −11       |
| `docs/adr/0003-built-in-pdf-writer-for-exports.md`                                                                     | **new**                                        |           |
| `tests/ExportDialog.test.tsx`, `tests/exportFormats.test.ts`, `tests/exportOptions.test.ts`, `tests/runExport.test.ts` | **new**                                        | 515 total |
| `README.md`, `CLAUDE.md`                                                                                               | modified                                       |           |

### Code architecture overview

A new sub-module `features/expenses/export/` with clear layers:

```
UI (React)             ExportDialog.tsx ─ ExportDialogProvider / useExportDialog
                         └─ ExportPanel ─ FormatPicker · DateRangeFields · CategoryPicker · filename
                         └─ ExportPreview.tsx ─ ExportSummaryStats · ExportPreviewTable
Orchestration          runExport.ts ─ buildExportFile (pure) · runExport (async, downloads)
Pure domain            options.ts ─ defaults · presets · sanitizeFilename · validate · select · summarize
Encoders (registry)    formats/index.ts ─ FORMAT_SPECS: { csv, json, pdf }  (each: ExportFormatSpec)
Low-level              formats/pdfDocument.ts ─ PdfPage, buildPdf, WinAnsi encoding, Helvetica metrics
```

Dependencies point inward: UI → orchestration → pure options/encoders. Nothing in `options.ts`
or `formats/` imports React.

### Key components and responsibilities

- **`ExportDialogProvider` / `useExportDialog()`**: context exposing `openExport(initial?)`;
  owns open/closed state and a `busy` ref that makes Esc/backdrop ignored while exporting.
- **`ExportPanel`**: local form state (`options`, `exporting`, `failure`), derived
  `records`/`summary`/`errors` via `useMemo`, submit handler.
- **`FormatPicker`**: radio cards (visually custom, native `<input type="radio">` underneath).
- **`DateRangeFields`**: start/end `<input type="date">` with `min`/`max`, preset chips with
  `aria-pressed` (All time, This month, Last 30 days, This year).
- **`CategoryPicker`**: checkbox toggles with per-category counts _within the chosen dates_,
  All/None shortcuts, visible tick (not colour-only).
- **`ExportSummaryStats` / `ExportPreviewTable`**: record count, total, date span; table of the
  first 50 rows with "showing 50 of N".
- **`options.ts`**: `defaultExportOptions`, `presetRange`, `activePreset`, `sanitizeFilename`,
  `validateExportOptions`, `selectExportRecords` (reuses `applyFilters`, oldest first),
  `summarizeExport`.
- **`runExport.ts`**: `buildExportFile` (validate → select → encode; throws
  `ExportValidationError`), `runExport` (yields a tick, builds, downloads, injectable deps).
- **`formats/*`**: one `ExportFormatSpec` per format: `{ id, label, description, extension,
mimeType, encode(context) → BlobPart[] }`.
- **`pdfDocument.ts` / `pdf.ts`**: a minimal PDF writer and an A4 report layout (see deep dive).

### Libraries and dependencies

None added. The PDF writer is written in-repo instead of using jsPDF/pdf-lib (rationale in
ADR 0003: no dependency to audit, nothing loaded at runtime, no CSP change). Browser APIs:
`Blob`, object URLs, `<dialog>` (via existing `Modal`), `Intl.DateTimeFormat`/`NumberFormat`.

### Implementation patterns

- **Strategy / registry** for formats (`FORMAT_SPECS`); adding a format is one file + one entry.
- **Pure core, thin shell**: selection, validation and encoding are pure and unit-tested; the
  React panel only wires state to them.
- **Derived state** with `useMemo` rather than stored copies (records, summary, errors are
  computed from `options`).
- **Context + hook** for opening the dialog from anywhere (mirrors the existing
  `ExpenseDialogProvider`).
- **Dependency injection** in `runExport(expenses, options, { now, download })` for tests.
- **Prefill from caller**: the Expenses page passes its current date/category filters.

### Code complexity

Moderate. `ExportDialog.tsx` (407 lines) is the hotspot: four sub-components plus the panel in
one file. The PDF writer is the most intricate code (byte offsets, xref table, font metrics) but
is isolated and covered by structural tests. Pure modules are small and linear.

### Error handling

- **Validation** before export: invalid/impossible dates, reversed range, no categories, empty
  filename after sanitising. Inline messages with `aria-invalid` + `aria-describedby`; Export
  button disabled with a reason ("Nothing to export").
- **Runtime failure**: `try/catch` in submit logs structured context
  (`{ format, count }`) and shows an inline `role="alert"` message; the dialog stays open and the
  user's options are preserved.
- **Defence in depth**: `buildExportFile` re-validates and throws `ExportValidationError`, so a
  bypassed UI can't produce a bad file.
- **Busy state**: `exporting` disables the whole fieldset and Cancel; Esc/backdrop ignored via
  `busy` ref; double submission blocked (`canExport` false while exporting). Tested.

### Security considerations

- **CSV injection**: reuses `expensesToCsv` + `escapeCsvCell`.
- **Filename sanitising** (`sanitizeFilename`): strips `\ / : * ? " < > |` and control chars,
  collapses whitespace, strips a typed extension and leading/trailing dots, caps at 80 chars.
  The extension is always set by the format, so a user can't save `report.html`.
- **PDF content injection**: every text string is written as a hex string (`<…> Tj`), so
  parentheses, backslashes or PDF operators in a description can't break out of the text object.
- **No new storage or network**; nothing leaves the device.
- **JSON**: `JSON.stringify` only; amounts as integer cents plus a decimal string.

### Performance implications

- **Bundle: +5 kB on every page** (`/` 115 kB, `/expenses` 106 kB) because the provider imports
  the panel, all encoders and the PDF writer eagerly, and the provider is mounted at the root.
- **Runtime**: preview and summary recompute on each option change (`useMemo` on
  `[expenses, options]`, O(n) filter + sort). The preview renders at most 50 rows.
- **Encoding is synchronous on the main thread.** `runExport` yields one tick first
  (`setTimeout(0)`) so the spinner paints. PDF for a few thousand rows is fast; very large data
  (10k+) could block for a noticeable moment. A Web Worker would be the fix if needed.

### Extensibility and maintainability

- **Good extension points**: new format = new `ExportFormatSpec`; new preset = entry in
  `DATE_PRESETS` + `presetRange` case.
- **Owned PDF code** is a maintenance commitment: Latin-only (WinAnsi), approximate widths for
  accented letters, no charts or images. ADR 0003 records when to switch to a library.
- **`ExportDialog.tsx` should be split** before growing further (panel and pickers into their
  own files).
- Removing `csvFilename`/`downloadCsv` from `lib/csv.ts` means there is no one-click path left.

### Technical deep dive

- **How export works:** `openExport(initial)` → provider sets `initial` → `Modal open` →
  `ExportPanel` initialises options from `defaultExportOptions(now, initial)` → each change
  re-derives `records = selectExportRecords(expenses, options)` and `summary` → submit →
  `runExport` awaits one tick → `buildExportFile` validates, selects, calls
  `FORMAT_SPECS[format].encode({ records, summary, options, generatedAt })` → `downloadFile` →
  toast "Exported N records to <file>" → dialog closes.
- **File generation approach:**
  - CSV: existing `expensesToCsv` + BOM.
  - JSON: versioned document `{ version, generatedAt, currency, filters, summary, expenses[] }`.
  - PDF: `PdfPage` accumulates content-stream operators (`BT … Tj ET`, `re f`, `m l S`);
    `buildPdf` writes catalog, pages tree, two Type1 standard fonts (Helvetica, Helvetica-Bold,
    WinAnsiEncoding), an Info dict, a page + content-stream object per page, then an xref table
    with byte offsets and a trailer. Text widths come from embedded Helvetica AFM metrics for
    right-alignment and ellipsis truncation. The layout paginates rows, repeats the table header
    on each page, adds summary panels, a total row and "Page x of y" footers. Output is a
    `Uint8Array` built from a string whose chars are all < 0x100, so string offsets equal byte
    offsets. Verified by rendering in macOS Quick Look and by tests that check every xref offset.
- **User interaction:** modal dialog (`<dialog>.showModal()`), two-column layout (options |
  live summary + preview), sticky action bar; initial focus on the selected format radio.
- **State management:** local `useState` in the panel; derived values via `useMemo`; context only
  for "open the dialog"; a `useRef` for the busy flag shared with the provider (no re-render
  needed).
- **Edge cases:**
  - No matching records → preview empty state, "Nothing to export" disabled button.
  - No categories ticked → explicit error (caught a real bug in development: `applyFilters`
    treats `[]` as "no filter", so `selectExportRecords` short-circuits to `[]`).
  - Reversed or impossible dates (e.g. 2026-02-30) rejected.
  - Filename made only of unsafe characters → error; tabs become spaces.
  - Long descriptions truncated with an ellipsis in the PDF; non-WinAnsi characters (emoji,
    CJK) become `?` in PDF only.
  - Empty PDF → "No expenses match the selected filters." row.
  - Export failure → dialog stays open with inline error.

---

## V3: Cloud-integrated exports hub (`feature-data-export-v3`, `e2bf38f`)

### Files created / modified

| File                                                                                                                                                | Change                                                 | Lines     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------- |
| `src/features/exports/components/RunExportDialog.tsx`                                                                                               | **new**: run flow, destinations, privacy panel         | +344      |
| `src/features/exports/domain/templates.ts`                                                                                                          | **new**: 4 templates + FY helpers                      | +223      |
| `src/features/exports/state/ExportHubProvider.tsx`                                                                                                  | **new**: hub state, job runner wiring                  | +176      |
| `src/features/exports/components/ExportsHub.tsx`                                                                                                    | **new**: page, tabs, due banner                        | +173      |
| `src/features/exports/components/SchedulesPanel.tsx`                                                                                                | **new**                                                | +167      |
| `src/features/exports/lib/runJob.ts`                                                                                                                | **new**: step pipeline, Web Share, SHA-256             | +163      |
| `src/features/exports/components/HistoryPanel.tsx`                                                                                                  | **new**                                                | +156      |
| `src/features/exports/domain/destinations.ts`                                                                                                       | **new**: 7 destinations, email check, share URL        | +127      |
| `src/features/exports/components/ActivityTray.tsx`                                                                                                  | **new**: floating job progress                         | +123      |
| `src/features/exports/lib/hubStorage.ts`                                                                                                            | **new**: versioned storage + validation                | +101      |
| `src/features/exports/components/ShareLinkDialog.tsx`                                                                                               | **new**                                                | +82       |
| `src/features/exports/components/DestinationsPanel.tsx`                                                                                             | **new**                                                | +80       |
| `src/features/exports/components/TemplatesPanel.tsx`                                                                                                | **new**                                                | +69       |
| `src/features/exports/components/QrPreview.tsx`                                                                                                     | **new**: decorative, non-scannable                     | +64       |
| `src/features/exports/lib/types.ts`                                                                                                                 | **new**                                                | +44       |
| `src/features/exports/components/ServiceTile.tsx`                                                                                                   | **new**                                                | +41       |
| `src/features/exports/domain/schedule.ts`                                                                                                           | **new**                                                | +39       |
| `src/features/exports/components/SyncStatus.tsx`                                                                                                    | **new**: header pill                                   | +32       |
| `src/features/exports/domain/format.ts`                                                                                                             | **new**: relative time, bytes                          | +32       |
| `src/app/exports/page.tsx`                                                                                                                          | **new route**                                          | +15       |
| `src/components/AppShell.tsx`                                                                                                                       | modified: nav item + due dot, SyncStatus, ActivityTray | +17 / −1  |
| `src/features/expenses/components/DashboardView.tsx`                                                                                                | modified: "Export & share" link                        | +10 / −3  |
| `src/app/providers.tsx`                                                                                                                             | modified: `ExportHubProvider`                          | +6 / −3   |
| `docs/adr/0003-exports-hub-with-simulated-cloud-integrations.md`                                                                                    | **new**                                                |           |
| `tests/ExportsHub.test.tsx`, `tests/exportJob.test.ts`, `tests/exportSchedule.test.ts`, `tests/exportTemplates.test.ts`, `tests/hubStorage.test.ts` | **new**                                                | 509 total |
| `README.md`, `CLAUDE.md`                                                                                                                            | modified                                               |           |

The Expenses page's original one-click "Export CSV" is left untouched.

### Code architecture overview

A separate top-level feature module `features/exports/` with domain / lib / state / components
layers, plus a route:

```
Route        app/exports/page.tsx ─ <Suspense> ─ ExportsHub (tabs via ?tab=)
Components   TemplatesPanel · DestinationsPanel · SchedulesPanel · HistoryPanel
             RunExportDialog (+ PrivacyPanel) · ShareLinkDialog · QrPreview · ServiceTile
Global UI    AppShell ─ SyncStatus (header pill) · ActivityTray (floating jobs)
State        ExportHubProvider ─ HubState {connections, schedules, history} + in-memory jobs
Lib          runJob.ts ─ planSteps · executeExport (pipeline) · sha256Hex · canShareFiles
             hubStorage.ts ─ parse / load / save with schema version + per-record validation
Domain       templates.ts · destinations.ts · schedule.ts · format.ts   (pure, no React)
```

### Key components and responsibilities

- **`ExportHubProvider`**: loads/persists hub state, exposes `runExport`, `connect`/`disconnect`
  (simulated, 900 ms), schedule CRUD, `runSchedule`, `clearHistory`, in-memory `jobs`, a `now`
  re-evaluated every 60 s, and derived `dueSchedules`. Uses refs for latest expenses and state so
  async jobs never read stale data.
- **`executeExport` (runJob.ts)**: three-step pipeline (`generate` → `fingerprint` → `deliver`,
  reordered to deliver-before-fingerprint for the device share sheet). Reports progress via
  callback, never throws: failures become a `failed` history entry.
- **`TEMPLATES`**: Tax report (Australian financial year), Monthly summary (last N months
  pivot), Category analysis, Full data (JSON); each `build(expenses, params, now) → artifact`.
- **`DESTINATIONS`**: Download and Share via device (real), Email, Share link, Google Sheets,
  Dropbox, OneDrive (simulated, labelled Demo).
- **`RunExportDialog`**: template params, destination picker, email/expiry fields, inline
  "Connect" for cloud services, privacy panel with "Redact descriptions".
- **`ActivityTray` / `SyncStatus`**: background-job presentation and global status.
- **`HistoryPanel`**: log with SHA-256 fingerprint, re-run, share link re-open, clear (confirmed).
- **`SchedulesPanel`**: daily/weekly/monthly schedules; due ones surface as banners (no
  background execution is possible).

### Libraries and dependencies

None added. Browser APIs used beyond V1/V2: `crypto.subtle.digest` (SHA-256),
`crypto.randomUUID`, `navigator.canShare`/`navigator.share` (Web Share API Level 2, files),
`navigator.clipboard.writeText`, `Intl.RelativeTimeFormat`, `localStorage` (new key),
`setInterval`.

### Implementation patterns

- **Pipeline / step runner** with typed steps and progress callbacks; delivery is the adapter
  seam where a real integration would plug in.
- **Result-not-exception** at the job boundary (`executeExport` always resolves to an entry).
- **Repository with schema versioning and per-record type guards** (`hubStorage.ts`), history
  capped at 50.
- **Write-through persistence** via a `commit(updater)` helper; save failure surfaced once by
  toast, not thrown (the export itself already succeeded).
- **Dependency injection** of `now`, `newId`, `sleep`, `download`, `shareFile`, `digest` for
  deterministic tests.
- **URL as navigation state** (`?tab=`) with keyboard-operable ARIA tabs (arrow keys, Home/End).
- **Honest simulation**: every simulated surface labelled; share URLs on the reserved `.example`
  domain; QR explicitly non-scannable; service tiles use the app palette, not brand logos.

### Code complexity

High relative to the problem. 23 changed source files; the provider combines persistence,
scheduling, job orchestration and toasts. Roughly half the code exists to present features
that don't perform their stated action (simulated delivery, connections, QR, sync status).
Individual modules are readable and typed; the complexity is in the breadth.

### Error handling

- **Jobs**: per-step `try/catch`; failed step marked `failed`, entry recorded with a user-facing
  message (`describeError`: AbortError → "Sharing was cancelled.", NotAllowedError → "The
  browser blocked sharing."), structured `console.error` with template/destination/step.
- **Storage**: corrupt JSON, unknown version or invalid records → dropped individually, warning
  logged, empty fallback (acceptable because it's settings/history, not user expenses). Save
  failure returns `false`; the provider toasts once.
- **Forms**: email validated before "send"; cloud destinations require a (simulated) connection
  with an inline alert.
- **Clipboard**: copy failure caught, inline "Couldn't copy" message.
- **Gaps**: in-memory jobs are lost on reload (only completed jobs reach history); simulated
  connect can't fail, so its failure path is untested.

### Security considerations

- **No data leaves the device**: no `fetch`/XHR anywhere; simulated destinations only `sleep`.
- **CSV injection**: templates use `escapeCsvCell`.
- **Filenames**: derived from template IDs and dates only, no user input.
- **Personal data at rest**: email recipients typed into the (simulated) email flow are stored in
  `localStorage` history. Low risk (same device, same user) but it's PII the app didn't hold
  before, and it should be disclosed or not stored.
- **Trust/UX risk**: simulated integrations next to a "data stays in your browser" promise could
  mislead if labels were ever removed. Mitigated by the Demo labelling and ADR, but it is the
  main non-code risk of this branch.
- **Share links**: `.example` domain (RFC 2606) so a copied link can't reach a real host.
- **Permissions-Policy/CSP**: unchanged; Web Share and clipboard aren't restricted by the
  current policy.

### Performance implications

- **Bundle: neutral on existing pages** (`/` 109 kB, `/expenses` 100 kB): the hub UI is
  route-split into `/exports` (108 kB). The provider, `SyncStatus` and `ActivityTray` are
  mounted globally but small.
- **Runtime**: `TemplatesPanel` builds all four templates on each render to show counts (O(4n));
  `RunExportDialog` rebuilds the artifact on each option change to show size; a 60 s interval
  re-renders consumers of `now`. All fine at personal-finance scale.
- **Artificial latency**: 1.4 s simulated delivery and 0.9 s simulated connect are pure theatre.
- SHA-256 via `crypto.subtle` is async and off the critical path.

### Extensibility and maintainability

- **Good seams**: templates are pure and table-driven; `executeExport`'s `deliver` step is where
  real adapters would go; storage is versioned.
- **High carrying cost**: each simulated feature is either permanent clutter or a backend
  project (server, OAuth app registrations, secrets, privacy policy, CSP `connect-src`, Privacy
  Act obligations).
- Two persisted stores and a second provider increase the surface for migrations and bugs.
- Templates choose their own date ranges, which doesn't compose with a general filter UI.

### Technical deep dive

- **How export works:** template card "Export" → `RunExportDialog` (template params,
  destination) → `hub.runExport(request)` → provider appends a job with `planSteps(request)` →
  `executeExport` runs steps, emitting progress to the job → on completion the entry is committed
  to history (and `schedule.lastRunAt` if scheduled), toast shown → `ActivityTray` shows
  per-step progress; share-link results open `ShareLinkDialog`.
- **File generation approach:** templates return `{ filename, mimeType, content: string,
recordCount }`. CSV via `escapeCsvCell` + BOM; JSON via `JSON.stringify`. Size is measured
  with `TextEncoder`; fingerprint is SHA-256 of the content. Delivery: `downloadFile`
  (download), `navigator.share({ files: [File] })` (device), or `sleep` (simulated).
- **User interaction:** a dedicated page with four tabs, a modal run flow, a floating activity
  tray, a header status pill and a nav badge for due schedules.
- **State management:** a context provider holding persisted `HubState` plus in-memory `jobs`;
  refs mirror state and expenses for async callbacks; derived `dueSchedules` from `now`;
  component-local state for forms.
- **Edge cases:**
  - Financial-year boundaries (30 Jun / 1 Jul) tested.
  - Monthly schedules clamp to month end (31 Jan → 28 Feb).
  - Paused schedules never due.
  - Disconnecting a service removes its schedules.
  - Cancelled share sheet recorded as a failed run, not a crash.
  - Corrupt hub storage tolerated.
  - Device share unsupported → destination hidden.
  - Safari user-activation rule handled by sharing before hashing.

---

## Cross-version comparison

### Architecture

| Concern           | V1                       | V2                             | V3                                             |
| ----------------- | ------------------------ | ------------------------------ | ---------------------------------------------- |
| Module boundary   | none (inside `expenses`) | `expenses/export/` sub-module  | separate `features/exports/`                   |
| Pure domain layer | reuses existing          | `options.ts`, `formats/*`      | `domain/*`                                     |
| Extension point   | none                     | format registry                | template table + delivery step                 |
| Global footprint  | none                     | provider at root (eager panel) | provider, tray, pill at root; route-split page |
| Persisted state   | none                     | none                           | yes (hub key)                                  |

### Error handling maturity

V1 handles the only failure that matters (download) with a toast. V2 adds validation, a busy
state, double-submit protection and an inline failure that keeps user input. V3 adds per-step
failure recording, storage resilience and structured error messages, but also introduces failure
modes that only exist because of its scope (lost in-memory jobs, PII in history).

### What each does best

- **V1**: the one-click interaction for the most common need, at almost no cost.
- **V2**: control and confidence (filters, preview, summary), a real PDF report, the cleanest
  architecture for extending formats.
- **V3**: genuinely useful _real_ ideas: financial-year tax report, redaction, Web Share API
  sharing, and a reason to remind users to back up. Its simulated integrations add cost
  without user value in a browser-only app.

### Recommendation this analysis supports

Adopt V2's dialog and format registry as the base; keep V1's one-click CSV as the primary action;
port V3's templates (as CSV layouts over the dialog's filters), redaction, Web Share and a
simplified backup reminder; drop V3's simulated integrations, connections, tray, sync pill,
history table and fingerprints; code-split the dialog to remove V2's +5 kB per page.

This combination has been built on `feature-data-export-hybrid` (provenance and measurements in
`docs/wip/export-hybrid.md` on that branch): `/` 112 kB, `/expenses` 103 kB, 181 tests.

## Not verified

- None of the branches was checked at phone width or in light mode.
- Real downloads and the device share sheet were exercised by automated tests, not manually.
- Bundle sizes come from builds made during development, not a fresh side-by-side build.
