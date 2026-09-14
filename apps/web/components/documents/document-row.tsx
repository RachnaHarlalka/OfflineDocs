import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocSummary } from "@docsync/shared";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { RoleChip } from "@/components/documents/role-chip";
import { RowOverflowMenu } from "@/components/documents/row-overflow-menu";
import { SyncBadge } from "@/components/documents/sync-badge";
import { docErrorMessage, FALLBACK_DOC_ERROR } from "@/constants/errors";
import { DOCUMENT_ROW_LABELS } from "@/constants/labels";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { useRemoveCollaborator } from "@/lib/documents/use-collaborators";
import { relativeTime } from "@/lib/documents/relative-time";
import {
  useDeleteDoc,
  useDuplicateDoc,
  useRenameDoc,
} from "@/lib/documents/use-documents";

const TITLE_MAX_LENGTH = 200;

function memberCountLabel(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

function mutationErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError)
    return docErrorMessage(error.code) ?? FALLBACK_DOC_ERROR;
  return FALLBACK_DOC_ERROR;
}

export function DocumentRow({
  doc,
  currentUserId,
  isDirty,
  onOpenDetails,
  onShare,
}: {
  doc: DocSummary;
  currentUserId: string | undefined;
  isDirty: boolean;
  onOpenDetails: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const {
    renamePlaceholder,
    deleting,
    deleteDescription,
    delete: deleteLabel,
    confirmDelete,
    cancel,
    leave,
    leaving,
    confirmLeave,
    leaveDescription,
  } = DOCUMENT_ROW_LABELS;

  const router = useRouter();
  const renameDoc = useRenameDoc();
  const deleteDoc = useDeleteDoc();
  const duplicateDoc = useDuplicateDoc();
  const leaveDoc = useRemoveCollaborator(doc.id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const busy =
    renameDoc.isPending ||
    deleteDoc.isPending ||
    duplicateDoc.isPending ||
    leaveDoc.isPending;
  const rowError =
    mutationErrorMessage(renameDoc.error) ??
    mutationErrorMessage(duplicateDoc.error);

  function startRename() {
    renameDoc.reset();
    setTitle(doc.title);
    setEditing(true);
  }

  function commitRename() {
    if (renameDoc.isPending) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === doc.title) {
      setEditing(false);
      return;
    }
    renameDoc.mutate(
      { id: doc.id, title: trimmed },
      { onSuccess: () => setEditing(false) },
    );
  }

  function cancelRename() {
    renameDoc.reset();
    setTitle(doc.title);
    setEditing(false);
  }

  return (
    <>
      <li className="flex h-15 items-center gap-3 px-5 hover:bg-muted/50">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            className="size-4.5 shrink-0 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 3v5h5" />
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
          </svg>

          {editing ? (
            <Input
              autoFocus
              value={title}
              placeholder={renamePlaceholder}
              maxLength={TITLE_MAX_LENGTH}
              disabled={renameDoc.isPending}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              className="h-8 max-w-72"
            />
          ) : (
            <button
              type="button"
              onClick={() => router.push(ROUTES.doc(doc.id))}
              className="min-w-0 flex-1 cursor-pointer truncate text-left text-ui font-semibold"
            >
              {doc.title}
            </button>
          )}
        </div>

        <span className="hidden w-36 shrink-0 text-caption text-muted-foreground md:block">
          {relativeTime(doc.updatedAt)}
        </span>

        <div className="hidden w-40 shrink-0 items-center gap-2 md:flex">
          <RoleChip role={doc.role} />
          <span className="text-caption text-muted-foreground">
            {memberCountLabel(doc.collaborators.length)}
          </span>
        </div>

        <div className="hidden w-24 shrink-0 md:block">
          <SyncBadge state={isDirty ? "draft" : "saved"} />
        </div>

        <div className="w-8 shrink-0">
          {editing ? null : (
            <RowOverflowMenu
              role={doc.role}
              busy={busy}
              onOpenDetails={() => onOpenDetails(doc.id)}
              onRename={startRename}
              onShare={() => onShare(doc.id)}
              onDuplicate={() => duplicateDoc.mutate(doc.id)}
              onLeave={() => setConfirmingLeave(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )}
        </div>
      </li>

      {rowError ? (
        <li className="border-t border-destructive/20 bg-destructive-soft px-5 py-2 text-caption text-destructive">
          {rowError}
        </li>
      ) : null}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={confirmDelete}
        description={deleteDescription}
        error={mutationErrorMessage(deleteDoc.error)}
        cancelLabel={cancel}
        confirmLabel={deleteLabel}
        confirmingLabel={deleting}
        isConfirming={deleteDoc.isPending}
        onConfirm={() =>
          deleteDoc.mutate(doc.id, {
            onSuccess: () => setConfirmingDelete(false),
          })
        }
      />

      <ConfirmDialog
        open={confirmingLeave}
        onOpenChange={setConfirmingLeave}
        title={confirmLeave}
        description={leaveDescription}
        error={mutationErrorMessage(leaveDoc.error)}
        cancelLabel={cancel}
        confirmLabel={leave}
        confirmingLabel={leaving}
        isConfirming={leaveDoc.isPending}
        onConfirm={() => {
          if (!currentUserId) return;
          leaveDoc.mutate(currentUserId, {
            onSuccess: () => setConfirmingLeave(false),
          });
        }}
      />
    </>
  );
}
