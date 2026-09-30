## Tests written

| Test | File | Level | AC | Failed-when-broken | Status |
|---|---|---|---|---|---|
| TS-2 — never requests or offers a backup for a viewer | apps/web/components/documents/doc-editor.test.tsx | component | AC-202 | `!isViewer` dropped from `useOwnDraft`'s enabled flag | Passing, proof manifest entry written |
| TS-3 — never requests or offers a backup while offline | apps/web/components/documents/doc-editor.test.tsx | component | AC-203 | `online &&` conjunct removed from `useOwnDraft`'s enabled flag | Passing, proof manifest entry written |
| TS-4 — status region with specified title, relative time, named actions | apps/web/components/documents/draft-restore-notice.test.tsx | component | AC-204, AC-214 | `role="status"` removed from the notice container | Passing, proof manifest entry written |
| TS-5 — keeps the backup's text out of the body until Restore is pressed | apps/web/components/documents/doc-editor.test.tsx | component | AC-205 | the offer effect auto-calls `restoreDraft` instead of only setting `restorableDraft` | Passing, proof manifest entry written |

All 4 scenarios covered. `pnpm exec vitest run --project web components/documents/doc-editor.test.tsx components/documents/draft-restore-notice.test.tsx` — 2 files, 12 tests, all passing.

## Assigned-path note

The brief's "Write your tests here, and nowhere else" list names `doc-editor.test.tsx` (not `doc-editor.draft-restore.test.tsx`, which the scenario table's "Target file" field suggested). TS-2, TS-3 and TS-5 were appended to the existing `doc-editor.test.tsx` instead, since the guard hook rejects any other path and the brief's assigned-paths list takes precedence. TS-4 went into the assigned `draft-restore-notice.test.tsx` as a fresh file.

## Source changes

None. `apps/web/components/documents/doc-editor.tsx` and `draft-restore-notice.tsx` were read only.

## Proof manifest

Written to `.qa/runs/proof-w01.json`, 4 entries, one per test above. Runner is `pnpm exec vitest run` with repo-relative paths, no `cd` prefix.

## Not written

Nothing — all 4 assigned scenarios (TS-2, TS-3, TS-4, TS-5) got tests.

## Prerequisites needed

None. Existing fixtures (`makeDoc`, `makeSnapshot`, `renderDocEditor`, `setOnline`) and the `@/lib/api/presence` mock idiom from `doc-editor.revoked.test.tsx` / `doc-editor.dictation.test.tsx` covered everything needed.

## Observations

None beyond what `apps/web/lib/api/presence.draft-restore.test.tsx` (TS-19, another agent's file, already in git status) already documents about the previously write-only backup — that gap is now closed by the source under test here.

Tool-call count: ~24, within the ~30 target.
