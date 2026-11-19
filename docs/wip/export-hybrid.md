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
