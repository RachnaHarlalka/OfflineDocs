"use client";

// Whether a doc has unsaved local changes is inherently per-device state — the
// server has no way to know about edits that were never sent to it. This is a
// small localStorage-backed side channel so the dashboard (which never opens
// a Y.Doc for rows it isn't editing) can still show an accurate badge, without
// spinning up a full Yjs + IndexedDB instance per row just to check.

const STORAGE_KEY = "docsync:dirty-docs";
const EMPTY_SET: ReadonlySet<string> = new Set();

// Cached so repeated reads (useSyncExternalStore calls getSnapshot on every
// render to check for tears) return the *same* Set reference when nothing
// changed — a fresh Set each call would make React think it changes every
// render and warn/loop.
let cachedRaw: string | null | undefined;
let cachedSet: ReadonlySet<string> = EMPTY_SET;

function readIds(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY_SET;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSet;
  cachedRaw = raw;
  try {
    cachedSet = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // Corrupt value or storage unavailable (private browsing, quota) —
    // degrade to "nothing known dirty" rather than throwing.
    cachedSet = EMPTY_SET;
  }
  return cachedSet;
}

function writeIds(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedSet = ids;
  } catch {
    // Same degrade-gracefully reasoning as readIds — this is a UI nicety,
    // not the source of truth for the doc's actual saved content.
  }
}

export function markDocDirty(docId: string): void {
  const ids = readIds();
  if (ids.has(docId)) return;
  writeIds(new Set(ids).add(docId));
}

export function markDocClean(docId: string): void {
  const ids = readIds();
  if (!ids.has(docId)) return;
  const next = new Set(ids);
  next.delete(docId);
  writeIds(next);
}

/** For `useSyncExternalStore` — cached, so safe to call on every render. */
export function getDirtyDocIdsSnapshot(): ReadonlySet<string> {
  return readIds();
}

export function getDirtyDocIdsServerSnapshot(): ReadonlySet<string> {
  return EMPTY_SET;
}

export function subscribeDirtyDocIds(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
