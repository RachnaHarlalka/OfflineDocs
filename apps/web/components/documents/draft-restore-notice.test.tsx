import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DraftRestoreNotice } from "@/components/documents/draft-restore-notice";
import { DRAFT_RESTORE_LABELS } from "@/constants/labels";
import { relativeTime } from "@/lib/documents/relative-time";

/**
 * TS-4 [AC-204][AC-214] — the notice must identify which draft it means and be
 * announced to assistive tech: a `role="status"` container, the constants'
 * copy (never a hardcoded literal), and both actions reachable by role+name.
 */
describe("DraftRestoreNotice — copy and roles [AC-204][AC-214]", () => {
  it("renders as a status region with the specified title, relative time, and named actions", () => {
    const backedUpAt = "2026-09-14T00:00:00.000Z";
    const onRestore = vi.fn();
    const onDismiss = vi.fn();

    render(
      <DraftRestoreNotice
        backedUpAt={backedUpAt}
        onRestore={onRestore}
        onDismiss={onDismiss}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(DRAFT_RESTORE_LABELS.title);
    expect(status).toHaveTextContent(relativeTime(backedUpAt));

    expect(
      screen.getByRole("button", { name: DRAFT_RESTORE_LABELS.restore }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DRAFT_RESTORE_LABELS.dismiss }),
    ).toBeInTheDocument();
  });
});

/**
 * TS-8 [AC-208] — "Not now" only ends the offer. It must call onDismiss and
 * never onRestore: dismiss wired to the wrong handler, or made to also clear
 * the caller's local draft, would both slip past a test that only checked
 * the notice disappeared.
 */
describe("DraftRestoreNotice — dismissing costs the user nothing [AC-208]", () => {
  it("calls onDismiss and never onRestore when Not now is pressed", async () => {
    const backedUpAt = "2026-09-14T00:00:00.000Z";
    const onRestore = vi.fn();
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <DraftRestoreNotice
        backedUpAt={backedUpAt}
        onRestore={onRestore}
        onDismiss={onDismiss}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: DRAFT_RESTORE_LABELS.dismiss }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });
});
