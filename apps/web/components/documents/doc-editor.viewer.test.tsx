import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EDITOR_LABELS, SYNC_STATE_LABELS } from "@/constants/labels";
import { makeDoc, makeSnapshot, renderDocEditor, setOnline } from "@/components/documents/doc-editor.test-utils";
import { saveDoc } from "@/lib/api/documents";

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>();
  return { ...actual, saveDoc: vi.fn(), renameDoc: vi.fn() };
});

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  vi.mocked(saveDoc).mockReset();
});

function renderViewer() {
  const doc = makeDoc({ role: "viewer", title: "Report", snapshot: makeSnapshot("existing") });
  return renderDocEditor(doc);
}

describe("DocEditor — viewer role", () => {
  it("renders no Save control anywhere and shows a View only badge [AC-20][AC-48]", () => {
    renderViewer();

    expect(screen.queryAllByRole("button", { name: EDITOR_LABELS.save })).toHaveLength(0);
    expect(screen.getByText(EDITOR_LABELS.viewOnly)).toBeInTheDocument();
    // The sync badge itself is unaffected by the viewer role.
    expect(screen.getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument();
  });

  it("shows the title and body but disallows editing either [AC-45][AC-46]", async () => {
    const user = userEvent.setup();
    renderViewer();

    const title = screen.getByPlaceholderText(EDITOR_LABELS.titlePlaceholder);
    expect(title).toBeDisabled();
    expect(title).toHaveValue("Report");

    const body = screen.getByPlaceholderText(EDITOR_LABELS.bodyPlaceholder);
    expect(body).toHaveAttribute("readonly");
    await user.type(body, "x");
    expect(body).toHaveValue("existing");
  });

  it("never shows an offline or save-failed banner for a viewer [AC-47]", async () => {
    renderViewer();

    setOnline(false);
    // The badge is what re-renders on the online event; wait for it before
    // asserting the banners are absent, or the absence proves nothing.
    await waitFor(() =>
      expect(screen.getByText(SYNC_STATE_LABELS.offline)).toBeInTheDocument(),
    );
    expect(screen.queryByText(EDITOR_LABELS.offlineHint)).not.toBeInTheDocument();
    expect(screen.queryByText(EDITOR_LABELS.saveFailed)).not.toBeInTheDocument();
  });
});
