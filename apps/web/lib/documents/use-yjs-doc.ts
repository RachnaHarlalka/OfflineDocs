"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { base64ToBytes, bytesToBase64 } from "@/lib/documents/base64";
import { markDocClean, markDocDirty } from "@/lib/documents/dirty-docs";

const BODY_FIELD = "body";

export interface YjsDoc {
  body: string;
  setBody: (next: string) => void;
  /** True from the moment there's anything not yet reflected in the last successful save —
   *  including a locally-cached draft from a previous offline session, restored on load. */
  isDirty: boolean;
  /** Everything not yet known to the server, encoded as a single update. Also records the
   *  doc state this payload covers, which the matching markSaved() commits — the caller
   *  must pair exactly one markSaved() with each encodeUpdate() it actually sends. */
  encodeUpdate: () => string;
  /** Call once a save succeeds so the next encodeUpdate() is a fresh delta, not the whole doc.
   *  Commits the state captured by the encodeUpdate() that produced the sent payload, so
   *  anything typed while the request was in flight stays outstanding (and still dirty). */
  markSaved: () => void;
}

const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

function isHighSurrogate(code: number): boolean {
  return code >= HIGH_SURROGATE_START && code <= HIGH_SURROGATE_END;
}

function isLowSurrogate(code: number): boolean {
  return code >= LOW_SURROGATE_START && code <= LOW_SURROGATE_END;
}

/** The state one save carried, captured when its payload was encoded rather than when its
 *  response arrived — see markSaved(). */
interface SentSave {
  vector: Uint8Array;
  editCount: number;
}

/**
 * One Y.Doc per mounted editor, seeded from the server's last-saved snapshot and then
 * bound to IndexedDB so an interrupted session (crash, offline close) isn't lost on
 * reload. There's no live transport in this phase — a collaborator's edits only arrive
 * on the next fetch of this doc, per techspec §4.
 *
 * Callers must remount this (e.g. `key={docId}` at the call site) rather than expect it
 * to react to `docId`/`snapshot` changing in place — the Y.Doc is created once per mount.
 */
export function useYjsDoc(docId: string, snapshot: string | null): YjsDoc {
  const [ydoc] = useState(() => {
    const doc = new Y.Doc();
    if (snapshot) Y.applyUpdate(doc, base64ToBytes(snapshot));
    return doc;
  });

  const [body, setBodyState] = useState(() => ydoc.getText(BODY_FIELD).toString());
  // A doc with no snapshot has never been through an explicit Save, even if its
  // (empty) local content happens to match the (empty) server state — that's a
  // real distinction, not a no-op, so it starts dirty rather than "saved".
  const [isDirty, setIsDirty] = useState(() => snapshot === null);
  const lastSyncedVector = useRef<Uint8Array | undefined>(undefined);
  // Bumped on every local change. A save records the count it covers, so a keystroke that
  // lands while the request is in flight is still recognisably outstanding when the
  // response arrives. A state vector alone can't tell us that: deleting text creates no
  // new struct, so a delete-only edit leaves the vector unmoved.
  const localEditCount = useRef(0);
  const sentSave = useRef<SentSave | null>(null);

  useEffect(() => {
    lastSyncedVector.current = Y.encodeStateVector(ydoc);
    const ytext = ydoc.getText(BODY_FIELD);
    const persistence = new IndexeddbPersistence(`docsync-doc-${docId}`, ydoc);

    // Reflects the lazy-init decision above as a side effect (not during
    // render) so the dashboard's badge agrees with the editor's from the
    // first paint, not just after the first local edit.
    if (snapshot === null) markDocDirty(docId);

    // Fires for IndexedDB hydrating a genuine unsaved local draft, or the
    // user typing — not for the initial snapshot applied above, which ran
    // before this effect (and thus before any listener existed to hear it).
    const onUpdate = () => {
      localEditCount.current += 1;
      setBodyState(ytext.toString());
      setIsDirty(true);
      markDocDirty(docId);
    };
    ydoc.on("update", onUpdate);

    return () => {
      ydoc.off("update", onUpdate);
      persistence.destroy();
      ydoc.destroy();
    };
  }, [docId, ydoc, snapshot]);

  function setBody(next: string) {
    const ytext = ydoc.getText(BODY_FIELD);
    const oldValue = ytext.toString();
    if (oldValue === next) return;

    // Common-prefix/suffix diff so a single keystroke becomes a small
    // insert/delete at the right position, not a full-field replace — that's
    // what lets two clients' concurrent edits merge at the character level
    // instead of one clobbering the other.
    let start = 0;
    while (start < oldValue.length && start < next.length && oldValue[start] === next[start]) {
      start++;
    }
    let oldEnd = oldValue.length;
    let newEnd = next.length;
    while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === next[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }

    // Both scans above compare UTF-16 code units, so a boundary can land inside a
    // surrogate pair — emoji overwhelmingly share a lead surrogate, so that is the
    // common case, not an exotic one. Yjs refuses to split a pair and writes U+FFFD
    // on both sides of the cut, destroying the character for good. Widen each
    // boundary off the pair so the edit stays code-point aligned; it still spans
    // only the changed character(s), which is what keeps concurrent edits mergeable.
    if (start > 0 && isHighSurrogate(oldValue.charCodeAt(start - 1))) start--;
    if (oldEnd < oldValue.length && isLowSurrogate(oldValue.charCodeAt(oldEnd))) {
      oldEnd++;
      newEnd++;
    }

    ydoc.transact(() => {
      if (oldEnd > start) ytext.delete(start, oldEnd - start);
      if (newEnd > start) ytext.insert(start, next.slice(start, newEnd));
    });
  }

  function encodeUpdate(): string {
    // Record what this payload covers now, at send time. Only one save is ever in
    // flight (the call site gates on the mutation's pending state), so a later
    // encodeUpdate() before markSaved() means the earlier payload was superseded.
    sentSave.current = { vector: Y.encodeStateVector(ydoc), editCount: localEditCount.current };
    return bytesToBase64(Y.encodeStateAsUpdate(ydoc, lastSyncedVector.current));
  }

  function markSaved() {
    const sent = sentSave.current;
    // Nothing was encoded, so nothing is known to have reached the server — saying
    // "saved" here would be a guess, and the badge is the user's only safety signal.
    if (!sent) return;
    sentSave.current = null;

    // The state the server actually received, not the doc as it stands now: the
    // textarea stays editable during a save (AC-30), so anything typed in the
    // request window never left the browser. Committing the current vector instead
    // would mark those keystrokes synced and drop them from every future delta.
    lastSyncedVector.current = sent.vector;

    const stillDirty = localEditCount.current !== sent.editCount;
    setIsDirty(stillDirty);
    if (!stillDirty) markDocClean(docId);
  }

  return { body, setBody, isDirty, encodeUpdate, markSaved };
}
