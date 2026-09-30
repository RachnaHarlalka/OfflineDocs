# Test Plan: Phase 2 Hardening — draft restore, shell-first loading, offline/PWA fixes

- **Basis:** .qa/basis/phase2-hardening-draft-restore.md
- **Mode:** change-scoped (base `HEAD`, 13 files, staged/uncommitted on `main`)
- **Generated:** 2026-09-22
- **Shape:** trophy — weight on component + integration, unit only for pure hook logic, e2e strictly budgeted
- **Budget:** 2 unit · 1 integration · 14 component · 3 e2e · 0 contract  (**20 of 20 cap**, e2e 3 of 5)
- **Scoring note:** **defect_history unavailable** (no `.qa/history/defects.jsonl`) — 3 axes used, not 4. Bands scaled accordingly: **P0 ≥ 19 · P1 14–18 · P2 9–13 · P3 < 9**, where `priority = blast*2 + change_exposure + detection_difficulty`. `use-yjs-doc.ts` is on `risk.critical_paths` → its scenarios are floored at P0.

## Risk table

| ID | Scenario | AC | Level | Blast | Change | Silent | Score | Band |
|---|---|---|---|---|---|---|---|---|
| TS-1 | Draft read once per mount, not on focus | AC-201 | component | 4 | 2 | 4 | 14 | P1 |
| TS-2 | Viewer makes no draft request, sees no notice | AC-202 | component | 4 | 2 | 4 | 14 | P1 |
| TS-3 | Offline makes no draft request | AC-203 | component | 3 | 2 | 4 | 12 | P2 |
| TS-4 | Restorable backup renders the notice (incl. a11y/labels) | AC-204, AC-214 | component | 5 | 3 | 3 | 16 | P1 |
| TS-5 | Backup content stays out of the body until Restore | AC-205 | component | 5 | 3 | 5 | 18 | P1 |
| TS-6 | Restore merges, closes notice, badge Draft, dashboard dirty | AC-206 | component | 5 | 2 | 3 | 15 | P1 |
| TS-7 | Restored draft is unsaved until Save; Save then persists it | AC-207 | component | 5 | 2 | 4 | 16 | P1 |
| TS-8 | "Not now" dismisses without touching body or badge | AC-208 | component | 3 | 3 | 3 | 12 | P2 |
| TS-9 | Backup already contained → no notice | AC-209 | component | 3 | 2 | 4 | 12 | P2 |
| TS-11 | Heartbeat withholds the backup until the read settles | AC-211 | component | 5 | 2 | 5 | 17 | P1 |
| TS-12 | Failed backup read: no notice, no retry, backups resume | AC-212 | component | 4 | 2 | 5 | 15 | P1 |
| TS-13 | `null` backup: no notice, later backups not blocked | AC-213 | component | 4 | 2 | 5 | 15 | P1 |
| TS-14 | Newer snapshot at an open editor keeps edits dirty | AC-215 | unit (hook) | 5 | 2 | 5 | 17 | **P0 (critical path floor)** |
| TS-15 | New document (`snapshot === null`) marked dirty from first paint | AC-217 | unit (hook) | 4 | 2 | 4 | 14 | **P0 (critical path floor)** |
| TS-16 | Save body 1–5 MB accepted; over 5 MB → 413 | AC-218 | integration | 5 | 3 | 2 | 15 | P1 |
| TS-17 | Near-5 MB queued save flushes on reconnect; queue empties | AC-219, AC-220 | e2e | 5 | 3 | 4 | 17 | P1 |
| TS-18 | Waiting worker auto-activates, no banner, none on re-reload | AC-221 | e2e | 4 | 3 | 3 | 14 | P1 |
| TS-19 | Background install shows banner and never self-reloads | AC-222 | e2e | 5 | 3 | 3 | 16 | P1 |
| TS-20 | Anonymous user redirected with path + query preserved, no account details | AC-224 | component | 5 | 2 | 3 | 15 | P1 |

AC-223 (shell visible while session pending) is folded into TS-20's setup assertions rather than given its own slot — see "Not testing, deliberately".

## Scenarios

### TS-1 — Draft backup is read exactly once per editor mount  `P1` `component` `AC-201`
- **Covers:** apps/web/lib/documents/use-presence.ts, apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** an online owner/editor triggers `GET /docs/:id/draft` once; it is neither polled nor refetched on window focus.
- **Level because:** the "once" is a property of the hook wired into a mounted editor with a real QueryClient; a unit call of `fetchOwnDraft` cannot observe the query's staleTime/refetch policy.
- **Setup:** mock `@/lib/api/presence` as `presence.draft-restore.test.tsx` does; render the loaded editor as an owner, online.
- **Steps:** 1) render 2) advance timers past one heartbeat interval 3) fire a `window` focus event 4) re-render.
- **Expected:** `fetchOwnDraft` called exactly once, with `doc.id`.
- **Would fail if:** `staleTime: Infinity` were dropped, letting focus refetch and overwrite the offer.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-2 — A viewer never asks for a backup and never sees the notice  `P1` `component` `AC-202`
- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** backups are private to authors; viewers have none, so they are not asked.
- **Level because:** role gating is composed in the editor from `isViewer` plus hook enablement; no lower level sees both.
- **Setup:** viewer role fixture (reuse `doc-editor.viewer.test.tsx` conventions); online.
- **Steps:** render, settle.
- **Expected:** `fetchOwnDraft` not called; no element with `DRAFT_RESTORE_LABELS.title`.
- **Would fail if:** the `!isViewer` guard were dropped from `useOwnDraft`'s enabled flag.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-3 — Offline, no backup is requested  `P2` `component` `AC-203`
- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** the read is an online-only operation.
- **Level because:** same composition point as TS-2.
- **Setup:** owner, `online === false`.
- **Steps:** render, settle.
- **Expected:** `fetchOwnDraft` not called; no notice.
- **Would fail if:** the `online &&` conjunct were removed, producing a failed request and a spurious error path offline.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-4 — A restorable backup renders the notice with its specified copy and roles  `P1` `component` `AC-204` `AC-214`
- **Covers:** apps/web/components/documents/draft-restore-notice.tsx, apps/web/constants/labels.ts
- **Intent asserted:** the offer identifies which draft it means and is announced to assistive tech.
- **Level because:** rendering + accessible-name resolution is exactly what component level is for; a unit test of the label object would be testing a constant.
- **Setup:** owner online; `fetchOwnDraft` resolves `{ update, backedUpAt }` where `update` holds content the seeded snapshot lacks.
- **Steps:** render; await the notice.
- **Expected:** an element with `role="status"` containing `DRAFT_RESTORE_LABELS.title` and a relative-time string derived from `backedUpAt`; buttons resolvable by role+name for `DRAFT_RESTORE_LABELS.restore` and `.dismiss`. Assert against the constants, never literals.
- **Would fail if:** the notice rendered as a plain `div` with no role, leaving screen-reader users unaware a recovery was offered.
- **Target file:** apps/web/components/documents/draft-restore-notice.test.tsx

### TS-5 — The backup's text does not enter the body until Restore is pressed  `P1` `component` `AC-205`
- **Covers:** apps/web/components/documents/doc-editor.tsx
- **Intent asserted:** nothing enters the document unasked (the explicit-save model).
- **Level because:** it is an assertion about rendered body content against a mounted Yjs doc; the hook alone cannot show what the user sees.
- **Setup:** as TS-4.
- **Steps:** render; await the notice; read the body textarea.
- **Expected:** the body value does not contain the backup-only text.
- **Would fail if:** someone "simplified" the offer into an auto-merge on arrival — silent content injection over the user's screen.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-6 — Restore merges the backup and marks the document dirty  `P1` `component` `AC-206`
- **Covers:** apps/web/lib/documents/use-yjs-doc.ts (`restoreDraft`), doc-editor.tsx
- **Intent asserted:** a restored draft behaves exactly like typing — body, badge and dashboard dirty flag all move.
- **Level because:** it spans the Yjs merge, the badge and the dirty-docs store; a hook unit test would miss the badge and the notice closing.
- **Setup:** as TS-4.
- **Steps:** 1) await notice 2) click "Restore draft".
- **Expected:** body contains the backup-only text; the notice is gone; the sync badge shows the Draft state; the document id is recorded dirty in `dirty-docs`.
- **Would fail if:** `restoreDraft` also re-based `lastSyncedVector`, making restored content look already-saved and silently losing it on the next reconcile.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-7 — A restored draft stays unsaved until Save, then persists normally  `P1` `component` `AC-207`
- **Covers:** doc-editor.tsx, use-yjs-doc.ts
- **Intent asserted:** restore never triggers a save or a notification on its own.
- **Level because:** requires the real save mutation wiring and the button; below this level there is no Save.
- **Setup:** as TS-6, with the save mutation mocked.
- **Steps:** 1) restore 2) assert no save call 3) press Save.
- **Expected:** no save request between restore and the click; after the click, exactly one save whose payload includes the restored content.
- **Would fail if:** restore auto-saved, notifying collaborators of a draft the user never chose to publish.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-8 — "Not now" dismisses without changing body or badge  `P2` `component` `AC-208`
- **Covers:** draft-restore-notice.tsx, doc-editor.tsx
- **Intent asserted:** declining costs the user nothing.
- **Level because:** it is an interaction across notice and editor state.
- **Setup:** as TS-4.
- **Steps:** await notice; click "Not now".
- **Expected:** notice gone; body unchanged; badge unchanged; no save call.
- **Would fail if:** dismiss were wired to `onRestore`, or cleared the local draft.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-9 — A backup the document already contains produces no notice  `P2` `component` `AC-209`
- **Covers:** use-yjs-doc.ts (`hasContentBeyond`), doc-editor.tsx
- **Intent asserted:** an offer that restores nothing is noise, so it is not made.
- **Level because:** `hasContentBeyond` is exercised against the editor's live Y.Doc; a standalone unit call would assert a Yjs library property rather than the product decision.
- **Setup:** owner online; the backup `update` is the same state the seeded snapshot already holds.
- **Steps:** render; settle; wait one macrotask beyond the read.
- **Expected:** no notice at any point.
- **Would fail if:** the `hasContentBeyond` check were dropped, prompting a pointless restore on every open.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-11 — No heartbeat sends a backup until the read has settled  `P1` `component` `AC-211`
- **Covers:** apps/web/lib/documents/use-presence.ts, doc-editor.tsx
- **Intent asserted:** this device must not overwrite the very backup it is about to offer; presence still beats meanwhile.
- **Level because:** it is an ordering property between two hooks driven by timers inside one component. PRD §8 names component level for this criterion.
- **Setup:** owner online, dirty document; hold `fetchOwnDraft` unresolved (deferred promise).
- **Steps:** 1) render dirty 2) advance timers past a heartbeat 3) assert 4) resolve the read 5) advance past another heartbeat.
- **Expected:** heartbeats before the read settles carry presence but no draft payload; after it settles, a heartbeat carries the backup.
- **Would fail if:** `canBackUp` dropped the `!ownDraft.isPending` conjunct — the first beat destroys the user's only recovery copy, silently, with no error anywhere.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-12 — A failed backup read degrades quietly and does not retry  `P1` `component` `AC-212`
- **Covers:** use-presence.ts (`retry: false`), doc-editor.tsx
- **Intent asserted:** the backup is best-effort; its failure must not damage the editor or storm the API.
- **Level because:** retry policy is a query-client behaviour observable only in a mounted tree.
- **Setup:** owner online; `fetchOwnDraft` rejects with a 5xx `ApiError`.
- **Steps:** render; settle; advance timers well past any retry delay and one heartbeat.
- **Expected:** exactly one `fetchOwnDraft` call; no notice; the body is editable; the next heartbeat carries the backup (the read has settled, as an error).
- **Would fail if:** `retry: false` were removed (retry storm) or the error blocked `canBackUp` forever (backups stop permanently, invisibly).
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-13 — A `null` backup shows nothing and does not block later backups  `P1` `component` `AC-213`
- **Covers:** use-presence.ts, doc-editor.tsx
- **Intent asserted:** "no backup" is a normal settled answer, not a stuck state.
- **Level because:** same composition point as TS-11.
- **Setup:** owner online, dirty; `fetchOwnDraft` resolves `null`.
- **Steps:** render; settle; advance past a heartbeat.
- **Expected:** no notice; the heartbeat after settling carries the backup payload.
- **Would fail if:** the pending gate keyed on `ownDraft.data` truthiness instead of `isPending`, so first-time users never get a backup at all.
- **Target file:** apps/web/components/documents/doc-editor.draft-restore.test.tsx

### TS-14 — A newer server snapshot at an open editor does not re-baseline unsaved edits  `P0` `unit` `AC-215` `AC-216`
- **Covers:** apps/web/lib/documents/use-yjs-doc.ts (critical path)
- **Intent asserted:** the Y.Doc is seeded once per mount; newer server state arrives only via `reconcileWithServer`.
- **Level because:** unit is the lowest level that can catch it — `renderHook` with a changing `snapshot` prop is the whole mechanism; nothing above is needed.
- **Setup:** `renderHook(({snapshot}) => useYjsDoc(docId, snapshot))` seeded with snapshot A.
- **Steps:** 1) `setBody` local edits 2) rerender with a newer snapshot B 3) read `isDirty`, `body`, `encodeFullState()`.
- **Expected:** `isDirty === true`; `body` still holds the local edits; `encodeFullState()` still carries them (so a Save would send them).
- **Would fail if:** the effect dep list went back to `snapshot` — the Y.Doc is destroyed and rebuilt, and unsaved work is marked synced and then lost. This is the P0 data-loss bug the change fixes.
- **Target file:** apps/web/lib/documents/use-yjs-doc.test.ts (append)

### TS-15 — A brand-new document is dirty from first paint  `P0` `unit` `AC-217`
- **Covers:** apps/web/lib/documents/use-yjs-doc.ts, dirty-docs.ts (critical path)
- **Intent asserted:** `snapshot === null` means nothing is on the server yet, so the dashboard must say so immediately.
- **Level because:** `markDocDirty` is called from the hook's setup effect; `renderHook` observes it directly.
- **Setup:** `renderHook` with `snapshot: null`; spy on `markDocDirty`.
- **Steps:** render; assert without any edit.
- **Expected:** `isDirty === true` and `markDocDirty(docId)` called once.
- **Would fail if:** the `seededSnapshot` refactor had changed the null check's timing — the dashboard would show a never-saved document as clean and the user would close it believing it was safe.
- **Target file:** apps/web/lib/documents/use-yjs-doc.test.ts (append)

### TS-16 — Save accepts bodies up to 5 MB and refuses above it with 413  `P1` `integration` `AC-218`
- **Covers:** apps/server/src/app.ts
- **Intent asserted:** the API's body cap equals the client's queue item cap, so a queued save is never permanently unsendable.
- **Level because:** the limit is enforced by express middleware before the route; only a real HTTP request through the assembled app exercises it. A unit assertion on the string `"5mb"` would be a constant test.
- **Setup:** supertest against the built app; authed owner + CSRF token; Postgres already on :5432; one seeded document.
- **Steps:** POST `/docs/:id/save` with (a) ~4 MB body, (b) ~5 MB + a margin over.
- **Expected:** (a) 2xx; (b) 413.
- **Would fail if:** the limit reverted to 1 MB — every large offline save 413s, the worker reads it as transport failure, and that document's queue retries forever.
- **Target file:** apps/server/src/routes/save-limit.test.ts
- **Notes:** run with `pnpm exec vitest run --project server`.

### TS-17 — A near-cap queued save flushes on reconnect and the flushed content survives offline reopen  `P1` `e2e` `AC-219` `AC-220`
- **Covers:** apps/web/public/sw.js (`dropCachedDoc` `ignoreVary`), queue-schema.ts, app.ts
- **Intent asserted:** the client-accepted queue item is server-acceptable, and the flush really invalidates the stale cached `GET /docs/:id`.
- **Level because:** service worker, Cache Storage `Vary` matching and offline transitions exist only in a real browser; no lower level has a Cache API with `Vary` semantics.
- **Setup:** Playwright Chromium, authed storage state from `e2e/setup/auth.setup.ts`, `seed:e2e` data.
- **Steps:** 1) open a document online so the SW caches `GET /docs/:id` 2) go offline 3) type a large but sub-5 MB body, Save (queued) 4) go online, wait for the flush 5) go offline again 6) reload the document.
- **Expected:** the queue for that document is empty after the flush; the offline reload shows the flushed content, not the pre-save content.
- **Would fail if:** `{ ignoreVary: true }` were removed — the stale entry survives and the user sees their own save silently reverted after a reconnect.
- **Target file:** e2e/offline-queue-flush.spec.ts

### TS-18 — A worker already waiting at load activates without showing the banner  `P1` `e2e` `AC-221`
- **Covers:** apps/web/lib/pwa/use-service-worker.ts
- **Intent asserted:** the banner is for updates that arrive while you work, not for one that was already waiting — and it must not return on every refresh.
- **Level because:** worker install/waiting/activating lifecycle is browser-only.
- **Setup:** Chromium; bump `NEXT_PUBLIC_SW_VERSION` between loads to produce a second worker version.
- **Steps:** 1) load, let v1 control 2) deploy v2, reload 3) assert 4) reload again.
- **Expected:** no update banner on either reload; after step 2 the page is controlled by v2.
- **Would fail if:** the `SKIP_WAITING` post on load were removed — the banner reappears on every refresh and teaches users that Refresh does nothing.
- **Target file:** e2e/sw-update.spec.ts
- **Notes:** UNKNOWN U-3 (PRD Q-1) applies — auto-activation with `clients.claim()` swaps *every* open tab. Do not write the multi-tab adversarial case until Q-1 is answered.

### TS-19 — A worker installing while a document is open shows the banner and never self-reloads  `P1` `e2e` `AC-222`
- **Covers:** apps/web/lib/pwa/use-service-worker.ts, apps/web/public/sw.js
- **Intent asserted:** an update arriving mid-edit stays the user's decision.
- **Level because:** same as TS-18.
- **Setup:** Chromium; document open with unsaved edits; deploy v2 while the page stays open.
- **Steps:** 1) open a doc, type (dirty) 2) trigger a background install 3) wait past any reload window 4) assert.
- **Expected:** the "Update available — refresh" banner appears; the page does not reload; the typed content is still on screen; the URL is unchanged.
- **Would fail if:** the load-time `SKIP_WAITING` also fired for updates found after load — a mid-edit tab swaps workers and the user loses unsaved writing.
- **Target file:** e2e/sw-update.spec.ts

### TS-20 — Anonymous user on a protected route is redirected with path and query preserved, and the shell paints first  `P1` `component` `AC-224` `AC-223`
- **Covers:** apps/web/components/auth/require-session.tsx, apps/web/app/(protected)/layout.tsx, session-pending.tsx
- **Intent asserted:** re-ordering the guard inside the shell must not weaken the gate; the shell is chrome only and reveals no account details.
- **Level because:** it needs the composed layout (shell + guard) and a router spy; a unit test of `loginUrlFor` would not catch the guard being rendered in the wrong place.
- **Setup:** render the protected layout with the shell, `useSession` first pending then resolving to no user; router `replace` spied; pathname `/doc/abc?x=1`.
- **Steps:** 1) assert while pending 2) resolve to no user 3) assert the redirect.
- **Expected:** while pending, sidenav/top bar landmarks are in the document and the `SESSION_LABELS.checking` spinner is inside the content area; no account/user details render at any point; on resolve, `router.replace` is called with a login URL whose return path preserves `/doc/abc?x=1` including the query.
- **Would fail if:** the layout inversion let children render before the session resolved, exposing protected content to anonymous visitors; or the return path dropped its query string, dumping users on the dashboard after login.
- **Target file:** apps/web/components/auth/require-session.test.tsx

## Level distribution

| Level | Planned | Target for `trophy` | Verdict |
|---|---|---|---|
| unit | 2 (10%) | ~20% | light, deliberately — the pure logic in this diff is two hook behaviours |
| integration | 1 (5%) | ~20% | light — only one server-side change (the body limit) is in scope |
| component | 14 (70%) | ~45% | heavy, and correct here: the change is almost entirely React composition |
| e2e | 3 (15%) | ~15% | on target, 3 of 5 budget |

Shape used: **trophy**, per config. No ice cream cone (e2e is 15%), no hourglass (the middle is the bulk), no cupcake (no behaviour is asserted at two levels).

## Not testing, deliberately

| Area | Why | Residual risk | Who accepts it |
|---|---|---|---|
| AC-225 / PRD Q-4 — asserting `express.json` limit equals `QUEUE_ITEM_MAX_BYTES` | A relation between two constants; the test is the same edit as the code | The two drift apart in a future edit and large queued saves 413 forever. TS-16 catches the server half behaviourally; a shared constant (Q-4) is the real fix | Team, via Q-4 |
| AC-223 as a standalone scenario | Folded into TS-20 rather than spending a slot on layout ordering alone | A regression that shows the spinner viewport-sized would not be caught precisely; it is cosmetic (P2) | QA |
| `session-pending.tsx` `className` merge, `min-h-full` vs `min-h-svh` | Pure presentation — class names | A visual regression on the waiting state goes unnoticed | QA |
| `DRAFT_RESTORE_LABELS` copy values | A constant. TS-4 asserts *through* the constants instead | A copy change nobody reviews ships silently | QA |
| Multi-tab `clients.claim()` swap during an edit | Blocked on UNKNOWN U-3 / PRD Q-1 — there is no oracle | **The largest open risk in this change:** a second tab mid-edit can have its worker swapped with no warning, contradicting master spec §Phase 2 Part 3 | Needs a product decision |
| Malformed/undecodable `draft.update` | Blocked on UNKNOWN U-1 | `hasContentBeyond` could throw inside a render effect and blank the editor | Needs one AC |
| Backup-arrives-before-IndexedDB-hydration race | Blocked on UNKNOWN U-2 / PRD Q-2 | A harmless-but-noisy notice offering a restore of nothing | Needs an answer to Q-2 |
| Access revoked between read and restore | Blocked on UNKNOWN U-4 — PRD says "should take the existing path", which is not an oracle | Unclear UI on a rare but confusing path | Needs one AC |
| TS-10 (retired round 1) — typing after the backup arrives does not toggle the notice | Cut to free the 20-scenario cap for TS-21 (hunt finding H-4). Lowest-risk P2 scenario in the set: no data-loss or irreversible-action consequence, and its target (`hasContentBeyondRef`'s once-only evaluation) is a narrower re-check of a state TS-4 already exercises. TS-3, TS-8 and TS-9 — the other P2 candidates — were kept because each is the only scenario asserting its respective no-op path | If `hasContentBeyond` were called in render/effect deps, the recovery offer could flicker out mid-keystroke; the backup itself is untouched and the offer reappears on the next render/reload | QA |

## Level gaps

None. Every level this plan needs (unit, integration with live Postgres, component with jsdom + Testing Library, Playwright e2e with auth storage state) is already set up in this repo.

## Blocked on UNKNOWNs

- **U-3 / Q-1** blocks the adversarial multi-tab case behind AC-221/AC-222. TS-18 and TS-19 are written to the PRD's stated single-tab behaviour only, and TS-18 carries a note not to extend it until Q-1 is answered. This is the one UNKNOWN that touches a P0-priority PRD item.
- **U-1, U-2, U-4** block only lower-priority edge scenarios; none stops a planned scenario from being written.

## Manual checks

1. Two tabs on the same document: restore in both, confirm the text is not duplicated (CRDT merge should be idempotent).
2. On a real device, clear site data, reopen a document with a server-side backup, and confirm the relative timestamp reads sensibly in the user's locale.
3. Screen-reader pass on the restore notice: confirm it is announced on arrival and that both buttons are reachable in focus order.

## Round 1 — hunt findings folded in (`.qa/findings/hunt-r0.yml`)

Cross-checked each `likely`/`sev:critical`-or-`sev:high` finding against the actual files (not taken on
the intake note's word alone — two of its five suggested mappings turned out to be the wrong scenario or the
wrong verdict once read against the code).

**H-1** (critical — a failed draft GET opens the heartbeat gate, next beat overwrites the backup) — **already
covered, by TS-12, not TS-11 as suggested.** TS-11's setup resolves the deferred read successfully; it never
exercises the error path, so it cannot be the test that catches H-1. TS-12 is the one that holds `fetchOwnDraft`
rejecting and asserts "the next heartbeat carries the backup (the read has settled, as an error)" — that line is
exactly H-1's mechanism (`canBackUp` opens because `isPending` goes false on an errored query). AC-212 itself
states "backups resume on the next heartbeat" after a failed read with no carve-out for what that resume
overwrites, so the destructive-overwrite reading in H-1 is the PRD's own specified behaviour, not an
implementation slip TS-12 would need to change shape to catch. No new scenario.

**H-2** (likely/high — restore is decided against a Y.Doc that may not have hydrated from IndexedDB) — this is
the plan's own **U-2** (PRD Q-2), already recorded as blocking a scenario under "Blocked on UNKNOWNs." H-2 is
new evidence that the race is real in code (no `whenSynced` gate, comparison runs on `ownDraft.data` alone,
deps never re-run) rather than a hypothetical — it does not, however, answer the policy question U-2 blocks on
(*should* the check wait for hydration, or re-evaluate on doc update, or something else). Status stays
**blocked**, not unblocked: nothing changed about what the PRD says. What would unblock it: an answer to PRD
Q-2. Recommend escalating the priority of that question given H-2's confirmation, and once answered, add a new
scenario at the same AC-209 slot for the race case specifically.

**H-3** (likely/high — restore is an unconditional `Y.applyUpdate`, so a backup merges into a doc with its own
divergent local edits with no confirmation, no preview, no undo) — checked against TS-5, TS-6, TS-7, TS-10, and
none of them cover it: all four seed the notice via `fetchOwnDraft` on a clean mount and press Restore/Not now
without ever typing local edits first, so none exercises "type a paragraph, then press Restore draft" — the
exact trigger H-3 names. This is a real gap, not a covered one. It does not earn a new scenario this round
because it has no oracle: AC-206 says the body contains the backup content after Restore, and is silent on what
"contains" means when the body already diverged from both the snapshot and the backup at the moment Restore is
pressed (replace? CRDT-merge/interleave? refuse the offer once dirty?). Writing a test here would mean writing
the product decision along with it — exactly what a test basis exists to prevent. Recorded as a new blocking
question rather than a scenario:

| # | Question | Why it blocks testing | Cheapest way to resolve |
|---|---|---|---|
| U-6 | What should `restoreDraft` do when the live Y.Doc already has local edits made since mount — replace, merge/interleave (current code), refuse the offer, or prompt? | H-3: no confirmation or undo exists today; a CRDT merge of two independently-authored bodies is not "restore," and no scenario can name a "would fail if" without knowing the intended outcome | One line in PRD §2, next to AC-206/207 |

**H-4** (likely/high — `QUEUE_ITEM_MAX_BYTES` and the server's `express.json` limit are numerically equal, but
the client measures the raw base64 `update` length while the server measures the whole `JSON.stringify({update})`
body, so an update in the last ~20 bytes below the shared cap is accepted by the queue and 413'd by the server)
— **not covered.** TS-16 proves the server's own boundary (its own request bodies, built directly by the test,
at ~4MB and ~5MB+margin) but never constructs a payload through the client's actual envelope-wrapping path, so
it cannot see the mismatch H-4 names. TS-17 flushes "a large but sub-5MB body" but is not pinned to the exact
few-byte band where the defect lives, so implementing it would not reliably catch this either. The plan's
existing "Not testing, deliberately" line for AC-225 dismissed this as "a relation between two constants" —
that framing was too generous: H-4 shows a concrete, testable boundary defect (an accepted-by-client value that
is never deliverable), not just a maintenance/drift concern. **New scenario TS-21** (below), P1, traced to
AC-219/AC-225.

**H-5** (likely/high — `watchForUpdate` posts `SKIP_WAITING` unconditionally to any waiting worker, not only at
a genuinely idle cold load, contradicting the hook's own "never activates a waiting worker on its own" contract)
— **already covered, by TS-19.** TS-19's setup is exactly the case H-5 is worried about — a worker reaching
"waiting" while a document is open and dirty — and its oracle (banner shown, no reload, typed content survives,
URL unchanged) is precisely the assertion that would turn red if `SKIP_WAITING` fires unconditionally on that
path. The narrower re-mount/second-tab trigger H-5 also names (navigating within the SPA re-running the hook,
or a second tab) reduces to the same code path and the same oracle; the multi-tab variant specifically is
already tracked as blocked on U-3/Q-1 in "Blocked on UNKNOWNs." No new scenario.

**H-6..H-9** (medium/low severity) are not addressed this round — the fold-in instruction only requires a
written reason for `critical`/`high` findings that do not earn a scenario, and only H-1 through H-5 meet that
bar. Left for a later round or a human skim of `hunt-r0.yml` directly.

### Cut to make room: TS-10 retired

The plan is at the 20-scenario cap, so TS-21 (below) buys its slot by retiring one existing scenario.
**Correction to this section, post plan-gate:** the retirement was first recorded as prose only, leaving
TS-10's risk-table row and `### TS-10` scenario block in place — `qa-validate.mjs` and `qa-partition.mjs`
both still counted and scheduled it. That has been fixed structurally: TS-10's risk-table row and scenario
block are removed, and its retirement record now lives under "Not testing, deliberately" (the row marked
"TS-10 (retired round 1)"). This section stays as the fuller rationale behind that row.

**TS-10 is RETIRED**, effective round 1. It is the lowest-priority scenario in the set with no data-loss or
irreversible-action consequence — its "would fail if" is a notice flickering out mid-keystroke, which is
annoying and would be caught on the very next render/reload, versus TS-21's failure mode (a permanently stuck
offline save queue with no error surfaced to the user, per H-4). Between the two, TS-21 has the clearly higher
blast radius and lower detectability. TS-3, TS-8 and TS-9 were also P2/score-12 candidates but were kept: TS-8
is the only scenario asserting that decline-and-lose-nothing actually holds, TS-9 is the only scenario asserting
the no-op-offer case for the common "nothing new" backup, and TS-3 is the only scenario asserting the offline
path makes no request at all — TS-10 was the one whose loss leaves no scenario silently unrepresented, only a
narrower re-check of a state already exercised (the notice being visible) at TS-4.

### TS-21 — Queue item validation must account for the envelope the server actually measures, not just the raw update length  `P1` `integration` `AC-219` `AC-225`

- **Covers:** apps/web/lib/offline/save-queue.ts, apps/web/lib/offline/queue-schema.ts, apps/web/public/sw.js (flush payload construction), apps/server/src/app.ts
- **Intent asserted:** a save the client's offline queue accepts must be one the server can actually receive — AC-225's "one cap, two places" promise has to hold once the JSON envelope the server counts is accounted for, not just the equality of the two numeric constants.
- **Level because:** the defect is an interaction between two independently-enforced limits computed over different byte spans (raw base64 string vs. the whole serialized request body); no unit test of either side alone can observe the gap — it requires POSTing the client's actual flush payload shape through the real, assembled server app.
- **Setup:** supertest against the built server app (reuses TS-16's harness); authed owner + CSRF token; Postgres already on :5432; one seeded document; a base64 `update` string sized to `QUEUE_ITEM_MAX_BYTES` (5\*1024\*1024 bytes).
- **Steps:** 1) confirm the client-side size check (`queue-schema.ts` / `save-queue.ts`) accepts an update of exactly `QUEUE_ITEM_MAX_BYTES` 2) build the request body exactly as `sw.js`'s flush path does — `JSON.stringify({ update })` — and POST it to `POST /docs/:id/save`.
- **Expected:** either the server accepts it (proving there is enough headroom between the client cap and the server's `5mb` limit to absorb the envelope), or it returns `413` — in which case the test is red, proving a client-accepted item is not server-deliverable.
- **Would fail if:** the client validates against `input.update.length` alone while the server's limit is measured over the full serialized body, so an update near the shared 5MB boundary is queued but can never flush — that document's offline save queue retries forever with no error ever surfaced to the user. This is hunt finding H-4 (`.qa/findings/hunt-r0.yml`).
- **Target file:** apps/server/src/routes/save-limit.test.ts (append)
- **Notes:** run with `pnpm exec vitest run --project server`. If the server accepts the exact-cap payload (no `413`), record that as the passing baseline and add a second assertion one byte over the client cap to pin the actual headroom, so the two constants cannot silently drift back together in a future edit — this doubles as the drift guard the old AC-225 note deferred to a "shared constant" fix.

### Risk table addendum

| ID | Scenario | AC | Level | Blast | Change | Silent | Score | Band |
|---|---|---|---|---|---|---|---|---|
| TS-21 | Queue item validation accounts for the JSON envelope, not just raw update length | AC-219, AC-225 | integration | 5 | 3 | 5 | 18 | P1 |

### Budget after round 1

20 original scenarios - 1 (TS-10, structurally retired above, moved into 'Not testing, deliberately') +
1 (TS-21) = **20 of 20 cap**, unchanged. Level mix: unit 2, integration 2 (+1), component 13
(-1), e2e 3.
