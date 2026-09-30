# r2 test wave — W-2, W-4, W-6

## Tests written

| Test | File | Level | AC | Failed-when-broken | Status |
|---|---|---|---|---|---|
| W-2 positive: "accepts the largest envelope a correctly-sized client would send at the cap [AC-219] [AC-225] (hunt H-4)" | apps/server/src/app.test.ts | integration | AC-219, AC-225 | server limit lowered below the boundary (see proof manifest) | GREEN vs unmodified source |
| W-2 negative: "refuses with 413 the first envelope size a correctly-sized client would refuse [AC-219] [AC-225] (hunt H-4)" | apps/server/src/app.test.ts | integration | AC-219, AC-225 | server limit raised above the boundary (see proof manifest) | **RED** vs unmodified source (`500`, not `413` — V-1/W-1 not yet fixed) |
| W-4a: "H-10: is true when the backup differs from the document only by a deletion [AC-204] [AC-209]" | apps/web/lib/documents/use-yjs-doc.test.ts | unit | AC-204, AC-209 | `hasContentBeyond`/`hasUpdatesBeyond` gains no delete-set/content comparison | **RED** vs unmodified source, confirmed |
| W-4b (also_check): "keeps isDirty true when reconcileWithServer's snapshot does not include the local deletion" | apps/web/lib/documents/use-yjs-doc.test.ts | unit | (H-10 also_check, no basis AC — see Observations) | same predicate at `reconcileWithServer`'s outstanding check (:236) stays vector-only | **RED** vs unmodified source, confirmed |
| W-6: "raises updateReady once an installing worker reaches installed, single tab, no waiting worker [AC-222] (hunt H-12)" | apps/web/lib/pwa/use-service-worker.test.ts | unit | AC-222 | `watchForUpdate` gains a `registration.installing` arm at mount | **RED** vs unmodified source, confirmed |

All three target items done. Existing TS-9 pair (AC-209) in `use-yjs-doc.test.ts` and TS-16b (AC-218) in `app.test.ts` re-run clean, unaffected.

## W-2 detail — how it was re-pinned

Old TS-21 posted `base64OfLength(QUEUE_ITEM_MAX_BYTES)` (the *raw* boundary) and demanded 2xx — a premise the chosen client-side remedy (V-2, W-3) makes false. Re-pinned per the work order to the stronger, remedy-agnostic invariant: **the largest envelope (`JSON.stringify({ update })`) a correctly-sized client would send is server-accepted, and the first one such a client would refuse is server-refused with 413.** Both fixtures are sized from the envelope shape directly (`ENVELOPE_OVERHEAD = JSON.stringify({ update: "" }).length`, 13 bytes) — no client code is invoked, so the test does not depend on W-3 landing, only on the server's existing 5 MB/413 boundary (W-1). Confirmed:
- positive case: envelope exactly `QUEUE_ITEM_MAX_BYTES` (5,242,880) → server does not 413 it → **passes today**.
- negative case: envelope `QUEUE_ITEM_MAX_BYTES + 1` → server currently 500s (V-1's untranslated `PayloadTooLargeError`), not 413 → **red today**, will go green once W-1 lands.

## Source changes
None. No testids or exports were needed — all three targets were already reachable through existing hooks/exports (`useYjsDoc`, `useServiceWorker`) or plain HTTP (`app.test.ts`).

## Not written
None of the three assigned items were skipped.

## Prerequisites needed
None.

## Observations

- **W-4b is a distinct, unreported-until-now finding**, per the work order's `also_check`: the same vector-only `hasUpdatesBeyond` comparison used by `hasContentBeyond` is also `reconcileWithServer`'s `outstanding` oracle at use-yjs-doc.ts:236 (isDirty path). A delete-only local edit (device deletes text it typed/received, never re-adds anything) advances no client clock, so if `reconcileWithServer` is ever called with a snapshot that does *not* actually include that deletion, `isDirty` flips to `false` while `body` still disagrees with what the server holds — the same class of bug as H-10, one level up the call chain. This has **no AC in `.qa/basis/phase2-hardening-draft-restore.md`** (AC-215/216/217 cover *re-snapshot* dirtiness, not this); recommend the planner either fold it into V-3/W-5's fix scope (fixing `hasUpdatesBeyond` at the source, per W-5's `watch` note that it's "shared with the isDirty/outstanding path" and needs the planner's sign-off before changing in place) or open it as its own hunt item. Flagging to `qa-planner`, not fixing.

- W-2's proof-manifest mutation for the negative case (`"5mb"` → `"6mb"`) will independently verify the 413 boundary once W-1 lands, without depending on W-1's specific implementation.

## Fix proposed, not applied
Leaving empty here — W-1/W-3/W-5/W-7's fix details already live in `.qa/findings/phase2-hardening-draft-restore-implement-w05.md` and the work order itself (`fix_detail` fields); nothing new to add from this pass beyond the W-4b observation above.
