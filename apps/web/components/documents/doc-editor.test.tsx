import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocSummary } from "@docsync/shared";
import { EDITOR_LABELS, SYNC_STATE_LABELS } from "@/constants/labels";
import { ApiError } from "@/lib/api/client";
import {
  decodeBodyFromUpdate,
  deferred,
  makeDoc,
  makeSnapshot,
  renderDocEditor,
  setOnline,
} from "@/components/documents/doc-editor.test-utils";
import { DRAFT_RESTORE_LABELS } from "@/constants/labels";
import { renameDoc, saveDoc } from "@/lib/api/documents";
import { fetchOwnDraft, fetchPresence, sendHeartbeat } from "@/lib/api/presence";
import { bytesToBase64 } from "@/lib/documents/base64";
import { getDirtyDocIdsSnapshot } from "@/lib/documents/dirty-docs";
import { readPayload, readQueue } from "@/lib/offline/save-queue";
import * as Y from "yjs";

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>();
  return {
    ...actual,
    saveDoc: vi.fn(),
    renameDoc: vi.fn(),
  };
});

// Own-draft restore (techspec 4.1) rides the same wire as presence, so all
// three are mocked together here — TS-2/TS-3/TS-5 need to control what the
// backup read reports without hitting the network.
vi.mock("@/lib/api/presence", () => ({
  sendHeartbeat: vi.fn().mockResolvedValue({ backedUpAt: null }),
  fetchPresence: vi.fn().mockResolvedValue([]),
  fetchOwnDraft: vi.fn(),
}));

/** Encodes `text` as a real Yjs update, the same shape `fetchOwnDraft` hands back. */
function backupUpdate(text: string): string {
  const ydoc = new Y.Doc();
  ydoc.getText("body").insert(0, text);
  return bytesToBase64(Y.encodeStateAsUpdate(ydoc));
}

function summaryFor(doc: { id: string; title: string }): DocSummary {
  return {
    id: doc.id,
    title: doc.title,
    ownerId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    role: "owner",
    collaborators: [],
  };
}

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  vi.mocked(saveDoc).mockReset();
  vi.mocked(renameDoc).mockReset();
  vi.mocked(fetchOwnDraft).mockReset();
});

describe("DocEditor — save lifecycle", () => {
  it("shows Draft and both placeholders before a never-saved document is touched [AC-1][AC-2][AC-3]", () => {
    const doc = makeDoc({ snapshot: null });
    renderDocEditor(doc);

    expect(screen.getByText(SYNC_STATE_LABELS.draft)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(EDITOR_LABELS.titlePlaceholder)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder)).toBeInTheDocument();

    for (const button of screen.getAllByRole("button", { name: EDITOR_LABELS.save })) {
      expect(button).toBeEnabled();
    }
  });

  it("flips Saved to Draft and enables Save the moment the user types [AC-4][AC-16][AC-17][AC-22]", async () => {
    const user = userEvent.setup();
    const doc = makeDoc({ snapshot: makeSnapshot("existing") });
    renderDocEditor(doc);

    expect(screen.getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: EDITOR_LABELS.save })) {
      expect(button).toBeDisabled();
    }

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    await user.type(body, "!");

    expect(screen.getByText(SYNC_STATE_LABELS.draft)).toBeInTheDocument();
    expect(body).toHaveValue("existing!");
    for (const button of screen.getAllByRole("button", { name: EDITOR_LABELS.save })) {
      expect(button).toBeEnabled();
    }
  });

  it("cycles Saving… to Saved and sends exactly one request per click-through [AC-18][AC-23][AC-24][AC-25]", async () => {
    const user = userEvent.setup();
    const pending = deferred<DocSummary>();
    vi.mocked(saveDoc).mockReturnValue(pending.promise);

    const doc = makeDoc({ snapshot: makeSnapshot("existing") });
    renderDocEditor(doc);

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    await user.type(body, "!");

    const [saveButton] = screen.getAllByRole("button", { name: EDITOR_LABELS.save });
    await user.click(saveButton);

    // EDITOR_LABELS.saving and SYNC_STATE_LABELS.saving are the same string, so
    // the in-flight Save button matches too — assert the badge, which is the
    // one that is not inside a button.
    const savingNodes = await screen.findAllByText(SYNC_STATE_LABELS.saving);
    expect(savingNodes.some((node) => !node.closest("button"))).toBe(true);
    for (const button of screen.getAllByRole("button", { name: EDITOR_LABELS.saving })) {
      expect(button).toBeDisabled();
    }

    // A second click while the first request is still in flight must not
    // fire a second request — the button is disabled, so this is a no-op.
    await user.click(saveButton);
    expect(saveDoc).toHaveBeenCalledTimes(1);

    pending.resolve(summaryFor(doc));

    await waitFor(() => expect(screen.getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument());
    for (const button of screen.getAllByRole("button", { name: EDITOR_LABELS.save })) {
      expect(button).toBeDisabled();
    }
    expect(saveDoc).toHaveBeenCalledTimes(1);
  });

  it("on a failed save shows the banner and Save failed badge, keeps content, and Retry resends it [AC-27][AC-28][AC-29][AC-30]", async () => {
    const user = userEvent.setup();
    vi.mocked(saveDoc).mockRejectedValueOnce(new ApiError(500, "internal_error", "boom"));

    const doc = makeDoc({ snapshot: null });
    renderDocEditor(doc);

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    await user.type(body, "unsaved words");

    const [saveButton] = screen.getAllByRole("button", { name: EDITOR_LABELS.save });
    await user.click(saveButton);

    expect(await screen.findByText(EDITOR_LABELS.saveFailed)).toBeInTheDocument();
    expect(screen.getByText(SYNC_STATE_LABELS.error)).toBeInTheDocument();
    expect(body).toHaveValue("unsaved words");
    expect(saveButton).toBeEnabled();

    vi.mocked(saveDoc).mockResolvedValueOnce(summaryFor(doc));
    await user.click(screen.getByRole("button", { name: EDITOR_LABELS.retry }));

    await waitFor(() => expect(screen.getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument());
    expect(saveDoc).toHaveBeenCalledTimes(2);
    expect(decodeBodyFromUpdate(vi.mocked(saveDoc).mock.calls[1][1])).toBe("unsaved words");
  });

  it("stays editable offline and queues Save instead of refusing it [AC-21][AC-33][AC-34][AC-35][AC-36]", async () => {
    const user = userEvent.setup();
    vi.mocked(saveDoc).mockResolvedValue(summaryFor({ id: "x", title: "x" }));

    const snapshot = makeSnapshot("existing");
    const doc = makeDoc({ snapshot });
    renderDocEditor(doc);

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    await user.type(body, "a");

    setOnline(false);
    await user.type(body, "b");

    expect(screen.getByText(SYNC_STATE_LABELS.offline)).toBeInTheDocument();
    expect(screen.getByText(EDITOR_LABELS.offlineHint)).toBeInTheDocument();
    expect(body).not.toBeDisabled();
    expect(body).toHaveValue("existingab");

    // Phase 2 supersedes Part 1's disabled-offline button: the change is queued.
    const [saveButton] = screen.getAllByRole("button", { name: EDITOR_LABELS.save });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => expect(screen.getByText(SYNC_STATE_LABELS.pending)).toBeInTheDocument());
    // Queued, not sent — the network is what is missing.
    expect(saveDoc).not.toHaveBeenCalled();

    const mine = (await readQueue()).filter((entry) => entry.docId === doc.id);
    expect(mine).toHaveLength(1);

    // The payload is a delta against the last synced state, so it is only
    // meaningful applied on top of the snapshot it was encoded against.
    const payload = await readPayload(mine[0].id);
    expect(decodeBodyFromUpdate(doc.snapshot!, payload!.update!)).toBe("existingab");

    // Restore connectivity while still mounted: TanStack Query's onlineManager
    // is a singleton, and leaving it offline pauses mutations in later tests.
    setOnline(true);
  });
});

describe("DocEditor — Cmd/Ctrl+S shortcut", () => {
  it.each([
    { label: "Cmd+S", eventInit: { key: "s", metaKey: true } },
    { label: "Ctrl+S", eventInit: { key: "s", ctrlKey: true } },
  ])("$label triggers the same save and suppresses the browser dialog [AC-19]", async ({ eventInit }) => {
    const user = userEvent.setup();
    vi.mocked(saveDoc).mockResolvedValue(summaryFor({ id: "x", title: "x" }));

    const doc = makeDoc({ snapshot: makeSnapshot("existing") });
    renderDocEditor(doc);

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    await user.type(body, "!");
    await user.click(document.body);

    const event = new KeyboardEvent("keydown", { ...eventInit, cancelable: true, bubbles: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(saveDoc).toHaveBeenCalledTimes(1));
  });

  it("does nothing when there is nothing to save or the caller is a viewer [AC-19]", () => {
    const clean = makeDoc({ snapshot: makeSnapshot("existing") });
    renderDocEditor(clean);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, cancelable: true }));
    expect(saveDoc).not.toHaveBeenCalled();

    const viewerDoc = makeDoc({ role: "viewer", snapshot: makeSnapshot("existing") });
    renderDocEditor(viewerDoc);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    expect(saveDoc).not.toHaveBeenCalled();
  });
});

/**
 * TS-2/TS-3 [AC-202][AC-203] — the own-draft read is "owner or editor, online"
 * (techspec 4.1): a viewer never has a backup, and the read is online-only, so
 * neither case should ever fetch or offer one.
 */
describe("DocEditor — own-draft restore gating [AC-202][AC-203]", () => {
  it("never requests or offers a backup for a viewer", async () => {
    const doc = makeDoc({ role: "viewer", snapshot: makeSnapshot("existing") });
    renderDocEditor(doc);

    // Wait on something that does fire for a viewer (presence) before
    // asserting an absence, or the absence proves nothing.
    await waitFor(() => expect(fetchPresence).toHaveBeenCalled());
    expect(fetchOwnDraft).not.toHaveBeenCalled();
    expect(screen.queryByText(DRAFT_RESTORE_LABELS.title)).not.toBeInTheDocument();
  });

  it("never requests or offers a backup while offline", async () => {
    setOnline(false);
    const doc = makeDoc({ role: "owner", snapshot: makeSnapshot("existing") });
    renderDocEditor(doc);

    // Wait on something observable offline (the offline hint) before
    // asserting an absence, or the absence proves nothing.
    await waitFor(() =>
      expect(screen.getByText(EDITOR_LABELS.offlineHint)).toBeInTheDocument(),
    );
    expect(fetchOwnDraft).not.toHaveBeenCalled();
    expect(screen.queryByText(DRAFT_RESTORE_LABELS.title)).not.toBeInTheDocument();
  });
});

/**
 * TS-5 [AC-205] — the offer is explicit-save all the way down: the backup's
 * content must not enter the body until Restore is pressed.
 */
describe("DocEditor — the offer does not touch the body [AC-205]", () => {
  it("keeps the backup's text out of the body until Restore is pressed", async () => {
    const doc = makeDoc({ role: "owner", snapshot: makeSnapshot("stale server content") });
    vi.mocked(fetchOwnDraft).mockResolvedValue({
      update: backupUpdate("newer content only the backup has"),
      backedUpAt: "2026-09-14T00:00:00.000Z",
    });

    renderDocEditor(doc);

    await screen.findByText(DRAFT_RESTORE_LABELS.title);

    const body = screen.getByPlaceholderText(
      EDITOR_LABELS.bodyPlaceholder,
    ) as HTMLTextAreaElement;
    expect(body.value).not.toContain("newer content only the backup has");
  });
});

/**
 * TS-6 [AC-206] — restoring merges the backup in as ordinary local work: body,
 * badge and the dashboard's dirty-docs record all move together.
 */
describe("DocEditor — restoring the backup merges it in and marks the document dirty [AC-206]", () => {
  it("shows the backup content, closes the notice, and flips the badge and dirty-docs to unsaved", async () => {
    const user = userEvent.setup();
    // Already-saved (non-null, empty-body snapshot) so the transition from
    // Saved to Draft on restore is observable, and the backup's own insert
    // at position 0 lands into an otherwise-empty doc — no merge-order
    // ambiguity to fight in the assertion below.
    const doc = makeDoc({ snapshot: makeSnapshot("") });
    vi.mocked(fetchOwnDraft).mockResolvedValue({
      update: backupUpdate("backup only text"),
      backedUpAt: "2026-09-14T00:00:00.000Z",
    });

    renderDocEditor(doc);
    await screen.findByText(DRAFT_RESTORE_LABELS.title);
    expect(screen.getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: DRAFT_RESTORE_LABELS.restore }));

    expect(screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder)).toHaveValue(
      "backup only text",
    );
    expect(screen.queryByText(DRAFT_RESTORE_LABELS.title)).not.toBeInTheDocument();
    expect(screen.getByText(SYNC_STATE_LABELS.draft)).toBeInTheDocument();
    expect(getDirtyDocIdsSnapshot().has(doc.id)).toBe(true);
  });
});

/**
 * TS-7 [AC-207] — restore never saves or notifies on its own; Save afterwards
 * behaves like any other edit and sends the restored content.
 */
describe("DocEditor — a restored draft stays unsaved until Save is pressed [AC-207]", () => {
  it("does not save on restore, then persists the restored content once Save is clicked", async () => {
    const user = userEvent.setup();
    const doc = makeDoc({ snapshot: makeSnapshot("") });
    vi.mocked(fetchOwnDraft).mockResolvedValue({
      update: backupUpdate("restored content"),
      backedUpAt: "2026-09-14T00:00:00.000Z",
    });
    vi.mocked(saveDoc).mockResolvedValue(summaryFor(doc));

    renderDocEditor(doc);
    await screen.findByText(DRAFT_RESTORE_LABELS.title);

    await user.click(screen.getByRole("button", { name: DRAFT_RESTORE_LABELS.restore }));

    // Restore alone must never call Save or notify collaborators of a draft
    // the user never chose to publish.
    expect(saveDoc).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: EDITOR_LABELS.save })[0]);

    await waitFor(() => expect(saveDoc).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(saveDoc).mock.calls[0];
    expect(decodeBodyFromUpdate(doc.snapshot as string, payload)).toContain("restored content");
  });
});
