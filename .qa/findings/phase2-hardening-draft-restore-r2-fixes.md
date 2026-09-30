# r2 fix wave — W-1 / W-3 / W-5 / W-7

## W-1 — apps/server/src/middleware/error-handler.ts (V-1)
Added `fromBodyParserError`, matching on the body-parser error `.type` values
(`entity.too.large` → 413, `entity.parse.failed` → 400, `charset.unsupported` /
`encoding.unsupported` → 415), translated to the existing `AppError` factories
before the generic-500 fallback — addresses the full blast radius (413/400/415),
not just 413, per work order instruction, while staying narrow (matched by known
body-parser `.type` strings, not "any error with a `.status`").
Gating test (`app.test.ts`, TS-16b): **PASS**.

## W-3 — apps/web/lib/offline/save-queue.ts (V-2)
`enqueueSave` now sizes the item by `TextEncoder().encode(JSON.stringify({ update
})).length` — the same envelope `public/sw.js:255` transmits — instead of raw
`input.update.length`. Checked the audio path (watch note, :181-182/:300-301):
`enqueueAudio` sends via `FormData` (`lib/api/dictation.ts`), not the JSON
envelope, so it has no equivalent overhead gap and was left untouched.
Gating test (`app.test.ts`, TS-21): **PASS**.

## W-5 — apps/web/lib/documents/use-yjs-doc.ts (V-3)
`hasContentBeyond` no longer delegates to the vector-only `hasUpdatesBeyond`.
It now merges the backup update into a clone of the live doc's current state and
compares resulting text to the live text — a pure deletion in the backup now
changes the merged text and is detected. `hasUpdatesBeyond` itself, and the
`isDirty` oracle at `reconcileWithServer` (:236) that shares it, were left
unchanged per the scope limit.
Gating test (W-4, delete-only backup restorable): **PASS**. TS-9 pair
(AC-209) still green.

Side effect on W-4b (out of scope, isDirty): checked — my fix does **not**
resolve it. `keeps isDirty true when reconcileWithServer's snapshot does not
include the local deletion` is still RED (`expected false to be true`) because
`reconcileWithServer` computes `outstanding` via `hasUpdatesBeyond`, untouched.
This is the correct, expected outcome for this round.

## W-7 — apps/web/lib/pwa/use-service-worker.ts (V-5)
Factored the `statechange` watcher into `watchInstalling(installing)` and call
it both for `registration.installing` at mount (the missed case) and from the
existing `updatefound` listener. `registration.waiting` arm and the load-time
`SKIP_WAITING` (V-4, undecided-spec) were not touched.
Gating test (W-6, installing-at-mount → updateReady): **PASS**.

## Test run summary
- `pnpm exec vitest run --project server src/app.test.ts` — 4/4 passed.
- `pnpm exec vitest run --project web lib/documents/use-yjs-doc.test.ts lib/pwa/use-service-worker.test.ts`
  — 15/16 passed; the 1 failure is W-4b (`H-10 also_check`, isDirty path),
  correctly still red — no verdict authorises fixing it this round.

## Files touched (source only)
- apps/server/src/middleware/error-handler.ts
- apps/web/lib/offline/save-queue.ts
- apps/web/lib/documents/use-yjs-doc.ts
- apps/web/lib/pwa/use-service-worker.ts

No test file was edited. `apps/web/lib/documents/use-yjs-doc.test.ts` and
`apps/web/components/documents/doc-editor.test.tsx` show as modified in `git
status` but that predates this session (present in the initial git status
snapshot handed to this agent); this wave made no writes to either.
