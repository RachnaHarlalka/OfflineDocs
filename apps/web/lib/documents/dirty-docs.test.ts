import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module caches its parsed value in module scope (see dirty-docs.ts), so
// each case needs a fresh import to avoid bleeding state between tests —
// `vi.resetModules()` plus a dynamic import per case, per the plan's setup note.
async function freshModule() {
  vi.resetModules();
  return import("./dirty-docs");
}

describe("dirty-docs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("includes a doc in the snapshot after it is marked dirty [AC-43]", async () => {
    const { markDocDirty, getDirtyDocIdsSnapshot } = await freshModule();

    markDocDirty("a");
    const snapshot = getDirtyDocIdsSnapshot();

    expect(snapshot.has("a")).toBe(true);
  });

  it("returns the identical Set reference when marking an already-dirty doc dirty again [AC-43]", async () => {
    const { markDocDirty, getDirtyDocIdsSnapshot } = await freshModule();

    markDocDirty("a");
    const first = getDirtyDocIdsSnapshot();
    markDocDirty("a");
    const second = getDirtyDocIdsSnapshot();

    expect(second).toBe(first);
  });

  it("marking one doc clean leaves other dirty docs in the snapshot [AC-43]", async () => {
    const { markDocDirty, markDocClean, getDirtyDocIdsSnapshot } = await freshModule();

    markDocDirty("a");
    markDocDirty("b");
    markDocClean("a");
    const snapshot = getDirtyDocIdsSnapshot();

    expect(snapshot.has("b")).toBe(true);
    expect(snapshot.has("a")).toBe(false);
    expect(snapshot.size).toBe(1);
  });

  it("degrades to an empty snapshot without throwing when the stored value is not valid JSON [AC-40] [AC-42]", async () => {
    window.localStorage.setItem("docsync:dirty-docs", "{not json");
    const { getDirtyDocIdsSnapshot } = await freshModule();

    let snapshot: ReadonlySet<string> | undefined;
    expect(() => {
      snapshot = getDirtyDocIdsSnapshot();
    }).not.toThrow();
    expect(snapshot?.size).toBe(0);
  });

  it("degrades to an empty snapshot without throwing when the stored value is valid JSON but not an array [AC-40] [AC-42]", async () => {
    window.localStorage.setItem("docsync:dirty-docs", "42");
    const { getDirtyDocIdsSnapshot } = await freshModule();

    let snapshot: ReadonlySet<string> | undefined;
    expect(() => {
      snapshot = getDirtyDocIdsSnapshot();
    }).not.toThrow();
    expect(snapshot?.size).toBe(0);
  });

  it("does not throw to the caller when the backing store throws on write [AC-43]", async () => {
    const { markDocDirty } = await freshModule();
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => markDocDirty("a")).not.toThrow();
  });
});
