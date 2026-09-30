import { act, renderHook, waitFor } from "@testing-library/react";
import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import { useYjsDoc } from "./use-yjs-doc";
import { base64ToBytes } from "./base64";

// Wraps the real dirty-docs implementation so TS-15 can observe the call
// without changing its (localStorage-backed) behaviour for any other test
// in this file.
vi.mock("./dirty-docs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dirty-docs")>();
  return { ...actual, markDocDirty: vi.fn(actual.markDocDirty) };
});

/** Matches the private BODY_FIELD constant in use-yjs-doc.ts. */
const BODY_FIELD = "body";

/**
 * Builds a snapshot the way the *server* hands one back to a client: a real
 * Yjs update, base64'd with Node's Buffer — never through the client-side
 * bytesToBase64() this suite is deliberately not trusting (see base64.test.ts).
 * This mirrors production: the `snapshot` prop useYjsDoc receives always
 * originates server-side, never round-tripped through the client encoder.
 */
function serverSnapshot(text: string): string {
  const doc = new Y.Doc();
  if (text) doc.getText(BODY_FIELD).insert(0, text);
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
}

/** Applies a base64 payload (as produced by encodeUpdate()) onto a doc, and
 *  reads back the resulting body text — the plan's own verification step. */
function textAfterApplying(base: Y.Doc, payload: string): string {
  Y.applyUpdate(base, base64ToBytes(payload));
  return base.getText(BODY_FIELD).toString();
}

describe("useYjsDoc — encodeUpdate payload reconstructs typed text server-side", () => {
  it("a fresh doc's payload reconstructs to exactly what was typed [AC-18] [AC-31]", async () => {
    const { result } = renderHook(() => useYjsDoc("doc-ts2-fresh", null));

    act(() => {
      result.current.setBody("hello world");
    });
    await waitFor(() => expect(result.current.body).toBe("hello world"));

    const payload = result.current.encodeUpdate();
    const fresh = new Y.Doc();

    expect(textAfterApplying(fresh, payload)).toBe("hello world");
  });

  it("a seeded doc's payload is a delta that merges onto the prior state, not a blind replacement [AC-18] [AC-31]", async () => {
    const seed = serverSnapshot("abc");
    const { result } = renderHook(() => useYjsDoc("doc-ts2-seeded", seed));
    await waitFor(() => expect(result.current.body).toBe("abc"));

    act(() => {
      result.current.setBody("abcdef");
    });
    await waitFor(() => expect(result.current.body).toBe("abcdef"));

    const payload = result.current.encodeUpdate();
    const base = new Y.Doc();
    Y.applyUpdate(base, base64ToBytes(seed));

    expect(textAfterApplying(base, payload)).toBe("abcdef");
  });
});

describe("useYjsDoc — keystrokes during an in-flight save stay outstanding", () => {
  it("keeps isDirty true and carries the mid-flight keystroke into the next payload [AC-32]", async () => {
    const seed = serverSnapshot("a");
    const { result } = renderHook(() => useYjsDoc("doc-ts3", seed));
    await waitFor(() => expect(result.current.body).toBe("a"));

    act(() => {
      result.current.setBody("ab");
    });
    await waitFor(() => expect(result.current.body).toBe("ab"));

    // Simulates the first save's request leaving with everything up to "ab".
    const first = result.current.encodeUpdate();

    // The keystroke that lands while that request is still in flight.
    act(() => {
      result.current.setBody("abc");
    });
    await waitFor(() => expect(result.current.body).toBe("abc"));

    // The first save's response arrives.
    act(() => {
      result.current.markSaved();
    });

    expect(result.current.isDirty).toBe(true);

    const second = result.current.encodeUpdate();
    const base = new Y.Doc();
    Y.applyUpdate(base, base64ToBytes(seed));
    Y.applyUpdate(base, base64ToBytes(first));

    expect(textAfterApplying(base, second)).toBe("abc");
  });

  it("leaves isDirty unchanged when markSaved is called with nothing encoded first [AC-32]", async () => {
    const { result } = renderHook(() => useYjsDoc("doc-ts3-noop", null));

    act(() => {
      result.current.setBody("draft text");
    });
    await waitFor(() => expect(result.current.isDirty).toBe(true));

    act(() => {
      result.current.markSaved();
    });

    // No encodeUpdate() preceded this markSaved(), so nothing is known to
    // have reached the server — a false "Saved" would be the worst lie this
    // badge could tell.
    expect(result.current.isDirty).toBe(true);
  });
});

describe("useYjsDoc — hasContentBeyond decides whether a backup is worth offering [AC-209]", () => {
  it("TS-9: is false when the backup holds only what the document already has", async () => {
    const seed = serverSnapshot("existing content");
    const { result } = renderHook(() => useYjsDoc("doc-ts9-same", seed));
    await waitFor(() => expect(result.current.body).toBe("existing content"));

    // The backup was produced from this exact document state, so restoring it
    // would add nothing — offering it back would be noise, not recovery.
    const backup = result.current.encodeFullState();

    expect(result.current.hasContentBeyond(backup)).toBe(false);
  });

  it("TS-9 contrast: is true when the backup holds content the document does not", async () => {
    const seed = serverSnapshot("existing content");
    const { result } = renderHook(() => useYjsDoc("doc-ts9-beyond", seed));
    await waitFor(() => expect(result.current.body).toBe("existing content"));

    // A genuine backup from a device that kept typing past the seeded state.
    const other = new Y.Doc();
    Y.applyUpdate(other, base64ToBytes(seed));
    other.getText(BODY_FIELD).insert("existing content".length, " plus more");
    const backup = Buffer.from(Y.encodeStateAsUpdate(other)).toString("base64");

    expect(result.current.hasContentBeyond(backup)).toBe(true);
  });

  it("H-10: is true when the backup differs from the document only by a deletion [AC-204] [AC-209]", async () => {
    const seed = serverSnapshot("hello world");
    const { result } = renderHook(() => useYjsDoc("doc-h10-delete-only", seed));
    await waitFor(() => expect(result.current.body).toBe("hello world"));

    // A backup from a device that typed "hello world" and then deleted "hello "
    // before its next heartbeat — a real edit (AC-204's "content the document
    // lacks"), even though it removes text rather than adding any. Built as a
    // clone of the seeded state so it shares the document's own history,
    // exactly as hunt-r1's H-10 repro does.
    const clone = new Y.Doc();
    Y.applyUpdate(clone, base64ToBytes(seed));
    clone.getText(BODY_FIELD).delete(0, "hello ".length);
    expect(clone.getText(BODY_FIELD).toString()).toBe("world");
    const backup = Buffer.from(Y.encodeStateAsUpdate(clone)).toString("base64");

    // The document still reads "hello world"; the backup's deletion is content
    // the document does not have and would lose if the backup is discarded.
    expect(result.current.hasContentBeyond(backup)).toBe(true);
  });
});

describe("useYjsDoc — a delete-only local edit is not silently treated as synced (H-10 also_check)", () => {
  it("keeps isDirty true when reconcileWithServer's snapshot does not include the local deletion", async () => {
    const base = serverSnapshot("hello world");
    const { result } = renderHook(() => useYjsDoc("doc-h10-reconcile-delete", base));
    await waitFor(() => expect(result.current.body).toBe("hello world"));

    // A local, offline-only edit that only removes text — no new struct is
    // created, so no client clock advances.
    act(() => {
      result.current.setBody("world");
    });
    await waitFor(() => expect(result.current.body).toBe("world"));
    expect(result.current.isDirty).toBe(true);

    // The server has NOT actually received this deletion — `base` still reads
    // "hello world". hasUpdatesBeyond compares state vectors only, and a
    // delete-only edit never advances one, so the outstanding check at :236
    // wrongly reads "nothing beyond" and marks the document clean even though
    // its body ("world") no longer matches what the server holds.
    act(() => {
      result.current.reconcileWithServer(base);
    });

    expect(result.current.isDirty).toBe(true);
  });
});

describe("useYjsDoc — astral-plane characters survive an edit", () => {
  it("preserves emoji through append, replace-with-shared-lead-surrogate, and delete [AC-57] [AC-15]", async () => {
    const { result } = renderHook(() => useYjsDoc("doc-ts4", null));

    act(() => {
      result.current.setBody("a😀b");
    });
    await waitFor(() => expect(result.current.body).toBe("a😀b"));
    expect(result.current.body).not.toContain("�");
    expect([...result.current.body].length).toBe(3);

    act(() => {
      result.current.setBody("a😀bc");
    });
    await waitFor(() => expect(result.current.body).toBe("a😀bc"));
    expect(result.current.body).not.toContain("�");
    expect([...result.current.body].length).toBe(4);

    // 😀 (U+1F600) and 🙂 (U+1F642) share the lead surrogate \uD83D — the
    // common case for emoji, not an exotic one.
    act(() => {
      result.current.setBody("a🙂b");
    });
    await waitFor(() => expect(result.current.body).toBe("a🙂b"));
    expect(result.current.body).not.toContain("�");
    expect([...result.current.body].length).toBe(3);

    act(() => {
      result.current.setBody("ab");
    });
    await waitFor(() => expect(result.current.body).toBe("ab"));
    expect(result.current.body).not.toContain("�");
    expect([...result.current.body].length).toBe(2);
  });
});

describe("useYjsDoc — reconcileWithServer after a queued save is flushed", () => {
  /* Stable per test: the id is a hook dependency, so generating one inside the
     render function re-runs the effect on every render and resets the synced
     vector — which silently turns encodeUpdate() into an empty delta. */
  let docCounter = 0;
  const nextDocId = () => `doc-flush-${++docCounter}`;
  /** What the server holds once a queued update has been merged into a snapshot. */
  function serverSnapshotAfterMerging(base: string | null, ...updates: string[]): string {
    const doc = new Y.Doc();
    if (base) Y.applyUpdate(doc, base64ToBytes(base));
    for (const update of updates) Y.applyUpdate(doc, base64ToBytes(update));
    return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  }

  it("stops calling work unsaved once the server holds it [Phase 2.2]", async () => {
    const docId = nextDocId();
    const base = serverSnapshot("saved ");
    const { result } = renderHook(() => useYjsDoc(docId, base));

    // Typed while offline, queued, and sent later by the service worker.
    act(() => {
      result.current.setBody("saved offline");
    });
    await waitFor(() => expect(result.current.isDirty).toBe(true));
    const queued = result.current.encodeUpdate();

    const merged = serverSnapshotAfterMerging(base, queued);
    act(() => {
      result.current.reconcileWithServer(merged);
    });

    await waitFor(() => expect(result.current.isDirty).toBe(false));
    expect(result.current.body).toBe("saved offline");
  });

  it("keeps anything typed after the flush outstanding", async () => {
    const docId = nextDocId();
    const base = serverSnapshot("saved ");
    const { result } = renderHook(() => useYjsDoc(docId, base));

    act(() => {
      result.current.setBody("saved offline");
    });
    const queued = result.current.encodeUpdate();
    const merged = serverSnapshotAfterMerging(base, queued);

    // The user kept typing while the worker was sending.
    act(() => {
      result.current.setBody("saved offline and more");
    });

    act(() => {
      result.current.reconcileWithServer(merged);
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.body).toBe("saved offline and more");
  });

  it("bases the next save on what the server now holds, not the old snapshot", async () => {
    const docId = nextDocId();
    const base = serverSnapshot("saved ");
    const { result } = renderHook(() => useYjsDoc(docId, base));

    act(() => {
      result.current.setBody("saved offline");
    });
    const queued = result.current.encodeUpdate();
    const merged = serverSnapshotAfterMerging(base, queued);

    act(() => {
      result.current.reconcileWithServer(merged);
    });

    // What the user types next must reconstruct on top of the server's state.
    act(() => {
      result.current.setBody("saved offline and more");
    });
    const next = result.current.encodeUpdate();

    const server = new Y.Doc();
    Y.applyUpdate(server, base64ToBytes(merged));
    Y.applyUpdate(server, base64ToBytes(next));
    expect(server.getText(BODY_FIELD).toString()).toBe("saved offline and more");
  });

  it("merges a collaborator's edits that arrived while the save waited", async () => {
    const docId = nextDocId();
    const base = serverSnapshot("shared ");
    const { result } = renderHook(() => useYjsDoc(docId, base));

    act(() => {
      result.current.setBody("shared mine");
    });
    const queued = result.current.encodeUpdate();

    // Someone else saved too, so the server's snapshot carries both.
    const theirs = new Y.Doc();
    Y.applyUpdate(theirs, base64ToBytes(base));
    theirs.getText(BODY_FIELD).insert(0, "theirs ");
    const merged = serverSnapshotAfterMerging(
      base,
      queued,
      Buffer.from(Y.encodeStateAsUpdate(theirs)).toString("base64"),
    );

    act(() => {
      result.current.reconcileWithServer(merged);
    });

    await waitFor(() => expect(result.current.body).toContain("mine"));
    expect(result.current.body).toContain("theirs");
    expect(result.current.isDirty).toBe(false);
  });
});

describe("useYjsDoc — a newer snapshot prop does not re-baseline an already-mounted doc", () => {
  it("keeps unsaved local edits dirty, in the body, and sendable after a newer snapshot arrives [TS-14] [AC-215] [AC-216]", async () => {
    const docId = "doc-ts14-reseed";
    const seedA = serverSnapshot("a");
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: string | null }) => useYjsDoc(docId, snapshot),
      { initialProps: { snapshot: seedA } },
    );
    await waitFor(() => expect(result.current.body).toBe("a"));

    act(() => {
      result.current.setBody("a local edit");
    });
    await waitFor(() => expect(result.current.body).toBe("a local edit"));

    // A refetch hands the same mounted editor a newer server snapshot — the
    // Y.Doc must not be torn down and re-seeded from it; only
    // reconcileWithServer() is allowed to re-base honestly (per the source
    // comment on `seededSnapshot`).
    const seedB = serverSnapshot("a newer server content");
    rerender({ snapshot: seedB });

    // AC-215: the edit survives and the badge-driving flag stays Draft.
    expect(result.current.isDirty).toBe(true);
    expect(result.current.body).toBe("a local edit");

    // AC-216: pressing Save now (encodeUpdate, the real send path) must still
    // carry the local edit — it must not have been silently re-baselined
    // onto the doc as "already synced" and dropped from the delta.
    const payload = result.current.encodeUpdate();
    const base = new Y.Doc();
    Y.applyUpdate(base, base64ToBytes(seedA));
    Y.applyUpdate(base, base64ToBytes(payload));
    expect(base.getText(BODY_FIELD).toString()).toBe("a local edit");
  });
});

describe("useYjsDoc — a brand-new document is dirty from first paint", () => {
  it("marks a null-snapshot doc dirty on mount, before any edit [TS-15] [AC-217]", async () => {
    const { markDocDirty } = await import("./dirty-docs");
    const spy = vi.mocked(markDocDirty);
    spy.mockClear();

    const docId = "doc-ts15-new";
    const { result } = renderHook(() => useYjsDoc(docId, null));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(docId));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.isDirty).toBe(true);
  });
});
