"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentDetailsDrawer } from "@/components/documents/document-details-drawer";
import { DocumentRow } from "@/components/documents/document-row";
import { DocumentRowSkeleton } from "@/components/documents/document-row-skeleton";
import { EmptyState } from "@/components/documents/empty-state";
import { NewDocumentButton } from "@/components/documents/new-document-button";
import { SharePanel } from "@/components/documents/share-panel";
import { docErrorMessage } from "@/constants/errors";
import { NETWORK_ERROR_MESSAGE } from "@/constants/errors";
import { DOCUMENTS_PAGE_LABELS } from "@/constants/labels";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/use-session";
import { useDirtyDocIds } from "@/lib/documents/use-dirty-doc-ids";
import { useDocs } from "@/lib/documents/use-documents";

export function DocumentTable() {
  const {
    retry,
    errorTitle,
    columnUpdated,
    columnStatus,
    columnName,
    columnAccess,
  } = DOCUMENTS_PAGE_LABELS;

  const { data, isPending, isError, error, refetch } = useDocs();

  const { data: session } = useSession();
  const [detailsDocId, setDetailsDocId] = useState<string | null>(null);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const dirtyDocIds = useDirtyDocIds();

  if (isPending) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sh-1">
        <ul
          aria-busy="true"
          aria-live="polite"
          className="divide-y divide-border"
        >
          <DocumentRowSkeleton />
          <DocumentRowSkeleton />
          <DocumentRowSkeleton />
        </ul>
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? docErrorMessage(error.code) : null;
    return (
      <div
        role="alert"
        aria-live="polite"
        className="space-y-3 py-16 text-center"
      >
        <p className="text-ui font-medium">
          {errorTitle}
        </p>
        <p className="text-caption text-muted-foreground">
          {message ?? NETWORK_ERROR_MESSAGE}
        </p>
        <Button onClick={() => void refetch()}>
          {retry}
        </Button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState>
        <NewDocumentButton />
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sh-1">
      <div className="hidden h-10 items-center gap-3 border-b border-border bg-muted px-5 md:flex">
        <span className="flex-1 text-label uppercase text-muted-foreground">
          {columnName}
        </span>
        <span className="w-36 shrink-0 text-label uppercase text-muted-foreground">
          {columnUpdated}
        </span>
        <span className="w-40 shrink-0 text-label uppercase text-muted-foreground">
          {columnAccess}
        </span>
        <span className="w-24 shrink-0 text-label uppercase text-muted-foreground">
          {columnStatus}
        </span>
        <span className="w-8 shrink-0" />
      </div>
      <ul aria-busy="false" className="divide-y divide-border">
        {data.map((doc) => (
          <DocumentRow

            key={doc.id}

            doc={doc}
            currentUserId={session?.id}

            isDirty={dirtyDocIds.has(doc.id)}
            onOpenDetails={setDetailsDocId}
            onShare={setShareDocId}

          />
        ))}
      </ul>

      <DocumentDetailsDrawer
        docId={detailsDocId}
        currentUserId={session?.id}
        isDirty={detailsDocId !== null && dirtyDocIds.has(detailsDocId)}
        onClose={() => setDetailsDocId(null)}
        onManageAccess={setShareDocId}
      />

      <SharePanel
        docId={shareDocId}
        currentUserId={session?.id}
        onClose={() => setShareDocId(null)}
      />
    </div>
  );
}
