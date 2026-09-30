# Test Basis: Phase 2 Hardening — draft restore, shell-first loading, offline/PWA fixes

- **Slug:** phase2-hardening-draft-restore
- **Sources:**
  - `docs/phase2-hardening-prd.md` — the authoritative spec for this change set; supplies AC-201..AC-224 verbatim, the out-of-scope list, and open questions Q-1..Q-4.
  - `docs/techspec.md` §4.1 — the draft backup contract (backups are private to their author; presence + backup are one request).
  - `docs/docsync-master-spec.md` §Phase 2 Part 3 — the "do not call skipWaiting() automatically" rule that the change now contradicts (recorded, not resolved).
  - `apps/web/lib/api/presence.draft-restore.test.tsx` — the pre-existing failing defect report for U-2 / AC-116, which this change is meant to turn green.
  - Diff (13 files) — **location only**: where each criterion lives. Never used as an oracle.
- **Scope:** the staged/uncommitted diff on `main`: draft restore read-back and offer, heartbeat ordering, Yjs baseline stability on snapshot refetch, API body limit vs queue item cap, SW cache invalidation with `ignoreVary`, waiting-worker auto-activation, shell-first protected layout.
- **Out of scope (stated by PRD §1):** automatic restore with no user action; restoring another user's backup; merge/diff UI for backups; any change to the `GET`/`POST /docs/:id/draft` endpoints themselves.

## Acceptance criteria

IDs are the PRD's own and are **not** renumbered. All rows below are `stated` unless marked otherwise; each quote is from `docs/phase2-hardening-prd.md`.

| ID | Given / When / Then | Source | Confidence |
|---|---|---|---|
| AC-201 | Given an owner or editor online, when the editor mounts, then `GET /docs/:id/draft` is called exactly once — not polled, not refetched on window focus | PRD §2 AC-201 "calls `GET /docs/:id/draft` exactly once per editor mount. It is not polled and not refetched on window focus" | stated |
| AC-202 | Given a viewer, when the editor mounts, then no draft request is made and no restore notice appears | PRD §2 AC-202 "makes **no** `GET /docs/:id/draft` request and sees no restore notice" | stated |
| AC-203 | Given the app is offline, when the editor mounts, then no draft request is made and no notice appears | PRD §2 AC-203 | stated |
| AC-204 | Given local state is gone and the backup holds content the document lacks, when the backup arrives, then a notice shows title "Unsaved draft found", a relative time from `backedUpAt`, and buttons "Restore draft" / "Not now" | PRD §2 AC-204 | stated |
| AC-205 | Given the notice is shown, when the user does nothing, then the backup's content does not appear in the body | PRD §2 AC-205 "does **not** appear in the document body until 'Restore draft' is pressed" | stated |
| AC-206 | Given the notice is shown, when "Restore draft" is pressed, then the body contains the backup content, the notice closes, the badge reads **Draft**, and the dashboard row shows unsaved changes | PRD §2 AC-206 | stated |
| AC-207 | Given a restored draft, when nothing further is done, then it is not saved and no push notification fires; pressing Save then persists it like any other edit | PRD §2 AC-207 | stated |
| AC-208 | Given the notice is shown, when "Not now" is pressed, then the notice closes with the body and badge unchanged | PRD §2 AC-208 | stated |
| AC-209 | Given a backup whose content the document already holds, when it arrives, then no notice appears | PRD §2 AC-209 | stated |
| AC-210 | Given the backup has been read, when the user types, then the notice does not appear or disappear — the restorable check runs once, on arrival | PRD §2 AC-210 | stated |
| AC-211 | Given the backup read has not settled, when a heartbeat fires, then it carries presence but **no** draft backup payload; backups resume once the read settles with data, `null` or an error | PRD §2 AC-211 | stated |
| AC-212 | Given the backup read fails (network/5xx), when the editor renders, then it works normally, no notice appears, the request is not retried, and backups resume on the next heartbeat | PRD §2 AC-212 | stated |
| AC-213 | Given the backup is `null`, when it arrives, then no notice appears and later backups are not blocked | PRD §2 AC-213 | stated |
| AC-214 | Given the notice renders, then its strings come from `DRAFT_RESTORE_LABELS`, the container is `role="status"`, and both buttons are reachable by role and accessible name | PRD §2 AC-214 | stated |
| AC-215 | Given unsaved local edits in an open editor, when a refetch returns a newer `snapshot`, then the edits remain in the body and the badge stays **Draft** | PRD §3 AC-215 | stated |
| AC-216 | Given that refetch has happened, when Save is pressed, then the local edits are sent — they were not treated as already synced | PRD §3 AC-216 | stated |
| AC-217 | Given a brand-new document (`snapshot === null`), when the editor first paints, then the document is marked dirty on the dashboard | PRD §3 AC-217 | stated |
| AC-218 | Given `POST /docs/:id/save`, when the JSON body is between 1 MB and 5 MB it is accepted; over 5 MB it is refused with `413` | PRD §4 AC-218 | stated |
| AC-219 | Given a queued save just under 5 MB, when connectivity returns, then it flushes successfully and that document's queue empties | PRD §4 AC-219 | stated |
| AC-220 | Given a queued save has flushed, when the same document is opened offline, then the flushed content is shown, not the pre-save content | PRD §4 AC-220 | stated |
| AC-221 | Given a new worker already waiting at page load, when the page loads, then the update banner does **not** appear, the page ends up controlled by the new worker, and a second reload does not bring the banner back | PRD §5 AC-221 | stated |
| AC-222 | Given a document open and dirty, when a new worker installs in the background, then the banner appears and the page does **not** reload or swap on its own | PRD §5 AC-222 | stated |
| AC-223 | Given the session request is pending on a protected route, when the page renders, then the sidenav and top bar are visible and the spinner is confined to the content area | PRD §6 AC-223 | stated |
| AC-224 | Given an anonymous user on a protected route, when the session resolves empty, then they are redirected to login with the original path and query preserved, and the account badge shows no user details beforehand | PRD §6 AC-224 | stated |
| AC-225 | Given the API body limit and `QUEUE_ITEM_MAX_BYTES`, then the two values are equal (5 MB) | PRD §4 "One cap, two places… A save the client accepts into the queue must be one the server will take" | derived |

## Data and boundaries

| Field / input | Type | Valid range | Invalid examples | Source |
|---|---|---|---|---|
| `POST /docs/:id/save` JSON body | JSON | ≤ 5 MB (`express.json({ limit: "5mb" })`) | 5 MB + 1 byte → `413` | PRD §4 AC-218 |
| `QUEUE_ITEM_MAX_BYTES` | bytes | `5 * 1024 * 1024` | anything ≠ the API limit | PRD §4; `queue-schema.ts` |
| `DraftResponse.draft` | `{ update: string(base64), backedUpAt: string(ISO) } \| null` | non-null with valid base64 update; `null` = no backup | malformed base64 → UNKNOWN (U-1) | PRD §2 AC-204/AC-213 |
| `backedUpAt` | ISO timestamp | any past instant, rendered as relative time | future timestamp → UNKNOWN (U-2) | PRD §2 AC-204 |

## Roles and permissions

| Role | May | May not | Source |
|---|---|---|---|
| Owner | read own backup, see and act on the restore notice, back up on heartbeat | read another user's backup | PRD §2; techspec §4.1 |
| Editor | same as owner | same | PRD §2 AC-201 |
| Viewer | open the document read-only | request a draft backup; see the restore notice; have the heartbeat accept their update | PRD §2 AC-202; techspec §4.1 |
| Anonymous | nothing on a protected route | reach protected content; see account details | PRD §6 AC-224 |

## States — draft restore notice surface

| State | Specified? | Expected |
|---|---|---|
| default (no backup / `null`) | yes | no notice (AC-213) |
| backup adds nothing | yes | no notice (AC-209) |
| backup restorable | yes | notice with title, relative time, two buttons (AC-204) |
| loading (read in flight) | yes, partially | no notice; heartbeat withholds backup (AC-211). Whether a placeholder shows: UNKNOWN (U-3) |
| error | yes | no notice, no retry, editor normal (AC-212) |
| offline | yes | no request, no notice (AC-203) |
| unauthorised (viewer) | yes | no request, no notice (AC-202) |
| access revoked mid-session | partially | PRD §2 "Worth probing": restore is local; next heartbeat/save takes the access-revoked path. Exact UI: UNKNOWN (U-4) |
| success (after restore) | yes | notice closed, body merged, badge **Draft**, dashboard dirty (AC-206) |

## Contracts touched

- `GET /docs/:id/draft` → `DraftResponse` — read once per mount, `staleTime: Infinity`, `retry: false`. Endpoint itself unchanged (PRD out-of-scope).
- `POST /docs/:id/presence` (heartbeat) — optional draft-update payload; withheld until the read settles (AC-211).
- `POST /docs/:id/save` — express JSON body limit raised 1 MB → 5 MB (AC-218).
- Service worker `SKIP_WAITING` message channel; `caches.delete(url, { ignoreVary: true })` on `DOCS_CACHE` (AC-220).
- No DB or prisma schema change in this diff.

## Non-functional criteria

- a11y: notice is `role="status"`; buttons reachable by role + accessible name (AC-214). No WCAG level stated elsewhere.
- Browser matrix: PRD §8 states service-worker e2e is **Chromium only**.
- Performance: AC-210 states the restorable check runs once rather than per keystroke; no numeric budget is given.

## Observed, not specified

- `useOwnDraft` uses `retry: false` and `staleTime: Infinity` — matches AC-201/AC-212, but "not refetched on **reconnect**" is code-only. Question: should a reconnect refetch the backup?
- `require-session.tsx` passes `className="min-h-full"` into `SessionPending`; the exact height token is implementation, not a requirement. Only "confined to the content area" (AC-223) is testable intent.
- `restoreDraft` does not touch `lastSyncedVector` (code comment). PRD AC-206/207 state the observable consequence; the internal mechanism is not spec.
- `hasContentBeyond` builds a throwaway `Y.Doc` per call and destroys it. Not specified anywhere; observation only.

## UNKNOWN — needs a human decision

| # | Question | Why it blocks testing | Cheapest way to resolve |
|---|---|---|---|
| U-1 | What happens if `draft.update` is malformed base64 or an undecodable Yjs update? | No oracle for the error path; `hasContentBeyond` would throw inside a render effect | One line in PRD §2 |
| U-2 | Should the restorable check wait for IndexedDB hydration? (PRD Q-2) | AC-209's failure mode is exactly this race; a test either asserts "no notice" or "harmless noise" | PRD Q-2 needs an answer |
| U-3 | Is auto-`skipWaiting()` on load acceptable given `clients.claim()` swaps *every* open tab, including one mid-edit? (PRD Q-1, contradicts master spec §Phase 2 Part 3) | AC-221 and AC-222 are in direct tension; a P0 adversarial scenario has no oracle | Product decision on Q-1 |
| U-4 | Access revoked between backup read and restore — what should the user see? | PRD says "should take the existing access-revoked path" — "should" is not an oracle | One AC |
| U-5 | Should the 5 MB cap move to `packages/shared`? (PRD Q-4) | Does not block AC-218; determines whether a drift-guard test is worth writing | Team call |

## Assumptions taken

- **A-1:** "the badge reads **Draft**" means the existing `SyncBadge` draft state used elsewhere in the editor. Blast radius if wrong: AC-206 assertions target the wrong element; test fails loudly rather than silently.
- **A-2:** relative time rendering follows the existing `relativeTime` helper's format. Blast radius: AC-204's timestamp assertion is matched loosely (presence of a relative string) rather than exactly.
