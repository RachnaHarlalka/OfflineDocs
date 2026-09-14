# Test Basis: Document editor — explicit Save, offline drafts, viewer lock

- **Slug:** doc-editor-save
- **Session:** 20260914-055319-e25aa1d-u42r
- **Sources:**
  - `docs/phase1-part2-prd.md` — primary. Written for QA; §4 role matrix, §5 core flows, §6 viewer mode, §7 explicit out-of-scope list, §8 API reference, §9 acceptance checklist. Nearly every AC below is quoted from it.
  - `docs/phase1-techspec.md` §5.3 (`POST /docs/:id/save` contract, status codes, 404-not-403 rule), §6.3 (editor build notes: Y.Doc + y-indexeddb, viewer lock, title focus).
  - `docs/techspec.md` §4 (draft & save model, five sync states, CRDT-over-OT rationale), §9 (offline & conflict edge-case table), §17 (state model: "document content is owned by Yjs, never mirrored into a state manager").
  - `docs/DocSync-PRD.md` §6.3 (editor states), §6.6 (viewer mode), §7 (product-level sync model), §10 (a11y: label-and-icon, not colour alone).
  - `apps/server/prisma/schema.prisma` — contract only: `Doc.snapshot Bytes?`, `Doc.updatedAt @updatedAt`, `DocCollaborator @@id([docId,userId])`.
  - `packages/shared/src/types.ts` — contract only: `DocDetail.snapshot: string | null`, `SaveRequest`, `DocResponse`.
  - `apps/web/constants/labels.ts` — copy strings verbatim (`EDITOR_LABELS`, `SYNC_STATE_LABELS`). Used as the *assertion vocabulary*, per the project's selector policy; the PRD is the authority for which string appears when.
  - Implementation (`doc-editor.tsx`, `use-yjs-doc.ts`, `dirty-docs.ts`, `base64.ts`, `services/docs.ts`) — **location only**. Anything found only there is under "Observed, not specified".
- **Scope:** The document-editing vertical on branch `feature/edit-docs`: the `/doc/[id]` editor (title, body, Save, sync badge, offline and failure banners, viewer lock), local draft persistence, the dashboard's Draft/Saved badge, and `POST /docs/:id/save` (validation, merge, authorisation).
- **Out of scope:** Everything in `phase1-part2-prd.md` §7 — auto-save, save-on-reconnect queue replay, presence, push, sharing/invite UI, real-time co-editing, rich text, version history, dictation, PWA/service worker. Also: Part 1 dashboard CRUD (list/create/rename/delete/duplicate), Google OAuth sign-in, CSRF and session middleware (shipped and tested as Part 1), and the `pendingChangeCount` / draft-backup-heartbeat design in `techspec.md` §4.1/§17 — see UNKNOWN-6.

## Acceptance criteria

| ID | Given / When / Then | Source | Confidence |
|---|---|---|---|
| AC-1 | Given a document that has never been saved (`snapshot` is null), when the editor opens, then the title field shows the placeholder `"Untitled document"` | part2-PRD §5.1 "title field is empty (shows placeholder **\"Untitled document\"**)" | stated |
| AC-2 | Given a never-saved document, when the editor opens, then the body shows the placeholder `"Start writing…"` | part2-PRD §5.1 "body is empty (shows placeholder **\"Start writing…\"**)" | stated |
| AC-3 | Given a never-saved document, when the editor opens and before the user types anything, then the sync badge reads `Draft` | part2-PRD §5.1 "the status badge already reads **Draft** — before you type anything" | stated |
| AC-4 | Given a document previously saved and not since edited on this device, when the editor opens, then the sync badge reads `Saved` | part2-PRD §5.1 "Reopening a document that was previously saved with no further edits: status badge reads **Saved**" | stated |
| AC-5 | Given a document id the caller cannot access or that does not exist, when the editor opens, then it renders `"Couldn't load this document"` and a `Retry` control, and does not crash or render blank | part2-PRD §5.1 "editor shows **\"Couldn't load this document\"** with a **Retry** button (no crash, no blank screen)" | stated |
| AC-6 | Given the editor is in its load-error state, when `Retry` is activated, then the document fetch is re-issued | part2-PRD §5.1 "with a **Retry** button" | derived |
| AC-7 | Given focus is in the title field with a changed, non-empty title, when `Enter` is pressed, then the new title is committed | part2-PRD §5.2 "press **Enter** ... any of these commits the new title" | stated |
| AC-8 | Given focus is in the title field with a changed, non-empty title, when the field is blurred (Tab or click away), then the new title is committed | part2-PRD §5.2 "press **Tab**/click away (blur) ... commits the new title" | stated |
| AC-9 | Given focus is in the title field with a changed, non-empty title, when the user navigates away from the editor, then the new title is committed | part2-PRD §5.2 "or navigate away — any of these commits the new title" | stated |
| AC-10 | Given the title has been edited, when `Escape` is pressed, then the field reverts to the last-saved title, exits the field, and no rename request is made | part2-PRD §5.2 "Press **Escape** — reverts to the last-saved title and exits the field without committing" | stated |
| AC-11 | Given the title field is empty or whitespace-only, when it is blurred, then no rename request is made and the title reverts to its previous value | part2-PRD §5.2 "Leaving it empty or unchanged and blurring — no rename call is made; title reverts to what it was" | stated |
| AC-12 | Given the title is unchanged from the last-saved value, when it is blurred, then no rename request is made | part2-PRD §5.2, same sentence as AC-11 | stated |
| AC-13 | Given a committed title change, when it is sent, then it uses the existing rename endpoint (`PATCH /docs/:id`) immediately, independently of the Save button | part2-PRD §5.2 "saved via a **separate, immediate** API call (the existing rename endpoint) — independent of the Save button, which only covers the body" | stated |
| AC-14 | Given only the title has been edited (body untouched), when it is committed, then the body's unsaved/dirty state is unaffected — the Save button still covers only the body | part2-PRD §5.2 "the Save button, which only covers the body" | derived |
| AC-15 | Given the body field, when the user types, then input is plain text only with native textarea behaviour (native undo, selection) and no rich-text formatting is applied | part2-PRD §5.3 "Plain text only ... standard textarea behavior ... nothing custom"; §1 "no rich text (no bold/italic/lists/images)" | stated |
| AC-16 | Given a saved document, when the user types in the body, then the sync badge flips to `Draft` | part2-PRD §5.3 "The moment you type, status flips to **Draft**" | stated |
| AC-17 | Given a saved document, when the user types in the body, then the Save button becomes enabled | part2-PRD §5.3 "the Save button becomes enabled" | stated |
| AC-18 | Given unsaved body changes and an online editor session, when `Save` is clicked, then `POST /docs/:id/save` is issued with the outstanding changes as a base64 Yjs update | part2-PRD §5.4 "Click **Save**"; §8 "Request body: `{ \"update\": \"<base64>\" }` — a base64-encoded Yjs binary update" | stated |
| AC-19 | Given unsaved body changes, when `Cmd+S` (Mac) or `Ctrl+S` (Windows/Linux) is pressed anywhere in the editor, then the same save is triggered and the browser's own save dialog is suppressed | part2-PRD §5.4 "or press **Cmd+S** (Mac) / **Ctrl+S** (Windows/Linux) anywhere in the editor" | stated |
| AC-20 | Given the caller's role on the document is `viewer`, then no Save control is present in either the desktop top bar or the mobile bottom bar | part2-PRD §5.4 "Save button is disabled whenever: you're a Viewer"; §4 "❌ (no Save button at all)"; §6 "No Save button anywhere on the page" | stated |
| AC-21 | Given the browser reports offline, then the Save control is disabled in both its desktop and mobile locations | part2-PRD §5.4 "disabled whenever ... you're offline"; §5.5 "The Save button (both button locations) is disabled" | stated |
| AC-22 | Given there is nothing unsaved (badge already reads `Saved`), then the Save control is disabled | part2-PRD §5.4 "disabled whenever ... there's nothing unsaved (status is already Saved)" | stated |
| AC-23 | Given a save request is already in flight, then the Save control is disabled | part2-PRD §5.4 "disabled whenever ... a save is already in progress"; "While saving: badge reads **Saving…**, button is disabled" | stated |
| AC-24 | Given a save request is in flight, then the sync badge reads `Saving…` | part2-PRD §5.4 "While saving: badge reads **Saving…**" | stated |
| AC-25 | Given a save request succeeds, then the sync badge reads `Saved` | part2-PRD §5.4 "On success: badge flips to **Saved**" | stated |
| AC-26 | Given a save succeeded, when the user returns to the dashboard, then that document's row badge and its details-drawer badge both read `Saved` | part2-PRD §5.4 "the dashboard row/drawer for this document (if you go back) also reflects **Saved**" | stated |
| AC-27 | Given the editor is online and the save request fails server-side, then a banner reads `"Couldn't save. Try again."` with a `Retry` control | part2-PRD §5.4 "a banner reads **\"Couldn't save. Try again.\"** with a **Retry** link" | stated |
| AC-28 | Given a save request has failed, then the sync badge reads `Save failed` | part2-PRD §5.4 "the badge reads **Save failed**" | stated |
| AC-29 | Given a save request has failed, then the user's typed content remains in the editor and remains outstanding for the next save | part2-PRD §5.4 "Your typed content is not lost — only the save attempt failed" | stated |
| AC-30 | Given a failed save, when `Retry` is activated, then the same outstanding changes are re-sent | part2-PRD §5.4 "with a **Retry** link" | derived |
| AC-31 | Given body text `X` was typed and saved successfully, when the document is loaded fresh from the server (new session, new device), then the body contains exactly `X` | part2-PRD §5.1 "Reopening a document that was previously saved"; §8 "`200` — `{ \"doc\": { ...DocSummary } }`, reflecting the new `updatedAt`"; techspec §4 "merges each incoming Save against the canonical doc" | derived |
| AC-32 | Given a save is in flight and the user types more, when that save succeeds, then the keystrokes typed during the request are still outstanding (badge returns to `Draft`, Save re-enabled) and are included in the next save | part2-PRD §5.3 "The moment you type, status flips to **Draft**" + §5.4 "disabled whenever ... there's nothing unsaved"; techspec §17 "document content is owned by Yjs" | derived |
| AC-33 | Given the editor is open and the device goes offline, then the user can continue typing — input is never blocked | part2-PRD §5.5 "You can keep typing freely — nothing blocks input"; DocSync-PRD §6.3 offline row: "**editing remains fully enabled**" | stated |
| AC-34 | Given the device is offline, then the sync badge reads `Offline` | part2-PRD §5.5 "Status badge reads **Offline**" | stated |
| AC-35 | Given the device is offline (non-viewer), then a banner reads `"You're offline — reconnect to save."` | part2-PRD §5.5 "A banner reads **\"You're offline — reconnect to save.\"**" | stated |
| AC-36 | Given unsaved changes made while offline, when the device comes back online, then nothing is sent automatically — the document stays unsaved until the user clicks Save again | part2-PRD §5.5 "Coming back online does **not** auto-save. You must click Save again yourself"; §7 "Auto-flush-on-reconnect is Phase 2" | stated |
| AC-37 | Given body text typed but never saved, when the tab or browser is closed and the same document URL is reopened in the same browser, then the unsaved text is restored | part2-PRD §5.6 "your unsaved text is still there"; techspec §9 "Draft Yjs state + IndexedDB persist; restored on relaunch" | stated |
| AC-38 | Given a restored unsaved draft, when the editor renders it, then the sync badge reads `Draft` — it was never silently saved | part2-PRD §5.6 "the status badge still reads **Draft** — it was never silently saved, just recovered locally" | stated |
| AC-39 | Given a never-saved local draft in browser A, when the same document is opened in a different browser or a private window, then the draft is not present and the document reads as its last server-saved state | part2-PRD §5.6 "Opening the same never-saved document in a *different* browser or a private/incognito window will **not** show the draft — that's expected, not a bug" | stated |
| AC-40 | Given a document has unsaved local changes on this device, then its dashboard row badge reads `Draft` | part2-PRD §5.7 "its dashboard row and its details drawer both show a **Draft** status badge, not Saved" | stated |
| AC-41 | Given a document has unsaved local changes on this device, then its details-drawer badge reads `Draft` | part2-PRD §5.7, same sentence as AC-40 | stated |
| AC-42 | Given a document with no unsaved local changes on this device, then its dashboard row and drawer badges read `Saved` | part2-PRD §5.7 "not Saved" (inverse); §5.4 "the dashboard row/drawer ... also reflects **Saved**" | derived |
| AC-43 | Given a document edited without saving on device A, when the dashboard is opened on device B, then that document still shows `Saved` there — draft state never leaks across devices | part2-PRD §5.7 "a *different* browser's dashboard will still show that same document as **Saved**" | stated |
| AC-44 | Given the dashboard is open in one tab and the editor in another tab of the same browser, when the editor marks the document dirty, then the dashboard tab's badge updates to `Draft` without a manual refresh | part2-PRD §5.7 "the dashboard tab's badge updates automatically when the editor tab marks the document dirty (no manual refresh needed)" | stated |
| AC-45 | Given the caller's role is `viewer`, then the title field is visible but not editable | part2-PRD §6 "Title input: visible but not editable (no cursor/focus behavior)" | stated |
| AC-46 | Given the caller's role is `viewer`, then the body is visible but read-only | part2-PRD §6 "Body: visible but not editable (read-only)" | stated |
| AC-47 | Given the caller's role is `viewer`, then neither the offline banner nor the save-failed banner is ever shown | part2-PRD §6 "No offline banner, no save-failed banner (there's nothing to save as a viewer)" | stated |
| AC-48 | Given the caller's role is `viewer`, then a `View only` badge is shown next to the sync-status badge at all times | part2-PRD §4 "A Viewer's editor screen shows a **\"View only\"** badge next to the sync-status badge"; §6 same | stated |
| AC-49 | Given a valid session, a CSRF header and `editor`-or-above role, when `POST /docs/:id/save` is sent with a valid base64 Yjs update, then it returns `200` with `{ doc: DocSummary }` whose `updatedAt` reflects the merge | part2-PRD §8 "`200` — `{ \"doc\": { ...DocSummary } }`, reflecting the new `updatedAt`" | stated |
| AC-50 | Given a valid save, when it is applied, then the incoming update is **merged into** the stored snapshot, not substituted for it — a prior collaborator's saved text survives | techspec §4 "merges each incoming Save against the canonical doc"; §9 "Two users Save divergent offline edits ... Yjs CRDT merges automatically on the backend"; phase1-techspec §5.3 "merge a Yjs update" | stated |
| AC-51 | Given `POST /docs/:id/save` with an `update` that is not decodable as a valid Yjs update (e.g. `"not-a-real-update"`), then it returns `400` with a `bad_request`-family code | part2-PRD §8 "`400 bad_request` / `invalid_update` — malformed base64, or bytes that don't decode as a valid Yjs update"; phase1-techspec §5.3 "reject rather than silently dropping it" | stated |
| AC-52 | Given a rejected (`400`) save, then the stored document is unchanged — no partial write, no corruption, no server crash | part2-PRD §8 "should be rejected cleanly, not crash the server or corrupt the document"; §9 checklist "returns `400`, doesn't corrupt the document" | stated |
| AC-53 | Given the caller's role on the document is `viewer`, when they call `POST /docs/:id/save`, then it returns `403 forbidden` regardless of what the UI allows | part2-PRD §8 "`403 forbidden` — caller's role on this document is `viewer`"; techspec §9 "Save endpoint also rejects it server-side as defense in depth" | stated |
| AC-54 | Given the document does not exist, **or** exists but the caller has no collaborator row, when they call `POST /docs/:id/save`, then it returns `404 not_found` — the same status and code in both cases | part2-PRD §8 "`404 not_found` — no such document, or the caller isn't a collaborator on it (same code either way, deliberately)"; phase1-techspec §5.3 "so a non-collaborator can't distinguish" | stated |
| AC-55 | Given no authenticated session, when `POST /docs/:id/save` is called, then it returns `401 unauthorized` | part2-PRD §8 "requires an authenticated session + CSRF header, same as every other mutating endpoint"; phase1-techspec §5.3 "Every endpoint below implicitly also returns `401 unauthorized` if the session cookie is missing/expired" | stated |
| AC-56 | Given a request body with `update` missing, empty, or not a string, when `POST /docs/:id/save` is called, then it returns `400` and does not reach the merge | phase1-techspec §5.3 "Request: `SaveRequest` — `{ update: string }`, base64"; part2-PRD §8 | derived |
| AC-57 | Given the body contains characters outside the Basic Multilingual Plane (emoji, surrogate pairs), when the text is edited and saved, then those characters survive the edit and the round-trip unaltered — no replacement characters | part2-PRD §5.3 "Plain text ... standard textarea behavior ... nothing custom" + §5.4 "Your typed content is not lost"; techspec §17 "content is owned by Yjs" | derived |
| AC-58 | Given sync status is presented, then it is conveyed by label **and** icon, not by colour alone | DocSync-PRD §10 "Sync state is communicated by label and icon, not colour alone"; techspec §4 same | stated |

## Data and boundaries

| Field / input | Type | Valid range | Invalid examples | Source |
|---|---|---|---|---|
| `SaveRequest.update` | string | non-empty base64 encoding of a Yjs update that applies against the stored snapshot | `""`, missing key, `null`, number, `"not-a-real-update"`, base64 of foreign/corrupt bytes, truncated update | part2-PRD §8; phase1-techspec §5.3; `packages/shared/src/types.ts` `SaveRequest` |
| `Doc.snapshot` (stored) | `Bytes?` (nullable) | null for a never-saved doc; otherwise a full Yjs state-as-update | — | `apps/server/prisma/schema.prisma` |
| `DocDetail.snapshot` (wire) | `string \| null` | base64 of the above | — | `packages/shared/src/types.ts` |
| Document title | string | non-empty after trim; **max length unspecified** (UNKNOWN-7) | `""`, `"   "` | part2-PRD §5.2; phase1-techspec §5.3 "400 `bad_request`: empty/whitespace-only title" |
| Document body text | string | plain text, any Unicode incl. astral plane (AC-57); **max length unspecified** (UNKNOWN-7) | — | part2-PRD §5.3 |
| `:id` path param | string | an existing doc id the caller collaborates on | unknown id, malformed id, id of a doc the caller has no row for | part2-PRD §8 |
| Connectivity | boolean | online / offline, driven by the browser's own signal | "dead Wi-Fi that still reports online" — PRD calls this out as a known test hazard, not a product state | part2-PRD §5.5; DocSync-PRD §7 "Connectivity state drives every sync badge" |
| Dirty-doc marker | per-device set of doc ids | must not be sent to or read from the server | — | part2-PRD §5.7 "This is per-device" |

## Roles and permissions

| Role | May | May not | Source |
|---|---|---|---|
| Owner | Open and read; edit title and body; Save; rename and delete from the dashboard row menu; Duplicate; see "Manage access" (disabled, tooltip "Sharing isn't built yet — coming in a later phase") | — | part2-PRD §4 |
| Editor | Open and read; edit title and body; Save; Duplicate | Rename or delete from the dashboard row menu; see "Manage access" | part2-PRD §4 |
| Viewer | Open and read; Duplicate | Edit title; edit body; Save (no button at all; server returns 403); rename; delete; see "Manage access" | part2-PRD §4, §6, §8 |
| Non-collaborator | — | Anything on this document; must be indistinguishable from "document does not exist" (`404`) | part2-PRD §8; phase1-techspec §5.3 |
| Unauthenticated | — | Anything; `401` | phase1-techspec §5.3 |

Note: role is **per document** (`DocCollaborator`), not per user (`schema.prisma`). part2-PRD §3 states there is no in-product way to create a second collaborator in this phase — a row must be inserted directly, which is why AC-45..AC-48 and AC-53 need a seeded fixture rather than a UI flow.

## States

Surface: **editor (`/doc/[id]`)**

| State | Specified behaviour | Source |
|---|---|---|
| Default (saved doc) | Title + body populated, badge `Saved`, Save disabled | part2-PRD §5.1, §5.4 |
| Empty (never-saved doc) | Title placeholder "Untitled document", body placeholder "Start writing…", badge `Draft` | part2-PRD §5.1 |
| Loading | **UNKNOWN** — no source describes the editor's pre-data state (UNKNOWN-3) | — |
| Partial | **UNKNOWN** — no source describes a partially-loaded document (snapshot present, metadata missing or vice versa) | — |
| Dirty | Badge `Draft`, Save enabled | part2-PRD §5.3 |
| Saving | Badge `Saving…`, Save disabled | part2-PRD §5.4 |
| Save failed | Badge `Save failed`, banner "Couldn't save. Try again." + Retry, content retained | part2-PRD §5.4 |
| Offline | Badge `Offline`, banner "You're offline — reconnect to save.", Save disabled, typing enabled | part2-PRD §5.5 |
| Offline **and** a prior save failed | **UNKNOWN** — which badge and which banner wins is unspecified (UNKNOWN-4) | — |
| Dirty **after** a failed save | **UNKNOWN** — §5.3 says typing flips to `Draft`; §5.4 says a failed save shows `Save failed`. Conflict (UNKNOWN-5) | — |
| Unauthorised (viewer) | Read-only title and body, `View only` badge, no Save, no banners | part2-PRD §4, §6 |
| Error / not found | "Couldn't load this document" + Retry | part2-PRD §5.1 |
| Success | Badge `Saved`; dashboard row/drawer agree | part2-PRD §5.4 |

Surface: **dashboard row / details drawer** — only the sync badge changes in this branch: `Draft` when this device holds unsaved changes for that doc, `Saved` otherwise (AC-40..AC-43). All other dashboard states are Part 1 and out of scope.

## Contracts touched

- `POST /docs/:id/save` — auth: session cookie + CSRF header; minimum role `editor`. Request `{ update: string }` (base64 Yjs update). `200 { doc: DocSummary }` · `400` malformed/undecodable update or missing field · `401` no session · `403` viewer · `404` unknown doc or non-collaborator. (part2-PRD §8; phase1-techspec §5.3)
- `GET /docs/:id` — auth: viewer+. `200 { doc: DocDetail }` including `snapshot: string | null` (base64). `404` for unknown doc **and** non-collaborator alike. (phase1-techspec §5.3)
- `PATCH /docs/:id` — rename; used by the editor's title commit (AC-13). Owner-only per phase1-techspec §5.3; note UNKNOWN-2, since part2-PRD §4 also grants editors title editing.
- `GET /docs` — unchanged contract; the list is the source of the dashboard rows whose badge now depends on local dirty state.
- DB: `Doc.snapshot Bytes?`, `Doc.updatedAt @updatedAt` (must advance on save), `DocCollaborator @@id([docId, userId])` with `role` enum — the sole authorisation source.
- Browser storage: IndexedDB per document for the Yjs draft (part2-PRD §5.6, phase1-techspec §6.3 "persisted via `y-indexeddb`"); a per-origin marker of which docs are dirty, required to be per-device (AC-43) and cross-tab reactive (AC-44).

## Non-functional criteria

- **A11y:** sync state by label + icon, never colour alone (DocSync-PRD §10, AC-58). Visible focus ring on every interactive element; touch targets ≥ 44px (mobile Save bar). Text contrast ≥ 4.5:1. (DocSync-PRD §10) — the project config marks `a11y` as an unavailable test level, so these are manual checks.
- **Responsive:** desktop top-bar Save; mobile bottom action bar Save — both must obey the same disabled rules (AC-21). Breakpoints 1440 / 768 / 390 (DocSync-PRD §6.7).
- **Perf:** no budget stated in any source for this feature.
- **i18n / retention:** nothing stated.

## Observed, not specified

Found only in the implementation. Each is an observation, not intent.

1. `apps/web/lib/documents/base64.ts` `bytesToBase64` masks every byte with `& 0x7f` before `String.fromCharCode`, discarding bit 7. Yjs updates are varint-encoded and routinely contain bytes ≥ 0x80. **Question for a human: is this mask intentional?** If not, every save payload is corrupted before it leaves the browser — which lands as either a `400` (AC-51 path firing on legitimate saves) or, worse, a silently wrong merge. Nothing in any source sanctions lossy encoding; the specified behaviour is AC-31/AC-50.
2. `apps/server/src/services/docs.ts` `saveDoc` decodes with `Buffer.from(update, "base64")`, which never throws — invalid base64 characters are silently dropped. Only `Y.applyUpdate` is inside the `try`. **Question: for a payload whose garbage bytes happen to decode as a no-op Yjs update, is `200` acceptable, or must malformed base64 be rejected on shape as PRD §8 says?**
3. `apps/server/src/services/docs.ts` applies the *stored* snapshot outside the `try`, so a corrupt stored snapshot surfaces as a 500 rather than a handled error. **Question: is there a required behaviour for an unreadable stored snapshot?**
4. `apps/server/src/validators/docs.ts` `saveDocSchema` checks only `z.string().min(1)` — no base64 shape check. **Question: is shape validation expected at the validator, per PRD §8's "malformed base64 → 400"?**
5. `apps/web/components/documents/doc-editor.tsx` resolves the badge in the fixed precedence `saving > offline > error > draft > saved`. **Question: is that the intended precedence?** It decides UNKNOWN-4 and UNKNOWN-5 by accident rather than by decision.
6. `doc-editor.tsx` binds the shortcut on `event.key === "s"` only. **Question: should `Cmd+Shift+S` / caps-lock (`"S"`) also save, or deliberately not?**
7. `doc-editor.tsx` does not autofocus the title for a never-saved document, while `phase1-techspec.md` §6.3 says "Title field: focused on open for an untitled doc (PRD §6.3)". See UNKNOWN-1.
8. `doc-editor.tsx` commits the title on `blur` only; there is no unmount/route-change commit, so AC-9 ("navigate away commits") depends on whether the browser fires blur for that navigation. See UNKNOWN-2.
9. A failed rename (title commit) has no error surface at all — the mutation result is never read. **Question: what should the user see when a title save fails?** See UNKNOWN-8.
10. `use-documents.ts` sets `staleTime: Infinity` on the document-detail query and patches the cache instead of invalidating it, explicitly to stop a refetch clobbering the in-memory Yjs doc. `phase1-techspec.md` §6.3 instead says "invalidate the dashboard's doc-list query key". The implementation's choice looks deliberate and safer, but it is an implementation decision, not a stated requirement.
11. Dirty state is stored under the `localStorage` key `docsync:dirty-docs` and subscribes to the `storage` event (cross-tab only). No source names a mechanism — only the per-device and cross-tab *properties* (AC-43, AC-44).
12. `dirty-docs.ts` swallows corrupt JSON and storage failures, degrading to "nothing dirty". **Question: is degrading to `Saved` acceptable, given `Saved` is the reassuring state and the failure is silent?**
13. `createDoc` on the server defaults `title` to the literal string `"Untitled document"`, so a new document arrives with that text as a *value*, while part2-PRD §5.1 describes it as a *placeholder* on an empty field. Visually identical, behaviourally different. See UNKNOWN-9.

## UNKNOWN — needs a human decision

| # | Question | Why it blocks testing | Cheapest way to resolve |
|---|---|---|---|
| UNKNOWN-1 | Must the title field be focused on open for a never-saved document? `phase1-techspec.md` §6.3 and `DocSync-PRD.md` §6.3 both say yes; `phase1-part2-prd.md` §5.1 (the QA-facing doc) lists the new-document expectations and omits it. | Blocks an assertion on initial focus, and interacts with AC-1/AC-2 (a focused empty field vs a pre-filled title). | One line from the owner in part2-PRD §5.1. |
| UNKNOWN-2 | Who may rename? part2-PRD §4 gives "Edit title" to Owner **and** Editor, but restricts "Rename from dashboard row menu" to Owner — and `PATCH /docs/:id` is owner-only per phase1-techspec §5.3. Does an Editor's in-editor title commit succeed or 403? | Blocks AC-13 for the editor role, and decides whether the editor's title field should be disabled for editors. A wrong guess here writes a test that enshrines a permissions bug. | Product answer + confirm the intended status code for an editor's `PATCH`. |
| UNKNOWN-3 | What does the editor show between navigation and data arrival? | No oracle for the loading state; any assertion would be copied from the implementation. | Name the expected loading treatment (skeleton / spinner / nothing) in part2-PRD §5.1. |
| UNKNOWN-4 | Offline **and** a previously failed save: which badge and which banner wins? | Two ACs (AC-28, AC-34; AC-27, AC-35) both claim the surface with no stated precedence. | One precedence sentence in part2-PRD §5.4/§5.5. |
| UNKNOWN-5 | After a failed save, the user types again. §5.3 says typing flips the badge to `Draft`; §5.4 says a failed save shows `Save failed`. Which is correct, and does the failure banner clear on the next keystroke? | Directly contradictory ACs (AC-16 vs AC-28). Blocks the failure-recovery scenario. | Product decision; likely "keep the banner, badge returns to Draft" but must be stated. |
| UNKNOWN-6 | `DocSync-PRD.md` §7/§8 and `techspec.md` §4 require a `pendingChangeCount` on dashboard rows and the editor top bar, and a `Reconnecting`/`Reconnected` state. part2-PRD §7 defers reconnect queueing to Phase 2 but never mentions `pendingChangeCount`. Is it deferred too? | Decides whether two specified UI elements are missing features or correctly out of scope. | Add `pendingChangeCount` to part2-PRD §7's deferral table, or specify it. |
| UNKNOWN-7 | Maximum title length and maximum body length? | No boundary values exist to test at/just-below/just-above; also no stated behaviour for a very large Yjs payload hitting the request body limit. | Pick limits (or state "none, bounded by the request body limit" and give that number). |
| UNKNOWN-8 | What should the user see when the title's rename call fails (offline, 403, 500)? | AC-13 specifies the happy path only; the failure path has no oracle at all, and the title is the only thing that saves without an explicit user action. | One row in part2-PRD §5.2. |
| UNKNOWN-9 | For a brand-new document, is the title an empty field with the placeholder "Untitled document" (part2-PRD §5.1) or a field pre-filled with the literal title "Untitled document" (the server's create default)? | AC-1's assertion differs entirely between the two — `toHaveValue("")` + placeholder vs `toHaveValue("Untitled document")`. | Confirm which; adjust either the server default or the PRD sentence. |
| UNKNOWN-10 | Is there a required behaviour when IndexedDB is unavailable (private window, storage denied, quota exceeded)? AC-37/AC-38 assume it works; AC-39 says a private window shows no draft. | No oracle for draft persistence failing mid-session — arguably the highest-consequence silent failure in the feature. | State the expected degradation (silently no local draft vs a visible warning). |

## Assumptions taken

- **A-1:** "Dashboard row/drawer reflects Draft" (AC-40/41) is assumed to mean *this device's* unsaved state only, never a server-reported flag — part2-PRD §5.7's "per-device" paragraph makes this near-certain. Blast radius if wrong: AC-43 inverts and the dirty-marker mechanism is the wrong design, not just the wrong test.
- **A-2:** `403` and `404` on the save endpoint are assumed to be produced by the shared `requireRole` middleware, so their bodies follow the existing `ApiErrorResponse` shape with codes `forbidden` / `not_found`. Sourced from phase1-techspec §5.3's blanket paragraph, not from a per-endpoint statement. Blast radius: only the asserted error *code*; the status codes are stated explicitly.
- **A-3:** The 400 for a malformed update is assumed to be acceptable as either code `bad_request` or `invalid_update` — part2-PRD §8 writes them as alternatives ("`400 bad_request` / `invalid_update`"). Tests assert on status and on "document unchanged", and treat the exact code as non-load-bearing. Blast radius: a client that branches on the code would not be covered.
- **A-4:** "Both button locations" (AC-21) is assumed to mean the desktop top-bar Save and the mobile bottom-bar Save are two renderings of the same state, so the disabled rules are asserted once per location but derived from one condition. Blast radius: if they ever diverge, only the tested viewport is covered.
- **A-5:** Out-of-scope per part2-PRD §7 is taken at face value: no criterion is written for auto-save, reconnect flush, presence, push, sharing, rich text, version history, dictation or PWA, even where `DocSync-PRD.md`/`techspec.md` specify them. Blast radius: if part2-PRD §7 is stale, those features ship untested — see UNKNOWN-6 for the one case where the deferral is not explicit.
