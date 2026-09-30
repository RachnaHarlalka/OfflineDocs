/** Shared by the page and the service worker, which both open this database. */

export const QUEUE_DB_NAME = "docsync-save-queue";
export const QUEUE_DB_VERSION = 1;

/** Entry metadata, read often — counts, badges, replay order. */
export const QUEUE_STORE = "entries";
/** The update itself, read only when an entry is actually sent. */
export const PAYLOAD_STORE = "payloads";

/** Carries queue changes between tabs. */
export const QUEUE_CHANNEL = "docsync-save-queue";

export type QueuedSaveState = "queued" | "sending" | "rejected";

/**
 * What the entry carries. Saves are flushed by the service worker; audio is
 * flushed by the page, which is where a transcript has somewhere to go
 * (spec Phase 4.2). Absent on entries written before dictation queued anything,
 * so read it as `kind ?? "save"`.
 */
export type QueuedKind = "save" | "audio";

export interface QueuedSave {
  id: string;
  docId: string;
  kind?: QueuedKind;
  /** Payload size, for the §16.2 caps. */
  bytes: number;
  queuedAt: number;
  state: QueuedSaveState;
  attempts: number;
}

/**
 * Queue limits from §16.2. Anchored to Safari's ~1 GB floor, which is the
 * binding constraint and the one that prompts the user.
 *
 * Nothing is ever evicted to make room: over budget, the *new* entry is refused
 * and the user is told. The oldest entry is both the most at risk and the most
 * likely to be the one they care about.
 */
export const QUEUE_BUDGET_BYTES = 50 * 1024 * 1024;
/** 80% of the budget: early enough to act on, late enough not to nag. */
export const QUEUE_WARN_BYTES = 40 * 1024 * 1024;
/** Half the budget, so dictation can never crowd out a queued save. */
export const QUEUE_AUDIO_BUDGET_BYTES = 25 * 1024 * 1024;
/** Bounds one pathological entry. Mirrored by the API's own body limit
 *  (server: app.ts) — a save this side accepts must be one the server will take. */
export const QUEUE_ITEM_MAX_BYTES = 5 * 1024 * 1024;

/**
 * WebKit deletes script-writable storage for an origin with no interaction in
 * seven days of browser use, so a change older than this is at risk of being
 * deleted by the browser rather than merely stale. We warn; we never discard.
 */
export const QUEUE_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface QueuedPayload {
  id: string;
  /** Base64 Yjs update, exactly as POST /docs/:id/save expects it. Saves only. */
  update?: string;
  /* Captured at enqueue: the worker sends this request later and cannot read
     document.cookie, where the CSRF token lives. */
  csrf: string | null;
  /** Dictation audio, stored as a Blob — IndexedDB takes one directly, so the
   *  recording never has to be inflated by a third into base64. Audio only. */
  audio?: Blob;
}
