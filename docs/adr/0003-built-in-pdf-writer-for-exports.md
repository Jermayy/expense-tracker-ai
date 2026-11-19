# 0003 · Generate PDF exports with a small built-in writer

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The export dialog offers CSV, JSON and PDF. CSV and JSON are plain text. PDF needs a file
generator that runs in the browser, because the app is a static export with no server (ADR 0001),
under a CSP that only allows the site's own origin (ADR 0002). The report is simple: a title,
two summary figures, the filters used, and a paginated table with a total.

## Options considered

1. **A PDF library (e.g. jsPDF, pdf-lib)**: full-featured, with font embedding and Unicode. Adds
   a dependency of a few hundred kB to audit and keep patched, and some features load optional
   modules dynamically, which needs checking against the CSP.
2. **`window.print()` with a print stylesheet**: no code to generate PDFs, but the user has to
   pick "Save as PDF" in the print dialog, and the result depends on the browser.
3. **A small writer in the repo** (`src/features/expenses/export/formats/pdfDocument.ts`):
   about 180 lines that write text, lines and rectangles with the 14 standard PDF fonts, which
   need no embedding.

## Decision

Option 3. The report only needs Helvetica text and simple shapes, and the writer is pure and
deterministic, so it's unit-tested for structure (valid xref offsets, page count) and content.
It was checked by rendering the output with macOS Quick Look.

## Consequences

- No new dependency, nothing loaded at runtime, no CSP changes.
- Text is limited to the WinAnsi character set (Latin-1 plus typographic punctuation such as
  curly quotes, dashes and €). Other characters (emoji, CJK, most non-Latin scripts) appear as
  "?" in the PDF. CSV and JSON keep the full text.
- Text width uses Helvetica metrics. Accented letters use an average width, so truncation of
  long descriptions is approximate for them.
- Revisit if exports need full Unicode, charts, or custom fonts: switch to option 1 and
  lazy-load it only when PDF is chosen.
