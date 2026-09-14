# Test Plan: Document editor — explicit Save, offline drafts, viewer lock

- **Basis:** .qa/basis/doc-editor-save.md
- **Session:** 20260914-055319-e25aa1d-u42r
- **Mode:** change-scoped (base `main`...`feature/edit-docs`, 17 changed files incl. 5 untracked)
- **Generated:** 2026-09-14
- **Shape:** `trophy` (from config) — thin unit, fat component/integration, thin e2e. Kept as configured: the change is a React-heavy frontend vertical sitting on four small pure modules, so the fat middle is right, but the four critical-path modules (`base64.ts`, `use-yjs-doc.ts`, `dirty-docs.ts`, `services/docs.ts`) are pure enough to deserve real unit coverage — that is where data loss actually happens.
- **Budget:** 20 scenarios (cap: `run.tier: auto` → standard = 20). 5 unit · 3 integration · 1 authz · 9 component · 2 e2e (e2e cap 5, using 2).
- **Selector policy (applies to every web scenario):** query by role/label first; assert copy against `apps/web/constants/labels.ts` (`EDITOR_LABELS`, `SYNC_STATE_LABELS`), never against inline string literals; no class, CSS-structure or `querySelector` selectors.
- **E2E readiness:** the config's "e2e blocked on auth" TODO is **stale**. `e2e/setup/auth.setup.ts` exists, `playwright.config.ts` wires a `setup` project plus `owner`/`editor`/`viewer`/`anon` projects, and `apps/server/src/scripts/seed-e2e.ts` mints one storage state per role and writes `e2e/.auth/fixtures.json` (all four files are present on disk). The seed was **not executed** during planning — it needs Postgres — so TS-19/TS-20 carry a "verify the seed runs green first" note.

## Risk table

| ID | Scenario | AC | Level | Size | Blast | Change | History | Silent | Priority | Band |
|---|---|---|---|---|---|---|---|---|---|---|
| TS-1 | base64 round-trip preserves every byte value | AC-31, AC-57 | unit | small | 5 | 5 | 1 | 5 | 21 | P0 (critical-path floor) |
| TS-2 | Encoded save payload reconstructs the typed text server-side | AC-18, AC-31 | unit | small | 5 | 5 | 1 | 5 | 21 | P0 (floor) |
| TS-3 | Keystrokes during an in-flight save stay outstanding | AC-32 | unit | small | 5 | 5 | 1 | 5 | 21 | P0 (floor) |
| TS-4 | Astral-plane characters survive an edit | AC-57, AC-15 | unit | small | 4 | 5 | 1 | 5 | 19 | P0 (floor) |
| TS-5 | Dirty-doc marker persists, clears, and degrades safely | AC-40, AC-42, AC-43 | unit | small | 3 | 5 | 1 | 4 | 16 | P0 (floor) |
| TS-6 | Save merges into the stored snapshot and advances updatedAt | AC-49, AC-31 | integration | medium | 5 | 5 | 1 | 4 | 20 | P0 (floor) |
| TS-7 | Two divergent saves both survive the merge | AC-50 | integration | medium | 5 | 4 | 1 | 5 | 20 | P0 (floor) |
| TS-8 | Malformed update rejected with 400, document untouched | AC-51, AC-52, AC-56 | integration | medium | 4 | 5 | 1 | 3 | 17 | P0 (floor) |
| TS-9 | Save endpoint role matrix: 403 / 404 / 401 | AC-53, AC-54, AC-55 | authz | small | 5 | 4 | 1 | 2 | 17 | P0 (floor) |
| TS-10 | Never-saved document opens Draft with both placeholders | AC-1, AC-2, AC-3 | component | small | 2 | 4 | 1 | 3 | 12 | P2 |
| TS-11 | Typing flips Saved → Draft and enables Save | AC-4, AC-16, AC-17, AC-22 | component | small | 3 | 4 | 1 | 2 | 13 | P2 |
| TS-12 | Successful save cycles Saving… → Saved and sends exactly one request | AC-18, AC-23, AC-24, AC-25 | component | medium | 4 | 5 | 1 | 3 | 17 | P1 |
| TS-13 | Failed save: banner, Save failed badge, content kept, Retry resends | AC-27, AC-28, AC-29, AC-30 | component | medium | 4 | 4 | 1 | 4 | 17 | P1 |
| TS-14 | Offline: badge, banner, both Saves disabled, typing still works | AC-21, AC-33, AC-34, AC-35, AC-36 | component | medium | 4 | 4 | 1 | 4 | 17 | P1 |
| TS-15 | Viewer sees a read-only canvas with no Save and a View only badge | AC-20, AC-45, AC-46, AC-47, AC-48 | component | small | 4 | 3 | 1 | 3 | 15 | P2 |
| TS-16 | Title commit / revert / no-op rules | AC-7, AC-10, AC-11, AC-12, AC-13, AC-14 | component | medium | 3 | 4 | 1 | 3 | 14 | P2 |
| TS-17 | Cmd+S and Ctrl+S save and suppress the browser dialog | AC-19 | component | small | 2 | 4 | 1 | 2 | 11 | P3 |
| TS-18 | Dashboard row and drawer badges follow this device's dirty set | AC-40, AC-41, AC-42 | component | medium | 3 | 5 | 1 | 4 | 17 | P1 |
| TS-19 | Saved text survives a real reload against the real API | AC-26, AC-31 | e2e | large | 5 | 5 | 1 | 3 | 19 | P0 (floor) |
| TS-20 | Unsaved draft survives closing the tab, and still reads Draft | AC-37, AC-38 | e2e | large | 5 | 4 | 1 | 5 | 20 | P0 (floor) |

Defect history is scored `1` throughout: `.qa/history/` does not exist and the repo has zero test files, so there is no escaped-defect record to weight with. Every P0 band above is either earned on score or floored by `risk.critical_paths` (`services/docs.ts`, `use-yjs-doc.ts`, `dirty-docs.ts`, `base64.ts`, `middleware/require-role.ts`).

## Scenarios

### TS-1 — base64 round-trip preserves every byte value  `P0` `unit` `AC-31` `AC-57`

- **Covers:** apps/web/lib/documents/base64.ts
- **Intent asserted:** Saved content must come back byte-for-byte on a later load (AC-31). The browser-side base64 codec is the first link in that chain: whatever it encodes is exactly what the server merges.
- **Level because:** n/a — this is the cheapest level.
- **Setup:** none. Pure functions.
- **Steps:** (1) Build `new Uint8Array(256)` filled with `0..255`. (2) `base64ToBytes(bytesToBase64(bytes))`. (3) Also round-trip an empty array and a 1-byte array `[0xff]`.
- **Expected:** The decoded array equals the input array element-for-element for all 256 values, including every byte ≥ `0x80`. Empty in, empty out.
- **Would fail if:** any lossy transform is applied during encoding — e.g. masking the byte (`bytes[i] & 0x7f`) or clamping to the ASCII range before `btoa`.
- **Target file:** apps/web/lib/documents/base64.test.ts
- **Notes:** Basis observation 1 records that the current code applies exactly this mask. Write the test from the criterion, not from the code, and let it report. This is the single highest-value assertion in the plan: bytes ≥ 0x80 are unavoidable in Yjs varint encoding, so a mask here breaks every save.

### TS-2 — Encoded save payload reconstructs the typed text server-side  `P0` `unit` `AC-18` `AC-31`

- **Covers:** apps/web/lib/documents/use-yjs-doc.ts
- **Intent asserted:** The payload the editor sends is a base64 Yjs update that, merged against the document's stored state, yields exactly what the user typed (AC-18, AC-31).
- **Level because:** n/a — unit.
- **Setup:** `renderHook(() => useYjsDoc("doc-1", null))`; provide `indexedDB` via `fake-indexeddb/auto` in the web vitest setup (see Level gaps).
- **Steps:** (1) `act(() => result.current.setBody("hello world"))`. (2) `const payload = result.current.encodeUpdate()`. (3) In a fresh `new Y.Doc()`, `Y.applyUpdate(fresh, base64ToBytes(payload))`. (4) Read `fresh.getText("body").toString()`.
- **Expected:** `"hello world"`, exactly. Repeat with a seeded doc: seed `useYjsDoc("doc-1", <base64 of a Y.Doc containing "abc">)`, append `"def"`, apply the payload to a doc already holding `"abc"`, and expect `"abcdef"` — i.e. the payload is a delta against the last synced state, not a blind replacement.
- **Would fail if:** `encodeUpdate` encoded the full state instead of the delta from `lastSyncedVector` **and** that difference changed the merged result; or the base64 encoding mangles the bytes (this test fails alongside TS-1, which localises the cause).
- **Target file:** apps/web/lib/documents/use-yjs-doc.test.ts
- **Notes:** Deliberate overlap with TS-1: TS-1 names the defect, TS-2 proves the user-visible consequence. Both are cheap.

### TS-3 — Keystrokes during an in-flight save stay outstanding  `P0` `unit` `AC-32`

- **Covers:** apps/web/lib/documents/use-yjs-doc.ts
- **Intent asserted:** Text typed while a save request is in flight never reached the server, so after that save succeeds the document must still read as having unsaved changes and those keystrokes must be included in the next save (AC-32).
- **Level because:** n/a — unit.
- **Setup:** `renderHook(() => useYjsDoc("doc-1", <base64 snapshot of "a">))`.
- **Steps:** (1) `setBody("ab")`. (2) `const first = encodeUpdate()` — simulating the request leaving. (3) `setBody("abc")` — the keystroke during the flight. (4) `markSaved()` — the response arriving. (5) `const second = encodeUpdate()`; apply `first` then `second` to a fresh doc seeded with `"a"`.
- **Expected:** After step 4 `isDirty` is `true`. After step 5 the reconstructed text is `"abc"` — the `"c"` is carried by the second payload, not lost between them.
- **Would fail if:** `markSaved` committed the *current* state vector rather than the one captured at `encodeUpdate` time — the classic silent-data-loss bug, where the badge says Saved and the last keystrokes are dropped from every future delta.
- **Target file:** apps/web/lib/documents/use-yjs-doc.test.ts
- **Notes:** Also assert `markSaved()` with no preceding `encodeUpdate()` leaves `isDirty` unchanged — a false "Saved" is the worst possible lie from this badge.

### TS-4 — Astral-plane characters survive an edit  `P0` `unit` `AC-57` `AC-15`

- **Covers:** apps/web/lib/documents/use-yjs-doc.ts
- **Intent asserted:** Plain-text body content is preserved exactly, including emoji and other surrogate-pair characters — nothing the user types is silently replaced (AC-57, AC-15, AC-29).
- **Level because:** n/a — unit.
- **Setup:** `renderHook(() => useYjsDoc("doc-1", null))`.
- **Steps:** (1) `setBody("a😀b")`. (2) `setBody("a😀bc")` — append after an emoji. (3) `setBody("a🙂b")` — replace one emoji with another that shares its lead surrogate. (4) `setBody("ab")` — delete the emoji entirely. Read `body` after each.
- **Expected:** `"a😀b"`, `"a😀bc"`, `"a🙂b"`, `"ab"`. No `�` appears in any result, and `[...body].length` matches the expected code-point count.
- **Would fail if:** the prefix/suffix diff cut at a UTF-16 boundary inside a surrogate pair — i.e. the surrogate-widening guards were removed — which makes Yjs write replacement characters and destroys the character permanently.
- **Target file:** apps/web/lib/documents/use-yjs-doc.test.ts
- **Notes:** Emoji sharing a lead surrogate (`😀`/`🙂` both `\uD83D`) is the common case, not an exotic one — worth its own step.

### TS-5 — Dirty-doc marker persists, clears, and degrades safely  `P0` `unit` `AC-40` `AC-42` `AC-43`

- **Covers:** apps/web/lib/documents/dirty-docs.ts
- **Intent asserted:** Whether a document has unsaved local changes is per-device state (AC-43) that the dashboard reads to show Draft vs Saved (AC-40, AC-42).
- **Level because:** n/a — unit.
- **Setup:** jsdom `localStorage`, cleared between cases. Note: the module caches its parsed value in module scope, so use `vi.resetModules()` (or a fresh dynamic import) per case rather than relying on `localStorage.clear()` alone.
- **Steps:** (1) Mark doc `a` dirty, then read the snapshot. (2) Mark `a` dirty again and confirm the snapshot is the *same object reference* (required by `useSyncExternalStore`). (3) Mark `b` dirty, then mark `a` clean. (4) Seed the backing store with `"{not json"` and read. (5) Seed with valid JSON that is not an array (`"42"`) and read. (6) Make the store throw on write and mark a doc dirty.
- **Expected:** (1) snapshot contains `a`. (2) identical reference. (3) snapshot contains `b` only. (4)(5) empty snapshot, no throw. (6) no throw propagates to the caller.
- **Would fail if:** the read path returned a newly-constructed set on every call (infinite re-render in `useSyncExternalStore` consumers), or the corrupt-value/quota handling were removed so a bad stored value crashes the dashboard.
- **Target file:** apps/web/lib/documents/dirty-docs.test.ts
- **Notes:** Basis observation 12 flags that the degrade path lands on `Saved`, the reassuring state. That is a decision to confirm, not a bug to assert; this test pins today's behaviour of *not crashing*.

### TS-6 — Save merges into the stored snapshot and advances updatedAt  `P0` `integration` `AC-49` `AC-31`

- **Covers:** apps/server/src/services/docs.ts
- **Intent asserted:** A valid save returns `200 { doc }` with a refreshed `updatedAt`, and the merged content is what a later `GET /docs/:id` hands back (AC-49, AC-31).
- **Level because:** the merge is defined by what Prisma actually persists into a `Bytes?` column and by `@updatedAt` firing on write — a mocked client would assert the call arguments, not that the bytes survived the round-trip through Postgres, which is precisely the failure mode.
- **Setup:** Postgres via `docker compose up -d`, migrated schema; a doc owned by a seeded user with `snapshot` null; an authenticated supertest agent with the CSRF header (reuse the seed helper in `apps/server/src/scripts/seed-e2e.ts` rather than re-minting tokens).
- **Steps:** (1) Build a real Yjs update client-side-style: `const d = new Y.Doc(); d.getText("body").insert(0, "hello"); const update = Buffer.from(Y.encodeStateAsUpdate(d)).toString("base64")`. (2) `POST /docs/:id/save` with `{ update }`. (3) `GET /docs/:id`. (4) Apply the returned `snapshot` to a fresh `Y.Doc`.
- **Expected:** `200`; response `doc.updatedAt` is strictly later than the pre-call value; the rebuilt text is `"hello"`. A second save appending `" world"` yields `"hello world"`.
- **Would fail if:** the service wrote the incoming update straight into `snapshot` without applying it to the existing state (second save then returns `" world"` only), or wrote with `updateMany`/raw SQL that bypasses `@updatedAt`.
- **Target file:** apps/server/src/services/docs.save.test.ts
- **Notes:** Needs a test database. If `apps/server/.env` points at the dev database, point the test at a separate one — `never_modify` forbids editing `.env`, so pass `DATABASE_URL` through the test command instead.

### TS-7 — Two divergent saves both survive the merge  `P0` `integration` `AC-50`

- **Covers:** apps/server/src/services/docs.ts
- **Intent asserted:** When two collaborators save divergent offline edits, the CRDT merges them on the backend — neither person's text is clobbered (AC-50; techspec §9 row 1).
- **Level because:** the whole point is the interaction between two independently-evolved Yjs states and the *stored* snapshot; with a mocked store there is no stored snapshot to merge against, so the test would assert nothing real.
- **Setup:** As TS-6, plus a second seeded collaborator with `editor` role on the same doc.
- **Steps:** (1) Seed the doc with a base state containing `"base"` via one save. (2) Client A and client B each build a `Y.Doc` from that base snapshot; A appends `" from A"` at the end, B inserts `"B: "` at position 0. (3) Save A's delta. (4) Save B's delta (computed against the base, i.e. B never saw A's edit). (5) `GET /docs/:id` and rebuild the text.
- **Expected:** `200` for both saves. The final text contains both `"B: "` and `" from A"` — neither edit is missing. (Interleaving order is CRDT-determined; assert on containment and on length, not on an exact string.)
- **Would fail if:** the service replaced the snapshot with the last incoming update instead of applying it onto the existing state — last-write-wins, which silently destroys the earlier collaborator's work with a `200` response.
- **Target file:** apps/server/src/services/docs.save.test.ts
- **Notes:** Assert containment rather than an exact string: pinning the interleaving would make this test brittle against a Yjs version bump without adding protection.

### TS-8 — Malformed update rejected with 400, document untouched  `P0` `integration` `AC-51` `AC-52` `AC-56`

- **Covers:** apps/server/src/validators/docs.ts
- **Intent asserted:** An `update` that is not a decodable Yjs update is rejected cleanly with `400`, without crashing the server and without altering the stored document (AC-51, AC-52); a missing or empty `update` is also `400` (AC-56).
- **Level because:** "doesn't corrupt the document" is only assertable against real persisted bytes — the before/after snapshot comparison is the assertion, and it does not exist without the database.
- **Setup:** As TS-6, with the doc already saved once so it holds a non-null snapshot. Capture the stored snapshot bytes before each case.
- **Steps:** POST `/docs/:id/save` once per payload: (1) `{ update: "not-a-real-update" }` (the PRD's own example). (2) `{ update: "" }`. (3) `{}`. (4) `{ update: 123 }`. (5) base64 of random bytes. (6) base64 of a valid update truncated to half its length. After each, re-read the stored snapshot.
- **Expected:** Every case returns `400` with the standard `{ error: { code, message } }` envelope; the process stays up (a subsequent request succeeds); the stored snapshot bytes are identical to the pre-call bytes in every case; and the document's text is unchanged on a follow-up `GET`.
- **Would fail if:** the `try` around the decode/apply were removed (case 1 becomes an unhandled 500), or the service wrote the snapshot before validating the incoming update (cases 5/6 corrupt the document while returning an error).
- **Target file:** apps/server/src/routes/docs.save.test.ts
- **Notes:** Basis observation 2 warns that a byte-level base64 decode never throws, so one of cases 1/5 may return `200` with a no-op merge instead of `400`. That is the interesting result — report it against AC-51 rather than relaxing the assertion.

### TS-9 — Save endpoint role matrix: 403 / 404 / 401  `P0` `authz` `AC-53` `AC-54` `AC-55`

- **Covers:** apps/server/src/routes/docs.ts
- **Intent asserted:** Server-side enforcement is the real permission boundary: a viewer gets `403`, a non-collaborator and an unknown document are indistinguishable (`404` both), and no session gets `401` (AC-53, AC-54, AC-55).
- **Level because:** authorisation is decided by a `DocCollaborator` row plus middleware ordering; a component test proves only that the UI hides a button, which is exactly the control an attacker skips.
- **Setup:** Seeded doc with owner, editor and viewer collaborators (the `seed:e2e` fixture set covers this), plus a fourth user with no row on that doc. A syntactically valid but unused UUID for the unknown-doc case.
- **Steps:** Send the same valid save payload as each principal: owner, editor, viewer, non-collaborator, no session. Then send it as the owner against the unknown doc id.
- **Expected:** owner `200`; editor `200`; viewer `403`; non-collaborator `404`; unknown doc `404` — with the non-collaborator and unknown-doc responses identical in status *and* body code, so existence cannot be probed; no session `401`. In the `403` and `404` cases the document's stored snapshot is unchanged.
- **Would fail if:** the route's minimum role were widened to `viewer` (viewer then gets `200` and writes to a document they may only read), or the middleware returned `403` for a missing collaborator row, leaking document existence.
- **Target file:** apps/server/src/routes/docs.save.authz.test.ts
- **Notes:** `requireRole` is shared, but `POST /docs/:id/save` is the first route to use the `editor` threshold — the ordering `requireRole` → `validate` also matters: an unauthorised caller must not learn anything from body validation. Assert the viewer case with a *malformed* body too, and expect `403`, not `400`.

### TS-10 — Never-saved document opens Draft with both placeholders  `P0` `component` `AC-1` `AC-2` `AC-3`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** A document that has never been through an explicit Save opens showing `Draft` before the user types anything, with the title and body placeholders visible (AC-1, AC-2, AC-3).
- **Level because:** the Draft-before-typing rule is a composition of the fetched `snapshot: null`, the Yjs hook's initial dirty state and the badge — no single unit owns it, and a unit test of the hook alone would miss a badge wired to the wrong flag.
- **Setup:** Render `<DocEditor id="doc-1" />` inside a `QueryClientProvider` whose cache is pre-seeded for `["docs","detail","doc-1"]` with `{ role: "owner", title: <per UNKNOWN-9>, snapshot: null }`. Stub `y-indexeddb` (or use `fake-indexeddb`).
- **Steps:** (1) Render. (2) Read the badge, the title field and the body field.
- **Expected:** The badge's accessible text is `SYNC_STATE_LABELS.draft`. The body field has placeholder `EDITOR_LABELS.bodyPlaceholder`. The title field has placeholder `EDITOR_LABELS.titlePlaceholder`. Save is present and enabled (there are unsaved changes by definition).
- **Would fail if:** the hook's initial dirty flag were derived from "content is empty" instead of "snapshot is null" — the badge would read `Saved` on a document that has never been saved, the exact lie the PRD calls out as deliberate.
- **Target file:** apps/web/components/documents/doc-editor.test.tsx
- **Notes:** **Blocked in part by UNKNOWN-9** — do not assert the title field's *value* until it is answered; assert the placeholder attribute only. Banded P0 by the `use-yjs-doc.ts` critical-path floor via the initial-dirty rule it asserts (raw score 12).

### TS-11 — Typing flips Saved → Draft and enables Save  `P2` `component` `AC-4` `AC-16` `AC-17` `AC-22`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** A previously-saved document opens `Saved` with Save disabled (AC-4, AC-22), and the moment the user types the badge flips to `Draft` and Save enables (AC-16, AC-17).
- **Level because:** it spans the textarea's change handler, the Yjs hook's dirty flag, the badge and the button's disabled rule — the wiring between them is what breaks, and no level below renders all four.
- **Setup:** As TS-10 but seeded with a non-null `snapshot` encoding the text `"existing"`.
- **Steps:** (1) Render; read badge and Save state. (2) `await userEvent.type(body, "!")`. (3) Read badge and Save state again.
- **Expected:** Before: badge is `SYNC_STATE_LABELS.saved`, Save is disabled. After: badge is `SYNC_STATE_LABELS.draft`, Save is enabled, and the body reads `"existing!"`.
- **Would fail if:** the dirty flag were only set on blur/debounce rather than on the Yjs update event — the badge would keep claiming `Saved` while the user types, and Save would stay disabled so the change could never be sent.
- **Target file:** apps/web/components/documents/doc-editor.test.tsx
- **Notes:** Also covers the seeded-snapshot path of the hook — a snapshot that fails to apply would show an empty body here.

### TS-12 — Successful save cycles Saving… → Saved and sends exactly one request  `P1` `component` `AC-18` `AC-23` `AC-24` `AC-25`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** Clicking Save sends one `POST /docs/:id/save`; while it is in flight the badge reads `Saving…` and Save is disabled; on success the badge reads `Saved` (AC-18, AC-23, AC-24, AC-25).
- **Level because:** the in-flight window only exists when a real mutation lifecycle drives the render; a unit test of the hook cannot observe the button's disabled state or the badge, and an e2e test cannot reliably hold the request open to inspect the intermediate state.
- **Setup:** As TS-11, with the save transport stubbed by a deferred promise the test resolves manually.
- **Steps:** (1) Type into the body. (2) Click Save (query by role `button`, name `EDITOR_LABELS.save`). (3) Assert the intermediate state before resolving. (4) Click Save again while pending. (5) Resolve the deferred promise. (6) Assert the final state.
- **Expected:** After (2): badge `SYNC_STATE_LABELS.saving`, Save disabled, its label reads `EDITOR_LABELS.saving`. After (4): still exactly **one** transport call. After (5): badge `SYNC_STATE_LABELS.saved`, Save disabled again.
- **Would fail if:** the pending-state guard were dropped from the save handler or the button's disabled rule — a double-click would fire two overlapping saves, and the second would carry a delta computed against a state the first has not yet confirmed.
- **Target file:** apps/web/components/documents/doc-editor.test.tsx
- **Notes:** Assert the call count, not just the final badge — a second in-flight save is invisible in the end state.

### TS-13 — Failed save: banner, Save failed badge, content kept, Retry resends  `P1` `component` `AC-27` `AC-28` `AC-29` `AC-30`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** When an online save fails, the user is told plainly, the badge reads `Save failed`, their typed content is still there, and Retry re-sends the same outstanding changes (AC-27, AC-28, AC-29, AC-30).
- **Level because:** the failure surface is three coordinated pieces of UI driven by one mutation error; only a rendered component shows all three, and forcing a server 500 from e2e is both slower and less reliable.
- **Setup:** As TS-12, with the save transport rejecting with a `500`-shaped `ApiError`.
- **Steps:** (1) Type `"unsaved words"`. (2) Click Save; let it reject. (3) Read the banner, the badge and the body. (4) Click `EDITOR_LABELS.retry` in the banner; let the second attempt succeed.
- **Expected:** Banner text is `EDITOR_LABELS.saveFailed` and is exposed as an alert; badge is `SYNC_STATE_LABELS.error` (`"Save failed"`); the body still reads `"unsaved words"`; Save is still enabled. After Retry: a second transport call is made carrying a payload that still contains `"unsaved words"`, and the badge ends at `SYNC_STATE_LABELS.saved`.
- **Would fail if:** the failure path cleared the local draft or marked the document clean — the badge would read `Saved` and the next delta would omit text the server never received.
- **Target file:** apps/web/components/documents/doc-editor.test.tsx
- **Notes:** **Partly blocked by UNKNOWN-5** — do not assert what the badge reads once the user types *again* after a failure; the sources contradict each other there. Assert only up to the Retry.

### TS-14 — Offline: badge, banner, both Saves disabled, typing still works  `P1` `component` `AC-21` `AC-33` `AC-34` `AC-35` `AC-36`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** Offline, editing stays fully enabled while saving is clearly unavailable (AC-33, AC-34, AC-35, AC-21), and reconnecting does **not** auto-save — the document stays unsaved until the user clicks Save (AC-36).
- **Level because:** the behaviour is a connectivity signal fanned out to a badge, a banner and two separate Save controls; a unit test cannot see any of them, and toggling connectivity is far more controllable here than in a browser.
- **Setup:** As TS-11. Control `navigator.onLine` and dispatch `online`/`offline` window events. Render at both the desktop and the mobile viewport (or assert both Save controls by their accessible name, since both render).
- **Steps:** (1) Type. (2) Go offline. (3) Type more. (4) Assert badge, banner, both Save controls. (5) Go back online. (6) Assert no save was sent. (7) Click Save. (8) Assert one save was sent.
- **Expected:** Offline: badge `SYNC_STATE_LABELS.offline`; banner text `EDITOR_LABELS.offlineHint`; every Save control disabled; the textarea is not disabled or read-only and accepts step (3)'s text. After reconnect and before any click: **zero** transport calls, badge is back to `SYNC_STATE_LABELS.draft`. After the click: exactly one call carrying both typed fragments.
- **Would fail if:** an effect were added that fires the save mutation on the `online` event — the Phase-2 behaviour the PRD explicitly defers (§7) — or the textarea were disabled while offline, blocking the input the PRD guarantees.
- **Target file:** apps/web/components/documents/doc-editor.test.tsx
- **Notes:** **Partly blocked by UNKNOWN-4** — do not assert offline-plus-prior-failure precedence. The "zero calls after reconnect" assertion is the valuable half of this scenario; it is the only test that pins a deliberate non-feature.

### TS-15 — Viewer sees a read-only canvas with no Save and a View only badge  `P2` `component` `AC-20` `AC-45` `AC-46` `AC-47` `AC-48`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** For a viewer, the title and body are visible but not editable, no Save control exists in either location, no offline or save-failed banner ever appears, and a `View only` badge sits beside the sync badge (AC-20, AC-45..AC-48).
- **Level because:** it is an assertion about what is *absent* from a rendered tree across two responsive layouts; there is no lower level that renders the tree at all. Server-side enforcement of the same rule is TS-9 — deliberately paired, logic below, surface above.
- **Setup:** As TS-11 but with `role: "viewer"` on the seeded detail.
- **Steps:** (1) Render. (2) Query for a Save control by role+name at both layouts. (3) Attempt `userEvent.type` into the title and the body. (4) Go offline and re-query for the banner.
- **Expected:** No element with role `button` and name `EDITOR_LABELS.save` exists anywhere. A badge reads `EDITOR_LABELS.viewOnly`. Typing changes neither field's value. Offline produces no `EDITOR_LABELS.offlineHint` banner. The sync badge itself is still present.
- **Would fail if:** the viewer branch rendered a *disabled* Save instead of omitting it (the PRD says "no Save button at all"), or the body's read-only flag were dropped so a viewer could type into a document they may only read.
- **Target file:** apps/web/components/documents/doc-editor.viewer.test.tsx
- **Notes:** Per part2-PRD §3 there is no in-product way to create a viewer; the fixture is seeded state, which is exactly why this belongs at component level rather than e2e.

### TS-16 — Title commit / revert / no-op rules  `P2` `component` `AC-7` `AC-10` `AC-11` `AC-12` `AC-13` `AC-14`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** Enter commits a changed title through the rename endpoint immediately; Escape reverts without committing; an empty, whitespace-only or unchanged title makes no call at all; and none of it touches the body's unsaved state (AC-7, AC-10..AC-14).
- **Level because:** each rule is a keyboard/blur interaction against a controlled input and a mutation — observable only in a rendered component, and far cheaper here than driving a browser four times.
- **Setup:** As TS-11 with `title: "Report"`, and the rename transport stubbed and counted.
- **Steps:** (1) Type a body character, note Save enabled. (2) Clear the title, type `"Q3 Report"`, press Enter. (3) Reset; type `"scratch"`, press Escape. (4) Reset; clear the title entirely, blur. (5) Reset; type `"   "`, blur. (6) Reset; re-type the identical existing title, blur.
- **Expected:** (2) exactly one rename call with `{ id: "doc-1", title: "Q3 Report" }` and the field is no longer focused. (3) zero calls, field value back to `"Report"`, field blurred. (4)(5)(6) zero calls, field value back to `"Report"`. Throughout: the body's text and the Save button's enabled state are unchanged by any title interaction.
- **Would fail if:** the trim/unchanged guard were removed from the commit path — blurring an untouched title would fire a rename on every visit — or Escape were made to commit rather than revert.
- **Target file:** apps/web/components/documents/doc-editor.title.test.tsx
- **Notes:** **AC-9 ("navigate away commits") is deliberately not asserted here** — see Blocked on UNKNOWNs and basis observation 8. **UNKNOWN-2** also means the editor-role case is unwritable: do not add a `role: "editor"` variant until it is answered.

### TS-17 — Cmd+S and Ctrl+S save and suppress the browser dialog  `P3` `component` `AC-19`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** The keyboard shortcut triggers the same save as the button from anywhere in the editor, and the browser's own save dialog is prevented (AC-19).
- **Level because:** it is a window-level key listener plus `preventDefault`; a real browser cannot observe the suppression, and nothing below renders the listener.
- **Setup:** As TS-12.
- **Steps:** (1) Type into the body. (2) Fire `keydown` `{ key: "s", metaKey: true }` on `window`, with focus outside the textarea. (3) Assert. (4) Reset and repeat with `{ key: "s", ctrlKey: true }`. (5) With a clean (non-dirty) document and again as a viewer, fire the shortcut.
- **Expected:** (2)(4) exactly one save call each, and `defaultPrevented` is true on the dispatched event. (5) zero calls in both cases — the shortcut honours the same disabled rules as the button.
- **Would fail if:** `preventDefault` were dropped (the browser's Save Page dialog would open over the app), or the listener were mounted without the "can save" guard, letting a viewer or an offline user fire a request that must not be sent.
- **Target file:** apps/web/components/documents/doc-editor.test.tsx
- **Notes:** Basis observation 6 — the plain-`"s"` key check means `Cmd+Shift+S`/caps-lock does nothing. Not asserted; no source states it either way.

### TS-18 — Dashboard row and drawer badges follow this device's dirty set  `P1` `component` `AC-40` `AC-41` `AC-42`

- **Covers:** apps/web/components/documents/document-table.tsx
- **Intent asserted:** A document with unsaved local changes on this device shows `Draft` on its dashboard row and in its details drawer; one without shows `Saved` (AC-40, AC-41, AC-42).
- **Level because:** the badge is a join between a server-fetched list and a local per-device store read through a subscription — the join is the behaviour, and neither the store unit test (TS-5) nor a row rendered in isolation exercises it.
- **Setup:** Render `<DocumentTable />` in a `QueryClientProvider` seeded with two documents (`dirty-1`, `clean-1`) on `["docs","list"]`, with the local dirty store pre-seeded containing `dirty-1` only.
- **Steps:** (1) Render. (2) Read both rows' badges. (3) Open the details drawer for `dirty-1`, read its badge. (4) Close, open the drawer for `clean-1`, read its badge.
- **Expected:** `dirty-1`'s row badge is `SYNC_STATE_LABELS.draft` and `clean-1`'s is `SYNC_STATE_LABELS.saved`; the drawer badge matches the row badge in both cases.
- **Would fail if:** the badge were hardcoded back to `"saved"` (its Part 1 behaviour, removed in this diff) or the drawer were passed the table's aggregate dirty state instead of the selected document's — every drawer would then read Draft whenever *any* document was dirty.
- **Target file:** apps/web/components/documents/document-table.test.tsx
- **Notes:** AC-44 (cross-tab live update) is **not** covered here — the store's notification is a cross-tab event a single jsdom document cannot raise. See Not testing.

### TS-19 — Saved text survives a real reload against the real API  `P0` `e2e` `AC-26` `AC-31`

- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** Text typed and saved is genuinely on the server: reloading the document shows it, and the dashboard row for it reads `Saved` (AC-31, AC-26).
- **Level because:** this is the only scenario that exercises the full encode → HTTP → merge → persist → fetch → decode chain in one process; every level below stubs at least one link, and the highest-suspicion defect in this change (browser-side base64 encoding) lives exactly at a seam that stubbing hides.
- **Setup:** Playwright `owner` project (storage state from `e2e/setup/auth.setup.ts`); the seeded fixture document from `e2e/.auth/fixtures.json`; Postgres up and migrated.
- **Steps:** (1) Go to `/doc/<fixtureDocId>`. (2) Type a unique marker string into the body. (3) Click Save. (4) Wait for the badge to read `Saved`. (5) `page.reload()`. (6) Read the body. (7) Navigate to the dashboard and read that document's row badge.
- **Expected:** After (4) the badge is `SYNC_STATE_LABELS.saved`. After (5) the body contains the marker string. The dashboard row badge reads `SYNC_STATE_LABELS.saved`.
- **Would fail if:** the browser-side base64 encoder corrupts the payload — the save returns `400`, the badge lands on `Save failed` and the marker is gone after reload. Also fails if the server merge is a no-op write.
- **Target file:** e2e/doc-editor.spec.ts
- **Notes:** Run `pnpm --filter server seed:e2e` once and confirm it exits green before relying on this — the storage-state files exist on disk but were not re-minted or verified during planning, and they carry a token TTL. Use a per-run unique marker so reruns do not depend on a clean database. Deliberate overlap with TS-1/TS-2/TS-6: those localise the fault, this one proves the wiring.

### TS-20 — Unsaved draft survives closing the tab, and still reads Draft  `P0` `e2e` `AC-37` `AC-38`

- **Covers:** apps/web/lib/documents/use-yjs-doc.ts
- **Intent asserted:** Text typed but never saved is recovered when the same document is reopened in the same browser, and the badge still reads `Draft` — it was never silently saved (AC-37, AC-38).
- **Level because:** IndexedDB persistence across a page close is the behaviour; jsdom with a fake IndexedDB proves the adapter is wired but not that state survives a real document teardown and a fresh page load, which is the failure users would actually hit.
- **Setup:** Playwright `owner` project, reusing **one browser context** across both page loads so IndexedDB persists (a new context is a new profile and would legitimately show no draft).
- **Steps:** (1) Open `/doc/<fixtureDocId>`. (2) Type a unique marker. (3) Do **not** save; wait for the badge to read `Draft`. (4) `page.close()`. (5) Open a new page in the *same* context at the same URL. (6) Read the body and the badge. (7) Assert no save request was ever issued (route interception on `**/docs/*/save`).
- **Expected:** The body contains the marker; the badge reads `SYNC_STATE_LABELS.draft`; zero requests to the save endpoint at any point.
- **Would fail if:** the IndexedDB persistence were removed or destroyed without flushing on unmount (the marker is gone on reopen), or the restored draft were treated as clean (the badge reads `Saved` — the PRD's explicitly-named lie), or anything auto-saved in the background.
- **Target file:** e2e/doc-editor-draft.spec.ts
- **Notes:** Clean up the fixture document's IndexedDB between runs, or use a document created fresh in the test, so a leftover draft from an earlier run cannot make this pass vacuously. Same seed caveat as TS-19.

## Level distribution

| Level | Planned | Target for `trophy` | Verdict |
|---|---|---|---|
| unit | 5 (25%) | thin (~20–25%) | on target |
| component | 9 (45%) | fat | on target — the fat middle |
| integration | 3 (15%) | fat (with component) | on target |
| authz | 1 (5%) | as needed | on target |
| e2e | 2 (10%) | thin (≤5 per plan) | on target |

Shape used: `trophy`, as configured. Component + integration + authz together are 65% of the plan, which is the trophy's intended bulge; unit is reserved for the four pure critical-path modules where a named bug is cheap to pin.

- **Ice cream cone:** not present — 2 of 20 scenarios are e2e.
- **Hourglass:** not present — integration and component carry the middle.
- **Cupcake:** two intentional overlaps, declared: (a) TS-1/TS-2 (unit, base64 and delta encoding) with TS-19 (e2e, the same chain end-to-end) — the units name the defect, the e2e proves the seam is connected; (b) TS-15 (component, viewer UI) with TS-9 (authz, viewer server rejection) — the PRD requires both, and a UI-only test would pass against a server that happily accepts a viewer's write. No scenario re-asserts the same logic at two levels for the same reason.

## Not testing, deliberately

| Area | Why | Residual risk | Who accepts it |
|---|---|---|---|
| AC-44 — dashboard tab updates live when the editor tab marks a document dirty | Needs two documents sharing one origin with a real cross-tab storage event; jsdom cannot raise it and the Playwright version costs a third e2e for a cosmetic badge | A stale `Saved` badge on a dashboard left open in another tab; the data is safe and a refresh corrects it | Feature owner |
| AC-5 / AC-6 — "Couldn't load this document" + Retry | Cut for budget at P2; a pure render-branch with no data consequence | A regression here shows a blank screen or crash on an inaccessible document id — visible immediately, no data lost. On the manual checklist | Feature owner |
| AC-39 — draft does not leak to a different browser/incognito | Requires two real browser profiles; the property follows from IndexedDB being per-profile, which no code in this change can alter | Near-zero: only a deliberate move to a shared/server-side draft store could break it, which would be a design change | QA lead |
| AC-9 — "navigate away commits the title" | Ambiguous (in-app route change? tab close?) and the implementation commits on blur only — see basis observation 8. Asserting either reading would enshrine a guess | A title typed and then navigated away from may be silently discarded. Listed as a manual check and as an open question | Needs the feature owner's answer first |
| AC-58 and the rest of DocSync-PRD §10 (label+icon not colour alone, focus ring, 4.5:1 contrast, 44px targets) | The `a11y` level is not available in this project's config; promoting them to e2e would assert almost nothing useful | Colour-only sync state would be invisible to colour-blind users; a small mobile Save target would be hard to hit. On the manual checklist and in Level gaps | QA lead |
| The `useYjsDoc` "starts dirty when snapshot is null" rule as its own unit test | Folded into TS-10, which asserts the same rule where the user sees it | If TS-10 fails, the cause is one indirection further away than it could be. No coverage lost | Test author |
| Part 1 surfaces reachable from this diff: dashboard list/create/rename/delete/duplicate, row overflow menu, "Manage access" disabled tooltip, CSRF and session middleware | Shipped and unchanged in this branch except for the badge prop | A Part 1 regression caused by the new `isDirty` prop threading would go unnoticed — mitigated by TS-18 rendering the real table and rows | Feature owner |
| Everything in part2-PRD §7 (auto-save, reconnect queue, presence, push, sharing UI, rich text, version history, dictation, PWA) | Explicitly out of scope for this phase | None for this phase. Note TS-14 does assert the *absence* of auto-save on reconnect, since that is a promise, not a gap | Product |
| Request-size limits and very large documents (UNKNOWN-7) | No stated limit to test at | A large paste could hit the body-parser limit and fail a save with an unexplained error | Needs a limit decision |

## Level gaps

- **`a11y`** — not available. AC-58 (label + icon, not colour alone) and the DocSync-PRD §10 items have no automatable home. Setting it up would mean adding `@axe-core/playwright` (or `vitest-axe`) plus one accessibility assertion per rendered state — blocked by `allow_new_dependencies: false`, so it needs an explicit dependency approval first.
- **`contract`** — not available. `SaveRequest`/`DocResponse` are shared TypeScript types compiled in one monorepo, so the type checker already catches drift between client and server; a contract level would add little here. If the API is ever split from the web app, revisit.
- **`perf`** — not available and not needed: no source states a budget for this feature.
- **`fake-indexeddb` (or an equivalent stub) is required** for TS-2, TS-3, TS-4 and the component scenarios, because `useYjsDoc` constructs an `IndexeddbPersistence` on mount and jsdom has no `indexedDB`. That is a new devDependency, which `allow_new_dependencies: false` forbids — **ask before adding it**. The fallback is to `vi.mock("y-indexeddb")` with a no-op persistence class, which needs no dependency but leaves the persistence wiring itself proven only by TS-20 (e2e).

## Blocked on UNKNOWNs

| Basis UNKNOWN | What it blocks | Question the developer must answer |
|---|---|---|
| UNKNOWN-9 (placeholder vs server default title) | TS-10's assertion on the title field's *value* (placeholder-only is asserted meanwhile) | For a brand-new document, is the title field empty with placeholder "Untitled document", or pre-filled with the literal title the server assigns? |
| UNKNOWN-5 (badge after typing following a failed save) | The natural continuation of TS-13 — recovery after a failure, a P1 path with two contradictory sources | After a failed save, the user types again: does the badge read `Draft` or stay `Save failed`, and does the banner clear? |
| UNKNOWN-4 (offline + prior failure precedence) | The offline-after-failure half of TS-14 | Which badge and banner wins when the device is offline *and* the last save failed? |
| UNKNOWN-2 (who may rename) | An editor-role variant of TS-16, and whether TS-9's matrix should also cover `PATCH /docs/:id` | part2-PRD §4 lets an Editor edit the title, but `PATCH /docs/:id` is owner-only. Does an Editor's title commit succeed or 403? |
| UNKNOWN-8 (title save failure) | Any scenario for a failed rename — currently no oracle and no UI at all | What should the user see when the title's immediate rename call fails? |
| UNKNOWN-1 (title autofocus on a new document) | An initial-focus assertion in TS-10 | Must the title field be focused when a never-saved document opens, as phase1-techspec §6.3 says? |
| UNKNOWN-10 (IndexedDB unavailable) | A negative variant of TS-20 | What should happen when local draft storage is denied or full — silent, or a visible warning? |

No P0 scenario is blocked: the seven P0s covering the data path (TS-1..TS-9, TS-19, TS-20) are all writable today.

## Manual checks

A short list for a human, run once per release of this vertical:

1. **Real offline, not DevTools offline** — part2-PRD §5.5 warns that a dead Wi-Fi network still reports as online. Disconnect physically, confirm the badge, banner and both disabled Save controls, then reconnect and confirm nothing saves until you click Save.
2. **Second browser, same document** — edit without saving in Chrome, open the dashboard in Firefox, confirm that document still reads `Saved` (AC-43) and the editor there shows the last server-saved text (AC-39).
3. **Two tabs, one browser** — dashboard in one tab, editor in another; type in the editor and confirm the dashboard badge flips to `Draft` without a refresh (AC-44).
4. **Viewer role via Prisma Studio** — per part2-PRD §3, add a `DocCollaborator` row with `role: "viewer"` for a second account and walk §6 end to end.
5. **Load error** — open `/doc/<random-uuid>`; confirm "Couldn't load this document" and that Retry re-attempts (AC-5, AC-6).
6. **Accessibility pass** — sync state readable without colour; visible focus ring on the title, body, Save and Retry; mobile Save bar at least 44px tall; contrast at 4.5:1 (AC-58, DocSync-PRD §10).
7. **Mobile layout** — at 390px confirm the bottom Save bar obeys the same disabled rules as the desktop one, and that the offline banner does not cover the text being typed.
