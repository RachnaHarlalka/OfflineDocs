import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocSummary } from "@docsync/shared";
import { EDITOR_LABELS } from "@/constants/labels";
import { makeDoc, makeSnapshot, renderDocEditor, setOnline } from "@/components/documents/doc-editor.test-utils";
import { renameDoc, saveDoc } from "@/lib/api/documents";

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>();
  return { ...actual, saveDoc: vi.fn(), renameDoc: vi.fn() };
});

const ORIGINAL_TITLE = "Report";

function renamedSummary(id: string, title: string): DocSummary {
  return {
    id,
    title,
    ownerId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    role: "owner",
    collaborators: [],
  };
}

beforeEach(() => {
  setOnline(true);
  vi.mocked(renameDoc).mockImplementation((id, title) => Promise.resolve(renamedSummary(id, title)));
});

afterEach(() => {
  vi.mocked(renameDoc).mockReset();
  vi.mocked(saveDoc).mockReset();
});

function renderTitleDoc() {
  return renderDocEditor(makeDoc({ title: ORIGINAL_TITLE, snapshot: makeSnapshot("body text") }));
}

function titleField() {
  return screen.getByPlaceholderText(EDITOR_LABELS.titlePlaceholder);
}

function saveButtons() {
  return screen.getAllByRole("button", { name: EDITOR_LABELS.save });
}

describe("DocEditor — title commit / revert / no-op rules", () => {
  it("Enter commits a changed, non-empty title immediately, independent of Save, and leaves the body untouched [AC-7][AC-13][AC-14]", async () => {
    const user = userEvent.setup();
    const { doc } = renderTitleDoc();

    for (const button of saveButtons()) expect(button).toBeDisabled();

    const title = titleField();
    await user.clear(title);
    await user.type(title, "Q3 Report{Enter}");

    expect(renameDoc).toHaveBeenCalledTimes(1);
    expect(renameDoc).toHaveBeenCalledWith(doc.id, "Q3 Report");
    expect(title).not.toHaveFocus();

    // The rename is independent of the body's Save state.
    expect(screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder)).toHaveValue("body text");
    for (const button of saveButtons()) expect(button).toBeDisabled();
  });

  it("Escape reverts the title without committing [AC-10]", async () => {
    const user = userEvent.setup();
    renderTitleDoc();

    const title = titleField();
    await user.clear(title);
    await user.type(title, "scratch{Escape}");

    expect(renameDoc).not.toHaveBeenCalled();
    expect(title).toHaveValue(ORIGINAL_TITLE);
    expect(title).not.toHaveFocus();
  });

  it("makes no rename call and reverts when the title is left empty and blurred [AC-11]", async () => {
    const user = userEvent.setup();
    renderTitleDoc();

    const title = titleField();
    await user.clear(title);
    await user.tab();

    expect(renameDoc).not.toHaveBeenCalled();
    expect(title).toHaveValue(ORIGINAL_TITLE);
  });

  it("makes no rename call and reverts when the title is left whitespace-only and blurred [AC-11]", async () => {
    const user = userEvent.setup();
    renderTitleDoc();

    const title = titleField();
    await user.clear(title);
    await user.type(title, "   ");
    await user.tab();

    expect(renameDoc).not.toHaveBeenCalled();
    expect(title).toHaveValue(ORIGINAL_TITLE);
  });

  it("makes no rename call when the retyped title is unchanged from the last-saved value [AC-12]", async () => {
    const user = userEvent.setup();
    renderTitleDoc();

    const title = titleField();
    await user.clear(title);
    await user.type(title, ORIGINAL_TITLE);
    await user.tab();

    expect(renameDoc).not.toHaveBeenCalled();
    expect(title).toHaveValue(ORIGINAL_TITLE);
  });
});
