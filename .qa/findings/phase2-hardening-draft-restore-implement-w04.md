# w04 implement report — draft-restore / service-worker

## Tests written

| Test | File | Level | AC | Failed-when-broken | Status |
|---|---|---|---|---|---|
| TS-8 | apps/web/components/documents/draft-restore-notice.test.tsx ("calls onDismiss and never onRestore when Not now is pressed") | component | AC-208 | Yes — proven | Proven (green on real source, red under mutation) |
| TS-9 | apps/web/lib/documents/use-yjs-doc.test.ts ("TS-9: is false when the backup holds only what the document already has") | component (hook, live Y.Doc) | AC-209 | Yes — proven | Proven (green on real source, red under mutation) |
| TS-9 contrast | apps/web/lib/documents/use-yjs-doc.test.ts ("TS-9 contrast: is true when the backup holds content the document does not") | component | AC-209 | Not separately proven (sanity check only, not in manifest) | Written, passing, unproven |
| TS-18 | e2e/sw-update.spec.ts | e2e | AC-221 | — | **Not written** — see blocker below |
| TS-19 | e2e/sw-update.spec.ts | e2e | AC-222 | — | **Not written** — see blocker below |

## Proof manifest — `.qa/runs/proof-w04.json`, result in `.qa/runs/proof-w04-result.json`

Ran via `qa-prove.mjs run --manifest .qa/runs/proof-w04.json`:

```
proven   calls onDismiss and never onRestore when Not now is pressed
proven   TS-9: is false when the backup holds only what the document already has

proven 2/2
```

Both TS-8 and TS-9 are proven: green against unmodified source, and turn red under the
declared mutation (verified by qa-prove, which applies the mutation, reruns, and reverts).
Nothing came back unproven or red-already — the 2/2 above is the full manifest, both entries
proved cleanly.

## TS-19 / H-5 — could not be determined

**I did not get a GREEN or RED verdict for TS-19 against unmodified source.** No e2e test for
TS-18 or TS-19 was written, so H-5 (watchForUpdate posting SKIP_WAITING to any waiting worker
unconditionally, allegedly stranding a mid-edit tab) is neither confirmed nor ruled out by this
wave. That is a gap, not a finding either way — do not read "not written" as "passes."

## Blocker — e2e output path rejected by the write-guard hook

My brief's "Write your tests here, and nowhere else" list is:
- `apps/web/lib/pwa/use-service-worker.test.ts`
- `draft-restore-notice.test.tsx`
- `use-yjs-doc.test.ts`

None of these are e2e-compatible (Playwright's `testDir` is `./e2e`, and these three are
Vitest unit/component paths). TS-18 and TS-19 both name `e2e/sw-update.spec.ts` as their
**Target file** in the scenario table, but that path is not in the assigned stem list.

Writing `e2e/sw-update.spec.ts` was denied by `hook-guard-mode.mjs`:

```
qa-kit: e2e/sw-update.spec.ts was not assigned to any brief in this run.
```

I tried adding a suffix to my `use-service-worker.test.ts` stem instead, but Playwright only
discovers specs under `e2e/` per `playwright.config.ts` (`testDir: "./e2e"`), so a file at
`apps/web/lib/pwa/use-service-worker.e2e.spec.ts` would silently never run — not a real fix,
just a different way to fail quietly. I stopped rather than either guess at an unclaimed path
or fabricate a runnable-but-undiscovered file.

**Prerequisite needed:** the partition needs an e2e output path (e.g. `e2e/sw-update.spec.ts`)
added to my claimed stems, or TS-18/TS-19 reassigned to whichever brief does own an e2e stem.

**Before I could reach a GREEN/RED verdict even once unblocked:** `NEXT_PUBLIC_SW_VERSION` is
baked into the running build at compile time (`apps/web/next.config.ts`), not something a test
can bump between loads the way the scenario setup literally describes. The realistic e2e
approach is to call `navigator.serviceWorker.register("/sw.js?v=<new-tag>...")` directly from
the page (same scope, different scriptURL) to simulate a second deploy — this is a real update
as far as the Service Worker spec and `use-service-worker.ts`'s own `registration`/`updatefound`
wiring are concerned, and is what I had drafted before the path was rejected. Flagging this so
whoever picks up TS-18/TS-19 doesn't have to re-derive it.

## e2e status

**Did not run.** Blocked before the file could be written (see above) — not an auth or
Postgres problem. Auth setup (`e2e/setup/auth.setup.ts`, role storage states, `seed:e2e`) is in
place and both dev servers (`:4000` web, `:3000` server) were already up when I checked, so
once the output path is resolved there is no environment blocker left.

## Source changes

None.

## Fix proposed, not applied

Left empty. I have not seen TS-19 fail against unmodified source, so I have no basis (per
oracle-rules: never propose a fix before the gating test is proven red) to name a cause here.
The hunt-pass note in my brief already names a specific hypothesis (the unconditional
`registration.waiting.postMessage({ type: "SKIP_WAITING" })` in `watchForUpdate`) — whoever
writes TS-18/TS-19 should re-examine that once the test exists, not take my word for it.

## Not written

| Scenario | Why | What would unblock it |
|---|---|---|
| TS-18 | e2e output path `e2e/sw-update.spec.ts` rejected by write-guard (not in claimed stems) | Add an e2e stem to this brief's claim, or move TS-18/19 to a brief that has one |
| TS-19 | Same blocker | Same |

## Prerequisites needed

- An e2e output path for this brief (or reassignment of TS-18/TS-19 to a brief that has one).
- Confirmation of the intended way to simulate a second SW version in e2e, since
  `NEXT_PUBLIC_SW_VERSION` is a build-time env var, not something bumpable mid-run — see
  drafted approach above (`register()` a second scriptURL with a bumped `v` query param).

## Observations

None beyond what the brief's H-5 note already states. I could not independently confirm or
refute H-5 this round — see "TS-19 / H-5" above.
