"use client";

import {
  PAYLOAD_STORE,
  QUEUE_AUDIO_BUDGET_BYTES,
  QUEUE_BUDGET_BYTES,
  QUEUE_CHANNEL,
  QUEUE_DB_NAME,
  QUEUE_DB_VERSION,
  QUEUE_ITEM_MAX_BYTES,
  QUEUE_STALE_AFTER_MS,
  QUEUE_STORE,
  QUEUE_WARN_BYTES,
  type QueuedKind,
  type QueuedPayload,
  type QueuedSave,
} from "@/lib/offline/queue-schema";

/**
 * The offline save queue: durable, ordered, and never silently emptied.
 *
 * IndexedDB rather than localStorage because updates outgrow its ~5 MB and the
 * service worker writes here too, where the `storage` event never reaches.
 */

let dbPromise: Promise<IDBDatabase> | null = null;

function openQueueDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" }).createIndex("queuedAt", "queuedAt");
      }
      if (!db.objectStoreNames.contains(PAYLOAD_STORE)) {
        db.createObjectStore(PAYLOAD_STORE, { keyPath: "id" });
      }
    };

    /* Another connection is holding the old version open, so the upgrade cannot
       proceed. Without this the open request simply never settles. */
    request.onblocked = () =>
      reject(new Error("Save queue upgrade blocked by another tab or the service worker"));

    request.onsuccess = () => {
      const db = request.result;
      // Close on request, so this connection can never be what blocks the next
      // version's upgrade.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    // Let the next call retry rather than caching a rejected promise forever.
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function settled(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** An entry and its payload always move together, or neither does. */
async function withBothStores(run: (entries: IDBObjectStore, payloads: IDBObjectStore) => void) {
  const db = await openQueueDb();
  const tx = db.transaction([QUEUE_STORE, PAYLOAD_STORE], "readwrite");
  run(tx.objectStore(QUEUE_STORE), tx.objectStore(PAYLOAD_STORE));
  await settled(tx);
}

/* ------------------------------------------------------------------ reads -- */

const EMPTY: readonly QueuedSave[] = [];

/** Oldest first: replay order is queue order, which the index gives for free. */
export async function readQueue(): Promise<QueuedSave[]> {
  const db = await openQueueDb();
  const tx = db.transaction(QUEUE_STORE, "readonly");
  const entries = await promisify(
    tx.objectStore(QUEUE_STORE).index("queuedAt").getAll() as IDBRequest<QueuedSave[]>,
  );
  await settled(tx);
  return entries;
}

/** Read only when an entry is actually sent — payloads are the large half. */
export async function readPayload(id: string): Promise<QueuedPayload | undefined> {
  const db = await openQueueDb();
  const tx = db.transaction(PAYLOAD_STORE, "readonly");
  const payload = await promisify(
    tx.objectStore(PAYLOAD_STORE).get(id) as IDBRequest<QueuedPayload | undefined>,
  );
  await settled(tx);
  return payload;
}

export interface QueueIndex {
  /** Saves still waiting to send; rejected entries are counted separately. */
  pendingByDoc: ReadonlyMap<string, number>;
  rejectedByDoc: ReadonlyMap<string, number>;
  /** Recordings waiting to be transcribed (Phase 4.2), counted on their own:
   *  they are not document changes and must not read as unsaved work. */
  audioByDoc: ReadonlyMap<string, number>;
  totalPending: number;
}

const EMPTY_INDEX: QueueIndex = {
  pendingByDoc: new Map(),
  rejectedByDoc: new Map(),
  audioByDoc: new Map(),
  totalPending: 0,
};

function bump(counts: Map<string, number>, docId: string): void {
  counts.set(docId, (counts.get(docId) ?? 0) + 1);
}

function buildIndex(entries: readonly QueuedSave[]): QueueIndex {
  const pendingByDoc = new Map<string, number>();
  const rejectedByDoc = new Map<string, number>();
  const audioByDoc = new Map<string, number>();
  let totalPending = 0;

  for (const entry of entries) {
    if ((entry.kind ?? "save") === "audio") {
      if (entry.state !== "rejected") bump(audioByDoc, entry.docId);
      continue;
    }
    if (entry.state === "rejected") {
      bump(rejectedByDoc, entry.docId);
      continue;
    }
    bump(pendingByDoc, entry.docId);
    totalPending += 1;
  }

  return { pendingByDoc, rejectedByDoc, audioByDoc, totalPending };
}

export interface QueueTotals {
  totalBytes: number;
  audioBytes: number;
  /** Past 80% of the budget: worth telling the user before it refuses anything. */
  nearBudget: boolean;
  /** When the oldest waiting entry was queued, or null when nothing waits. */
  oldestQueuedAt: number | null;
  /** That entry is old enough for the browser itself to be a threat (§16.2). */
  stale: boolean;
}

/**
 * Size and age of the queue. Rejected entries count: they still occupy the
 * budget, and nothing is discarded without the user saying so.
 */
export function queueTotals(entries: readonly QueuedSave[]): QueueTotals {
  let totalBytes = 0;
  let audioBytes = 0;
  let oldestQueuedAt: number | null = null;

  for (const entry of entries) {
    totalBytes += entry.bytes;
    if ((entry.kind ?? "save") === "audio") audioBytes += entry.bytes;
    if (oldestQueuedAt === null || entry.queuedAt < oldestQueuedAt) oldestQueuedAt = entry.queuedAt;
  }

  return {
    totalBytes,
    audioBytes,
    nearBudget: totalBytes >= QUEUE_WARN_BYTES,
    oldestQueuedAt,
    stale: oldestQueuedAt !== null && Date.now() - oldestQueuedAt > QUEUE_STALE_AFTER_MS,
  };
}

let indexedSnapshot: readonly QueuedSave[] = EMPTY;
let cachedIndex: QueueIndex = EMPTY_INDEX;

/**
 * One pass over the queue, memoised on the snapshot reference and so shared by
 * every consumer — a dashboard filters the queue once, not once per row.
 */
export function queueIndex(entries: readonly QueuedSave[]): QueueIndex {
  if (entries !== indexedSnapshot) {
    cachedIndex = buildIndex(entries);
    indexedSnapshot = entries;
  }
  return cachedIndex;
}

/* ----------------------------------------------------------------- writes -- */

export type EnqueueRefusal =
  | "storage_unavailable"
  /** One entry is larger than the 5 MB per-item cap. */
  | "item_too_large"
  /** The 50 MB queue budget, or the 25 MB audio sub-cap, has no room for it. */
  | "queue_full"
  /** The browser itself has no room left, whatever our own budget says. */
  | "quota_exceeded";

export type EnqueueResult =
  | { ok: true; entry: QueuedSave }
  | { ok: false; reason: EnqueueRefusal };

/**
 * Asks the browser to keep this origin's storage. In Firefox it lifts the cap to
 * 50% of disk and exempts the origin from best-effort eviction; elsewhere it is
 * either automatic or a no-op. Fired once, on the first enqueue — never on load,
 * because some browsers prompt (§16.2).
 */
let persistRequested = false;
async function requestPersistentStorage(): Promise<void> {
  if (persistRequested || !navigator.storage?.persist) return;
  persistRequested = true;
  try {
    if (!(await navigator.storage.persisted?.())) await navigator.storage.persist();
  } catch {
    // Not supported, or refused. Nothing to do either way.
  }
}

/**
 * True when the browser says it cannot fit `bytes`, with headroom for the Yjs
 * draft and the caches. The real remaining quota is what actually matters, so
 * this is checked per enqueue rather than trusting our 50 MB budget blindly.
 */
async function browserIsOutOfRoom(bytes: number): Promise<boolean> {
  try {
    const { quota, usage } = (await navigator.storage?.estimate?.()) ?? {};
    if (quota === undefined || usage === undefined) return false;
    return quota - usage < bytes + 1024 * 1024;
  } catch {
    return false;
  }
}

/** A queued Yjs update, flushed by the service worker. */
export async function enqueueSave(input: {
  docId: string;
  update: string;
  csrf: string | null;
}): Promise<EnqueueResult> {
  /* Sized by the envelope the flush actually POSTs (`JSON.stringify({ update })`,
     see public/sw.js), not the raw base64 string — the server's express.json
     limit counts the transmitted bytes, wrapper included. */
  const envelopeBytes = new TextEncoder().encode(JSON.stringify({ update: input.update })).length;
  return enqueue("save", input.docId, envelopeBytes, (id) => ({
    id,
    update: input.update,
    csrf: input.csrf,
  }));
}

/**
 * A recording made while offline (Phase 4.2). Flushed by the page rather than the
 * worker: its transcript belongs in the dictation panel's own store, and it is
 * reviewed before anything reaches the document.
 */
export async function enqueueAudio(input: {
  docId: string;
  audio: Blob;
  csrf: string | null;
}): Promise<EnqueueResult> {
  return enqueue("audio", input.docId, input.audio.size, (id) => ({
    id,
    audio: input.audio,
    csrf: input.csrf,
  }));
}

async function enqueue(
  kind: QueuedKind,
  docId: string,
  bytes: number,
  buildPayload: (id: string) => QueuedPayload,
): Promise<EnqueueResult> {
  if (bytes > QUEUE_ITEM_MAX_BYTES) return { ok: false, reason: "item_too_large" };

  const existing = await readQueue().catch(() => EMPTY);
  const { totalBytes, audioBytes } = queueTotals(existing);
  const overBudget =
    totalBytes + bytes > QUEUE_BUDGET_BYTES ||
    (kind === "audio" && audioBytes + bytes > QUEUE_AUDIO_BUDGET_BYTES);
  if (overBudget) return { ok: false, reason: "queue_full" };

  if (await browserIsOutOfRoom(bytes)) return { ok: false, reason: "quota_exceeded" };

  const entry: QueuedSave = {
    id: crypto.randomUUID(),
    docId,
    kind,
    bytes,
    queuedAt: Date.now(),
    state: "queued",
    attempts: 0,
  };
  const payload = buildPayload(entry.id);

  const write = () =>
    withBothStores((entries, payloads) => {
      entries.add(entry);
      payloads.add(payload);
    });

  try {
    await write();
  } catch (error) {
    /* The write itself hit the wall. Drop re-fetchable cached documents — never
       queued work or drafts (§16.5 eviction order) — and try once more. */
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      if (!(await evictCachedDocuments())) return { ok: false, reason: "quota_exceeded" };
      try {
        await write();
      } catch {
        return { ok: false, reason: "quota_exceeded" };
      }
    } else {
      return { ok: false, reason: "storage_unavailable" };
    }
  }

  void requestPersistentStorage();
  notifyQueueChanged();
  return { ok: true, entry };
}

/**
 * First step of the §16.5 eviction order: cached document responses, which are
 * re-fetchable from the server. Queued saves, drafts and transcripts are never
 * touched. Returns whether anything was actually freed.
 */
async function evictCachedDocuments(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const names = (await caches.keys()).filter((name) => name.startsWith("docsync-docs-"));
    if (names.length === 0) return false;
    await Promise.all(names.map((name) => caches.delete(name)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears a document's rejected entries once the user has dealt with them. The
 * only path that removes queued work, and it exists solely because the user
 * asked — nothing here discards on its own (§16.2).
 */
export async function discardRejected(docId: string): Promise<void> {
  const rejected = (await readQueue()).filter(
    (entry) => entry.docId === docId && entry.state === "rejected",
  );
  if (rejected.length === 0) return;

  await withBothStores((entries, payloads) => {
    for (const entry of rejected) {
      entries.delete(entry.id);
      payloads.delete(entry.id);
    }
  });
  notifyQueueChanged();
}

/**
 * Removes one entry and its payload. Used by the page once a queued recording
 * has been transcribed — its transcript is the part with value, so the raw audio
 * goes (§Phase 4.2). Saves are removed by the worker instead, after the server
 * has them.
 */
export async function deleteQueued(id: string): Promise<void> {
  await withBothStores((entries, payloads) => {
    entries.delete(id);
    payloads.delete(id);
  });
  notifyQueueChanged();
}

/* --------------------------------------------------------- change notices -- */

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  channel ??= new BroadcastChannel(QUEUE_CHANNEL);
  return channel;
}

export function notifyQueueChanged(): void {
  getChannel()?.postMessage({ type: "queue-changed" });
  // BroadcastChannel does not echo to the sender, so refresh locally too.
  void refreshSnapshot();
}

const listeners = new Set<() => void>();
let unwire: (() => void) | null = null;

/**
 * The listener set is the fan-out: one channel subscription serves every
 * consumer, so a queue change costs one read rather than one read per row.
 */
export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);

  if (unwire === null) {
    const onMessage = () => {
      void refreshSnapshot();
    };
    const bc = getChannel();
    bc?.addEventListener("message", onMessage);
    // The worker reports flushes over its own channel, not BroadcastChannel.
    navigator.serviceWorker?.addEventListener("message", onMessage);

    unwire = () => {
      bc?.removeEventListener("message", onMessage);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
    void refreshSnapshot();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unwire?.();
      unwire = null;
    }
  };
}

/* ---------------------------------------------------------------- snapshot -- */

let snapshot: readonly QueuedSave[] = EMPTY;

/**
 * IndexedDB is async and `useSyncExternalStore` is not, so reads go through a
 * cached snapshot. The reference must stay stable until something changes, or
 * React loops.
 */
export function getQueueSnapshot(): readonly QueuedSave[] {
  return snapshot;
}

export function getQueueServerSnapshot(): readonly QueuedSave[] {
  return EMPTY;
}

async function refreshSnapshot(): Promise<void> {
  try {
    const next = await readQueue();
    const unchanged =
      next.length === snapshot.length &&
      next.every((entry, i) => entry.id === snapshot[i].id && entry.state === snapshot[i].state);
    if (unchanged) return;
    snapshot = next;
  } catch {
    snapshot = EMPTY;
  }

  for (const listener of listeners) listener();
}
