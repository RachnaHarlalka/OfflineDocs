import { screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  makeDoc,
  makeSnapshot,
  renderDocEditor,
} from "@/components/documents/doc-editor.test-utils";
import { bytesToBase64 } from "@/lib/documents/base64";
import { fetchOwnDraft, fetchPresence, sendHeartbeat } from "./presence";

/**
 * TS-19 [AC-116] — techspec 4.1's whole justification for the server-side
 * draft backup is that local IndexedDB "doesn't help if storage is cleared
 * or the user never comes back on that device", so the backup exists "to
 * resume their own draft". A backup that is written but never read back on
 * the client is not a backup.
 *
 * Written as a failing defect report for basis U-2: `fetchOwnDraft` had no
 * caller anywhere in the web app, so the backup was write-only. The restore
 * is now wired up — `useOwnDraft` reads it, and `DraftRestoreNotice` offers
 * it behind an explicit control rather than merging it in unasked — so the
 * test is green on the second branch of its final assertion. Neither
 * assertion was weakened to get there.
 */
vi.mock("./presence", () => ({
  sendHeartbeat: vi.fn(),
  fetchPresence: vi.fn(),
  fetchOwnDraft: vi.fn(),
}));

afterEach(() => {
  vi.mocked(fetchOwnDraft).mockReset();
  vi.mocked(sendHeartbeat).mockReset();
  vi.mocked(fetchPresence).mockReset();
});

function backupUpdate(text: string): string {
  const ydoc = new Y.Doc();
  ydoc.getText("body").insert(0, text);
  return bytesToBase64(Y.encodeStateAsUpdate(ydoc));
}

it("fetches and offers the caller's own backup when local state is gone [AC-116]", async () => {
  // A server snapshot that is real but stale, and no local IndexedDB state
  // (this is a fresh jsdom + fake-indexeddb instance per test) — exactly the
  // "storage cleared, or a different device" case AC-116 describes.
  const doc = makeDoc({ snapshot: makeSnapshot("stale server content") });

  vi.mocked(fetchOwnDraft).mockResolvedValue({
    update: backupUpdate("newer content only the backup has"),
    backedUpAt: "2026-09-14T00:00:00.000Z",
  });
  vi.mocked(sendHeartbeat).mockResolvedValue({ backedUpAt: null });
  vi.mocked(fetchPresence).mockResolvedValue([]);

  renderDocEditor(doc);

  // Give the editor's effects (Yjs/IndexedDB seeding, any restore fetch) a
  // full microtask+timer turn to settle before asserting.
  await waitFor(() => {
    expect(screen.getByPlaceholderText).toBeTruthy();
  });

  // The AC's entire point: the backup must actually be fetched.
  await waitFor(() => expect(fetchOwnDraft).toHaveBeenCalledWith(doc.id));

  // And once fetched, its content must be reachable — either applied to the
  // document directly or offered behind an explicit restore control. This app
  // takes the second route, on purpose: nothing enters the document unasked.
  //
  // Inside waitFor: the call above is observable the moment the request is
  // made, while whichever route the app takes only lands a render after it
  // resolves. Asserting synchronously here races that render. The body field
  // is matched by its own placeholder because a match-anything pattern also
  // matches the title input, and an ambiguous query throws before either
  // branch is evaluated.
  await waitFor(() => {
    const body = screen.queryByPlaceholderText(
      /start writing/i,
    ) as HTMLTextAreaElement | null;
    const restoreControl = screen.queryByRole("button", { name: /restore/i });
    const contentSurfaced =
      body?.value.includes("newer content only the backup has") ?? false;
    expect(contentSurfaced || restoreControl !== null).toBe(true);
  });
});
