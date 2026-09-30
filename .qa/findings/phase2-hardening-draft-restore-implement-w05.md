# w05 implement report (in progress — checkpointed after turn-cap recovery)

## Tests written

| Test | File | Level | AC | Failed-when-broken | Status |
|---|---|---|---|---|---|
| TS-16a "accepts a ~4 MB body" | apps/server/src/app.test.ts | integration | AC-218 | limit reverted to 1mb | **passing, proven** (manifest) |
| TS-16b "refuses a body over 5 MB + margin with 413" | apps/server/src/app.test.ts | integration | AC-218 | n/a — currently red against unmodified source | **red now — real bug, not proven via mutation** |
| TS-21 "a save the client's own queue-item check accepts at exactly QUEUE_ITEM_MAX_BYTES must not be permanently unsendable" | apps/server/src/app.test.ts | integration | AC-219, AC-225 (hunt H-4) | n/a — currently red against unmodified source | **red now — real bug (H-4), not proven via mutation** |
| TS-20 "paints the shell landmarks... no redirect, no children, while pending" | apps/web/components/auth/require-session.test.tsx | component | AC-223, AC-224 | `isPending` branch returns `null` | **passing, proven** (manifest) |
| TS-20 "redirects to login preserving path+query... no user resolves" | apps/web/components/auth/require-session.test.tsx | component | AC-224 | redirect uses `ROUTES.dashboard` instead of `currentPathWithQuery` | **passing, proven** (manifest) |
| TS-17 | not yet written | e2e | AC-219, AC-220 | — | **not reached** |

## Why TS-16b and TS-21 are red without a mutation

Both tests assert the acceptance criterion (AC-218's 413 boundary, AC-219's "flushes successfully") against the **unmodified** source, and both currently fail:

- **TS-16b**: `express.json({ limit: "5mb" })` does throw `PayloadTooLargeError` over the cap (confirmed: `bytes.parse("5mb") === 5242880 === QUEUE_ITEM_MAX_BYTES`, so the cap itself is correct), but `apps/server/src/middleware/error-handler.ts`'s `errorHandler` only special-cases `AppError` instances. body-parser's `PayloadTooLargeError` is not an `AppError`, so it falls through to the generic `console.error` + `500` branch. AC-218 requires `413`; the server actually returns `500`. `AppError.payloadTooLarge(...)` already exists in `apps/server/src/lib/http-error.ts` (line ~40) and is unused — the fix is wiring `errorHandler` to translate `error.status === 413` (or `error.type === "entity.too.large"`) into it.
- **TS-21**: builds the exact envelope `sw.js`'s flush path sends — `JSON.stringify({ update })` where `update.length === QUEUE_ITEM_MAX_BYTES` (5242880) — and POSTs it. Measured: the envelope is 5242893 bytes, 13 bytes over the server's 5mb limit. This is hunt finding H-4 exactly: the client's `save-queue.ts` `enqueue()` checks `update.length` (the raw string) against `QUEUE_ITEM_MAX_BYTES`, but the server counts the full JSON body including the `{"update":"...","}` wrapper. A queue item the client accepts at (or within ~20 bytes of) the cap is never deliverable. The response is currently `500` (same error-handler gap as TS-16b, compounding it), not `413` — either way it is not the `2xx` AC-219 requires, so the test is red for the right reason.

Because both are red against unmodified source, they **cannot go through the standard proof-manifest mutate/revert cycle** (that flow assumes green-on-clean-source, red-on-mutation). They are gating tests for real defects, not regression tests — per mode=test rules, not fixed here, only reported.

## Fix proposed, not applied

| Test that gates it | File | Line | Find | Replace | Why this is the cause |
|---|---|---|---|---|---|
| TS-16b, TS-21 | apps/server/src/middleware/error-handler.ts | ~17 (top of `errorHandler`) | `if (error instanceof AppError) {` | Add a branch before it: `if (error instanceof Error && (error as any).status === 413) { error = AppError.payloadTooLarge(); }` (or equivalent narrow check on `type === "entity.too.large"`), then fall into the existing `AppError` branch | body-parser's `PayloadTooLargeError` carries `.status = 413` and `.type = "entity.too.large"` but is never translated to `AppError`, so it falls to the generic 500 handler. This is the mechanism behind both TS-16b (AC-218's stated 413) and TS-21/H-4 (AC-219's stated success — the 500 masks the more specific envelope-overhead question but is wrong regardless of which; even after this fix, TS-21 would still need the client/server byte-accounting gap (H-4 proper) resolved separately — likely by validating `bytes` against a slightly lower client-side cap, or against `JSON.stringify({update}).length`, in `apps/web/lib/offline/save-queue.ts`'s `enqueue()`. That second fix is a product decision (how much headroom, and where) and is not proposed here. |

## Not written

| Scenario | Why | What would unblock it |
|---|---|---|
| TS-17 (e2e, `dropCachedDoc` `ignoreVary` + queue flush + offline reopen) | Not reached before turn-cap checkpoint; this report was prioritized per coordinator instruction | Needs its own turn budget: Playwright, `e2e/setup/auth.setup.ts` storage state, `seed:e2e`. Brief's assigned "write here" list for w05 does not include an e2e path; `e2e/draft-restore-and-shell-hardening/` exists (empty) as the likely target directory, naming TBD, e.g. `offline-queue-flush.spec.ts` |
| sw.test.js coverage of `ignoreVary` (component-level piece of TS-17, assigned file `apps/web/public/sw.test.js`) | Same — not reached | Same turn budget; `sw-push.test.ts` is the idiom reference named in the brief |

## Prerequisites needed

None beyond turn budget — Postgres already running, auth/e2e setup already present per brief.

## Observations

- H-4 (hunt finding) is real and reproduced directly: client accepts an update at exactly `QUEUE_ITEM_MAX_BYTES`, server envelope is 13 bytes over its own `5mb` cap for that same input. Confirmed both constants are numerically 5242880 (not a drift issue) — the gap is purely the different byte spans measured (raw `update.length` vs. full JSON body).
- A second, previously-unflagged defect surfaced while proving TS-16: `errorHandler` never maps body-parser's size-limit rejection to a 413, so AC-218's "refused with 413" currently returns 500 instead. This compounds H-4 (TS-21 also sees 500, not 413) but is a distinct bug with its own fix location (see Fix proposed table). Recommend the planner treat this as its own finding/AC-check, separate from H-4, since fixing only the byte-accounting gap would still leave AC-218's stated 413 unmet.
