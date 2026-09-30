import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { fetchOwnDraft, sendHeartbeat } from "@/lib/api/presence";
import { useDraftBackup, useOwnDraft } from "./use-presence";

vi.mock("@/lib/api/presence", () => ({
  sendHeartbeat: vi.fn(),
  fetchPresence: vi.fn(),
  fetchOwnDraft: vi.fn(),
}));

const ownDraftFetch = vi.mocked(fetchOwnDraft);
const heartbeat = vi.mocked(sendHeartbeat);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * Mirrors the exact gate `doc-editor.tsx` wires between the two hooks
 * (`canBackUp: !isViewer && !ownDraft.isPending`, viewer excluded here since these
 * scenarios are all an online owner). Composing the two real hooks rather than
 * re-deriving the gate is what makes this an ordering test rather than two
 * independent unit tests.
 */
function useComposedDraftRestore(
  docId: string,
  options: { enabled?: boolean; isDirty?: boolean } = {},
) {
  const { enabled = true, isDirty = true } = options;
  const ownDraft = useOwnDraft(docId, enabled);
  const backup = useDraftBackup(docId, {
    enabled,
    isDirty,
    canBackUp: !ownDraft.isPending,
    encodeFullState: () => "ZW5jb2RlZA==",
  });
  return { ownDraft, backup };
}

describe("useOwnDraft", () => {
  beforeEach(() => {
    ownDraftFetch.mockReset();
    heartbeat.mockReset().mockResolvedValue({ backedUpAt: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the draft backup exactly once per mount — not polled, not refetched on focus [AC-201]", async () => {
    vi.useFakeTimers();
    ownDraftFetch.mockResolvedValue({
      update: "ZW5jb2RlZA==",
      backedUpAt: "2026-01-01T00:00:00.000Z",
    });

    renderHook(() => useOwnDraft("doc-1", true), { wrapper: makeWrapper() });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ownDraftFetch).toHaveBeenCalledTimes(1);
    expect(ownDraftFetch).toHaveBeenCalledWith("doc-1");

    // Past one heartbeat interval — a poll keyed off the same clock would refire here.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(ownDraftFetch).toHaveBeenCalledTimes(1);

    // `staleTime: Infinity` is the only thing standing between this and a refetch.
    // react-query's focus manager listens for `visibilitychange`, not `focus`.
    await act(async () => {
      window.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ownDraftFetch).toHaveBeenCalledTimes(1);
  });
});

describe("useOwnDraft + useDraftBackup composed (the doc-editor.tsx gate)", () => {
  beforeEach(() => {
    ownDraftFetch.mockReset();
    heartbeat.mockReset().mockResolvedValue({ backedUpAt: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("beats with presence only while the backup read is unsettled, then resumes carrying it [AC-211]", async () => {
    const read = deferred<{ update: string; backedUpAt: string } | null>();
    ownDraftFetch.mockReturnValue(read.promise);

    const { result } = renderHook(() => useComposedDraftRestore("doc-1"), {
      wrapper: makeWrapper(),
    });

    // First beat fires immediately (useDraftBackup beats without waiting a full
    // interval) — the read has not settled yet, so it must carry no payload.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.ownDraft.isPending).toBe(true);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(heartbeat).toHaveBeenLastCalledWith("doc-1", {});

    // A second beat while still unsettled — same rule, still no payload.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(heartbeat).toHaveBeenCalledTimes(2);
    expect(heartbeat).toHaveBeenLastCalledWith("doc-1", {});

    // The read settles.
    await act(async () => {
      read.resolve({ update: "server-backup", backedUpAt: "2026-01-01T00:00:00.000Z" });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.ownDraft.isPending).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(heartbeat).toHaveBeenCalledTimes(3);
    expect(heartbeat).toHaveBeenLastCalledWith("doc-1", { update: "ZW5jb2RlZA==" });
  });

  it("a failed read settles without retry-storming, and backups resume on the next heartbeat [AC-212]", async () => {
    ownDraftFetch.mockRejectedValue(new ApiError(503, "unavailable", "boom"));

    const { result } = renderHook(() => useComposedDraftRestore("doc-1"), {
      wrapper: makeWrapper(),
    });

    // Well past any retry delay and a heartbeat interval — `retry: false` is what
    // keeps this at exactly one call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(ownDraftFetch).toHaveBeenCalledTimes(1);
    expect(result.current.ownDraft.isError).toBe(true);

    // The failure must not wedge the gate shut forever: the next heartbeat still
    // carries the local draft, because the read has settled — as an error.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(heartbeat).toHaveBeenLastCalledWith("doc-1", { update: "ZW5jb2RlZA==" });
  });

  it("a null backup settles like any other answer and does not block later backups [AC-213]", async () => {
    ownDraftFetch.mockResolvedValue(null);

    const { result } = renderHook(() => useComposedDraftRestore("doc-1"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.ownDraft.isPending).toBe(false);
    expect(result.current.ownDraft.data).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(heartbeat).toHaveBeenLastCalledWith("doc-1", { update: "ZW5jb2RlZA==" });
  });
});
