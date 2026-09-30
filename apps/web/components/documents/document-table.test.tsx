import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocSummary } from "@docsync/shared";
import { DOCUMENT_ROW_LABELS, SYNC_STATE_LABELS } from "@/constants/labels";
import { DocumentTable } from "@/components/documents/document-table";
import { DOCS_QUERY_KEY } from "@/lib/documents/use-documents";
import { fetchDocs } from "@/lib/api/documents";
import { markDocDirty } from "@/lib/documents/dirty-docs";

// document-row.tsx and document-details-drawer.tsx both call useRouter() —
// no test in this tree renders either yet, so there's no existing mock to
// reuse. Only `push` is exercised (row title click, drawer "Open" button),
// neither of which this suite triggers.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  // No ?view= — the default "All documents" list.
  useSearchParams: () => new URLSearchParams(),
}));

// fetchDocs is mocked so DocumentTable's background queryFn has somewhere to
// land. It must resolve with the SAME docs the cache was seeded with, not [].
//
// It used to resolve []: the seeded cache is stale on mount, react-query
// refetches immediately, and the empty result replaced the seed. Synchronous
// tests asserted before that landed and passed; the one async test in this file
// awaited a click and rendered against an empty table, failing with "Unable to
// find role=menuitem" because there were no rows to open a menu on.
vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>();
  return {
    ...actual,
    fetchDocs: vi.fn(),
  };
});

function makeDoc(overrides: Partial<DocSummary> & { id: string; title: string }): DocSummary {
  return {
    ownerId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    role: "owner",
    collaborators: [{ id: "owner-1", name: "Owner One", avatarUrl: null }],
    ...overrides,
  };
}

function renderTable(docs: DocSummary[]) {
  const queryClient = new QueryClient({
    // staleTime keeps the seeded data authoritative for the life of the test —
    // without it the background refetch races every assertion.
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  vi.mocked(fetchDocs).mockResolvedValue(docs);
  queryClient.setQueryData(DOCS_QUERY_KEY, docs);

  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentTable />
    </QueryClientProvider>,
  );
}

/** Opens the details drawer for the row whose title is `title` via its
 *  overflow menu — the same path a user takes, rather than reaching into
 *  DocumentTable's state directly. */
async function openDetailsFor(user: ReturnType<typeof userEvent.setup>, title: string) {
  const row = screen.getByRole("button", { name: title }).closest("li")!;
  await user.click(within(row).getByRole("button", { name: DOCUMENT_ROW_LABELS.rowActions }));
  await user.click(await screen.findByRole("menuitem", { name: DOCUMENT_ROW_LABELS.viewDetails }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("DocumentTable — dirty badge join with per-device store", () => {
  it("shows Draft on a dirty document's row and Saved on a clean one [AC-40][AC-42]", () => {
    markDocDirty("dirty-1");
    const docs = [
      makeDoc({ id: "dirty-1", title: "Dirty doc" }),
      makeDoc({ id: "clean-1", title: "Clean doc" }),
    ];

    renderTable(docs);

    const dirtyRow = screen.getByRole("button", { name: "Dirty doc" }).closest("li")!;
    const cleanRow = screen.getByRole("button", { name: "Clean doc" }).closest("li")!;

    expect(within(dirtyRow).getByText(SYNC_STATE_LABELS.draft)).toBeInTheDocument();
    expect(within(dirtyRow).queryByText(SYNC_STATE_LABELS.saved)).not.toBeInTheDocument();
    expect(within(cleanRow).getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument();
    expect(within(cleanRow).queryByText(SYNC_STATE_LABELS.draft)).not.toBeInTheDocument();
  });

  it("shows the selected document's own dirty state in the drawer, not another row's [AC-41]", async () => {
    const user = userEvent.setup();
    markDocDirty("dirty-1");
    const docs = [
      makeDoc({ id: "dirty-1", title: "Dirty doc" }),
      makeDoc({ id: "clean-1", title: "Clean doc" }),
    ];

    renderTable(docs);

    await openDetailsFor(user, "Dirty doc");
    const dirtyDialog = screen.getByRole("dialog");
    expect(within(dirtyDialog).getByText(SYNC_STATE_LABELS.draft)).toBeInTheDocument();
    expect(within(dirtyDialog).queryByText(SYNC_STATE_LABELS.saved)).not.toBeInTheDocument();

    await user.click(within(dirtyDialog).getByRole("button", { name: "Close" }));

    await openDetailsFor(user, "Clean doc");
    const cleanDialog = screen.getByRole("dialog");
    expect(within(cleanDialog).getByText(SYNC_STATE_LABELS.saved)).toBeInTheDocument();
    expect(within(cleanDialog).queryByText(SYNC_STATE_LABELS.draft)).not.toBeInTheDocument();
  });
});
