import { act, renderHook, waitFor } from "@testing-library/react";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { useYjsDoc } from "./use-yjs-doc";
import { base64ToBytes } from "./base64";

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
