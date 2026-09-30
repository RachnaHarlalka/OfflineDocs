## Tests written

All 4 scenarios written in `apps/web/lib/documents/use-presence.test.ts` (the file assigned to
me by the partition, which takes precedence over the per-scenario "Target file" field —
`doc-editor.draft-restore.test.tsx` — carried over from the shared plan; noted below under
Observations).

| Test | File | Level | AC | Failed-when-broken | Status |
|---|---|---|---|---|---|
| TS-1 — reads the draft backup exactly once per mount — not polled, not refetched on focus | use-presence.test.ts | hook (renderHook + QueryClientProvider) | AC-201 | `staleTime: Infinity` → `staleTime: 0` | proven red, then green |
| TS-11 — beats with presence only while the backup read is unsettled, then resumes carrying it | use-presence.test.ts | hook, composes `useOwnDraft` + `useDraftBackup` | AC-211 | drop the `allowed` (`!ownDraft.isPending`) conjunct from the heartbeat payload ternary | proven red, then green |
| TS-12 — a failed read settles without retry-storming, and backups resume on the next heartbeat | use-presence.test.ts | hook, composed | AC-212 | `retry: false` → `retry: 3` | proven red, then green |
| TS-13 — a null backup settles like any other answer and does not block later backups | use-presence.test.ts | hook, composed | AC-213 | `enabled` → `enabled: false` (query never settles, mirrors "gate never opens") | proven red, then green |

All 4 mutations were hand-applied to `use-presence.ts`, run against the test file, confirmed
red for the right reason, then reverted (`git status --short` on the source file shows no diff
after each revert — confirmed after every mutation, most recently after TS-1's). Manifest is at
`.qa/runs/proof-w03.json`.

Note on level: the scenarios ask for a doc-editor-mounted component test, but my assigned
source is `use-presence.ts` only and I do not own `doc-editor.tsx`. TS-11/12/13 compose the two
real exported hooks (`useOwnDraft`, `useDraftBackup`) in a small local test harness that mirrors
doc-editor.tsx's actual gate (`canBackUp: !isViewer && !ownDraft.isPending`, viewer branch
dropped since these scenarios are all an online owner) — this exercises the real ordering
property between the two hooks, just without the surrounding DOM/editor chrome. TS-1 tests
`useOwnDraft` alone since it only concerns the read itself.

## TS-12 verdict — read this first

**TS-12 is GREEN against unmodified source.**

The test asserts, in this order: (1) `fetchOwnDraft` is called exactly once even after 30s of
fake-timer advancement (no retry storm — `retry: false` holds); (2) `ownDraft.isError` becomes
`true`; (3) the *next* heartbeat after that carries the local draft payload
(`sendHeartbeat("doc-1", { update: "ZW5jb2RlZA==" })`) rather than presence-only.

That third assertion is the one H-1 calls dangerous, and it is exactly what the basis text says:

> AC-212, quoted from the brief: "Given the backup read fails (network/5xx), when the editor
> renders, then it works normally, no notice appears, the request is not retried, and **backups
> resume on the next heartbeat**."

There is no carve-out in that sentence for "resume, but only once the user has had a chance to
see and act on whatever the read would have offered" — it says resume on the next heartbeat,
full stop, and that is what `retry: false` + `isPending` settling to `false` on error produces.
So my empirical result **supports** the separate planner pass's reading: AC-212 as written
mandates the exact sequence H-1 flags as silent data loss. This is not a case where my test
disagrees with the code — the code does what AC-212 says, and the question is whether AC-212
itself is wrong. That is a product decision I'm handing to the developer, not something I can
resolve by rewriting the assertion.

## Source changes

None. `use-presence.ts` is untouched; mutations were applied only transiently to prove the four
tests, then reverted before this report.

## Fix proposed, not applied

Not proposing a fix — this is not a defect in the code against the AC as written; it's a tension
inside the AC itself (AC-212's "resume on the next heartbeat" vs. the intent that a device should
read its own backup before writing over it, which AC-211 protects for the *first* read but not
for a *failed* one). That is a product decision (e.g., should a failed read count as "settled" for
gating purposes, or should it force a bounded number of retries / block backup until a later
successful read?) and belongs with the developer, not a source edit from me.

## Not written

Nothing — all 4 assigned scenarios (TS-1, TS-11, TS-12, TS-13) have tests, all proven.

## Prerequisites needed

None.

## Observations

- **Target-file mismatch**: each scenario's basis block names `doc-editor.draft-restore.test.tsx`
  as the target file, but the brief's "Write your tests here" section assigns
  `apps/web/lib/documents/use-presence.test.ts`, and the source I own is `use-presence.ts` only
  (not `doc-editor.tsx`). I followed the explicit assignment. If a full-mount, DOM-level version
  of these scenarios (with the actual `doc-editor.tsx` gate, restore notice, etc.) is still
  wanted, that's a separate brief against `doc-editor.tsx`/`draft-restore-notice.tsx`.
- **react-query focus-refetch gotcha for future test writers**: `@tanstack/query-core`'s
  `FocusManager` listens for `visibilitychange` on `window`, not a `focus` event — dispatching
  `window.dispatchEvent(new Event("focus"))` is silently a no-op in tests. TS-1 dispatches
  `window.dispatchEvent(new Event("visibilitychange"))`, verified to actually trigger a refetch
  attempt when `staleTime` is mutated away from `Infinity`.
- **H-1 (critical, from the hunt pass) is confirmed live against unmodified source** via TS-12,
  as detailed above — flagging again here since it is the most important finding in this wave.
