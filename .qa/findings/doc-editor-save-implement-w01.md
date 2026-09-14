## Tests written

| Test | File | Level | AC | Failed-when-broken | Status |
|---|---|---|---|---|---|
| shows Draft and both placeholders before a never-saved document is touched | doc-editor.test.tsx | component | AC-1,2,3 | isDirty init switched to `false` | proof pending |
| flips Saved to Draft and enables Save the moment the user types | doc-editor.test.tsx | component | AC-4,16,17,22 | `setIsDirty(true)` dropped from onUpdate | proof pending |
| cycles Saving… to Saved and sends exactly one request per click-through | doc-editor.test.tsx | component | AC-18,23,24,25 | pending guard dropped from handleSave | proof pending |
| on a failed save shows banner/badge, keeps content, Retry resends | doc-editor.test.tsx | component | AC-27,28,29,30 | syncState "error"→"draft" swap | proof pending |
| stays editable offline, disables Save, no auto-save on reconnect | doc-editor.test.tsx | component | AC-21,33,34,35,36 | `getOnlineSnapshot` hardcoded `true` | proof pending |
| Cmd+S / Ctrl+S triggers save and suppresses dialog (it.each ×2) | doc-editor.test.tsx | component | AC-19 | `preventDefault()` dropped | proof pending |
| shortcut no-ops when nothing to save / viewer | doc-editor.test.tsx | component | AC-19 | `canSave` hardcoded `true` | proof pending |
| renders no Save control anywhere, shows View only badge | doc-editor.viewer.test.tsx | component | AC-20,48 | mobile Save block's `isViewer` guard dropped | proof pending |
| title and body visible but not editable for a viewer | doc-editor.viewer.test.tsx | component | AC-45,46 | `readOnly={isViewer}` → `readOnly={false}` | proof pending |
| no offline/save-failed banner ever shown for a viewer | doc-editor.viewer.test.tsx | component | AC-47 | offline banner's `!isViewer &&` guard dropped | proof pending |
| Enter commits changed title immediately, body untouched | doc-editor.title.test.tsx | component | AC-7,13,14 | Enter's `blur()` call removed | proof pending |
| Escape reverts without committing | doc-editor.title.test.tsx | component | AC-10 | Escape's `setTitle(doc.title)` removed | proof pending |
| empty title on blur: no call, reverts | doc-editor.title.test.tsx | component | AC-11 | commit guard forced `if (false)` | proof pending |
| whitespace-only title on blur: no call, reverts | doc-editor.title.test.tsx | component | AC-11 | commit guard forced `if (false)` | proof pending |
| unchanged title on blur: no call | doc-editor.title.test.tsx | component | AC-12 | commit guard forced `if (false)` | proof pending |

15 tests across 4 files. Mutation-testing itself (running the manifest, checking each test goes red for the right reason) is `qa-runner`'s job — not run here per instructions. Manifest: `.qa/runs/proof-w01.json`.

## Source changes

**`apps/web/vitest.setup.ts`** — added `vi.mock("y-indexeddb", ...)` stubbing `IndexeddbPersistence` with an inert class (`destroy()` no-op). jsdom has no IndexedDB, and `fake-indexeddb` is not currently an installed dependency (checked `pnpm-lock.yaml` and `node_modules` — absent), so adding it would violate `allow_new_dependencies: false`. IndexedDB is a process boundary (like the filesystem), so mocking it there — rather than adding a new dependency — matches the mocking rule. This is test-harness infrastructure, not application source; `doc-editor.tsx` itself was not touched.

No `data-testid` or accessible-name additions were needed — role, placeholder and text selectors from `labels.ts` covered every scenario.

## Not written

None of the 8 assigned scenarios (TS-10–TS-17) were dropped. TS-16's rename-failure sub-case was excluded per your decision 5, AC-9 (navigate-away-commits) per the plan's own note, and the `role: "editor"` variant per UNKNOWN-2 — all as instructed in the brief.

## Prerequisites needed

None beyond what's already installed (`yjs`, `y-indexeddb`, `@tanstack/react-query`, `@testing-library/react` + `user-event` are all present).

## Observations

1. **`bytesToBase64` in `apps/web/lib/documents/base64.ts` masks every byte with `& 0x7f`** before converting to a char and calling `btoa`, while `base64ToBytes` reads the decoded char codes back unmasked. Any byte ≥ 0x80 in a Yjs update is silently corrupted (top bit dropped) on encode, with no matching correction on decode. This looks like it should be `& 0xff` (the standard binary-string-safe mask). I avoided all-ASCII test fixtures to sidestep it, but it's a live risk for any multi-byte content going through Save. Flagging for `qa-adversary`/`qa-triager` — not fixed here (not my file, and not the file I own this wave).
2. **Developer decision 4** (owner+editor may both rename; PATCH-owner-only is a product bug) is a **server-side authz** concern (`apps/server/src/middleware/require-role.ts` / the PATCH route), not something this client component test can exercise — the component always fires the rename call regardless of role gating on the server. Flagging so the server-side wave covers it; not testable from `doc-editor.tsx`.
3. The save-failure banner (`saveDoc.isError` block in `doc-editor.tsx`) has **no `role="alert"`** — TS-13's plan text says it should be "exposed as an alert," but no AC quote in the basis actually requires that role, so I did not assert it (would have been a guaranteed-red test asserting an unspecified requirement, not a real regression signal) and did not add the role via the testid/accessible-name exception since a role isn't in the allowed list. Worth a follow-up AC/decision if a11y-live-region behavior is wanted here.
