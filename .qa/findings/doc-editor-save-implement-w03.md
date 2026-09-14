# Proof manifest — doc-editor-save (w03)

Manifest: `.qa/runs/proof-doc-editor-save-w03.json`
Runner: `pnpm exec vitest run` (root command — the repo's root vitest config runs both the `web` and `server` projects, so one runner covers all 16 tests across the two workspaces; no per-proof runner was needed).

## Tests covered (16 entries, 1:1 with proofs)

| File | Tests | Mutation targets |
|---|---|---|
| `apps/web/lib/documents/dirty-docs.test.ts` | 6 | `apps/web/lib/documents/dirty-docs.ts` |
| `apps/web/components/documents/document-table.test.tsx` | 2 | `apps/web/components/documents/document-table.tsx` |
| `apps/server/src/routes/docs.save.test.ts` | 1 (of the 6 generated cases — see verdict below) | `apps/server/src/validators/docs.ts` |
| `apps/server/src/routes/docs.save.authz.test.ts` | 7 | `apps/server/src/middleware/require-role.ts`, `apps/server/src/routes/docs.ts`, `apps/server/src/middleware/auth.ts` |

All 16 `find` strings were verified as exact, unique (count == 1) substrings of their target source files with a script before writing the manifest.

Two of the authz proofs (the pair of "404 not_found" tests, for non-collaborator vs. unknown doc id) intentionally share the same mutation (`AppError.notFound` → `AppError.forbidden` in `require-role.ts`), because both tests exercise the identical `!access` branch in `requireRole` — there is no source-level distinction between "doc doesn't exist" and "caller isn't a collaborator on it" (both produce a null Prisma lookup). The mutation still fails each test independently: the non-collaborator test's own status/code assertions break, and the symmetry test's own direct `toBe(404)`/`toBe("not_found")` assertions break before the cross-response comparison is even reached.

## Verdict on the thin spot

`docs.save.test.ts` has exactly one `it()` call site (inside a `for` loop over 6 cases), generating 6 runtime tests under one shared description carrying `[AC-51][AC-52][AC-56]`. This is a **thin spot, not adequate as the sole coverage for three ACs**, for two reasons:

1. All 6 cases assert the same three things (400 status, `bad_request`/`invalid_update` code, document untouched) against different *malformed* payload shapes. That's good coverage of AC-51 (malformed rejected) and AC-52 (document untouched), but AC-56 — "process stays up, a subsequent well-formed request still succeeds" — is checked identically in every iteration via the trailing `GET` call, which only proves the read path survives, not that a *save* still works after a bad request. None of the 6 cases actually issues a valid follow-up save.
2. The loop only covers *malformed update content*. It doesn't cover a well-formed-but-oversized payload, or a valid base64 Yjs update against a doc that was deleted mid-flight — edge cases a single parametrized block can't surface because every case shares the same assertion shape.

I'd recommend one additional, distinct test: after a case in this loop, issue a real `POST /docs/:id/save` with a valid update and assert 200 + the new content persists — that's the only way to genuinely prove AC-56 rather than just the read path.
