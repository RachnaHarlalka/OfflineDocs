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
import { renameDoc, saveDoc } from "@/lib/api/documents";

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>();
  return {
    ...actual,
    saveDoc: vi.fn(),
    renameDoc: vi.fn(),
  };
});

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

  it("stays editable offline, disables both Save controls, and does not auto-save on reconnect [AC-21][AC-33][AC-34][AC-35][AC-36]", async () => {
    const user = userEvent.setup();
    vi.mocked(saveDoc).mockResolvedValue(summaryFor({ id: "x", title: "x" }));

    const doc = makeDoc({ snapshot: makeSnapshot("existing") });
    renderDocEditor(doc);

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    await user.type(body, "a");

    setOnline(false);
    await user.type(body, "b");

    expect(screen.getByText(SYNC_STATE_LABELS.offline)).toBeInTheDocument();
    expect(screen.getByText(EDITOR_LABELS.offlineHint)).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: EDITOR_LABELS.save })) {
      expect(button).toBeDisabled();
    }
    expect(body).not.toBeDisabled();
    expect(body).toHaveValue("existingab");

    setOnline(true);
    expect(saveDoc).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText(SYNC_STATE_LABELS.draft)).toBeInTheDocument(),
    );

    const [saveButton] = screen.getAllByRole("button", { name: EDITOR_LABELS.save });
    await user.click(saveButton);

    expect(saveDoc).toHaveBeenCalledTimes(1);
    expect(decodeBodyFromUpdate(vi.mocked(saveDoc).mock.calls[0][1])).toBe("existingab");
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
