import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { CollaboratorList } from "@/components/documents/collaborator-list";
import { PanelShell } from "@/components/documents/panel-shell";
import { RoleChip } from "@/components/documents/role-chip";
import { SyncBadge } from "@/components/documents/sync-badge";
import { DOC_DRAWER_LABELS } from "@/constants/labels";
import { ROUTES } from "@/constants/routes";
import { useCollaborators } from "@/lib/documents/use-collaborators";
import { relativeTime } from "@/lib/documents/relative-time";
import { useDocs } from "@/lib/documents/use-documents";

export function DocumentDetailsDrawer({
  docId,
  currentUserId,
  isDirty,
  onClose,
  onManageAccess,
}: {
  docId: string | null;
  currentUserId: string | undefined;
  isDirty: boolean;
  onClose: () => void;
  onManageAccess: (docId: string) => void;
}) {
  const {
    documentSection,
    owner: ownerLabel,
    yourRole,
    status,
    created,
    updated,
    members,
    open: openLabel,
    manageAccess,
  } = DOC_DRAWER_LABELS;

  const router = useRouter();
  const { data } = useDocs();
  const doc = data?.find((d) => d.id === docId);
  const collaborators = useCollaborators(docId);
  const owner = collaborators.data?.find((c) => c.role === "owner");

  if (!doc) return null;

  return (
    <PanelShell
      onOpenChange={(open) => !open && onClose()}
      title={doc.title}
      footer={
        <div className="flex gap-2">
          <DialogClose
            render={
              <Button
                className="flex-1"
                onClick={() => router.push(ROUTES.doc(doc.id))}
              />
            }
          >
            {openLabel}
          </DialogClose>
          {doc.role === "owner" ? (
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onManageAccess(doc.id)}
                />
              }
            >
              {manageAccess}
            </DialogClose>
          ) : null}
        </div>
      }
    >
      <div>
        <p className="text-label uppercase text-muted-foreground">
          {documentSection}
        </p>
        <div className="mt-2">
          <div className="flex items-center justify-between border-b border-border py-2">
            <span className="text-caption text-muted-foreground">
              {ownerLabel}
            </span>
            <span className="text-ui">{owner?.name ?? doc.ownerId}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-2">
            <span className="text-caption text-muted-foreground">
              {yourRole}
            </span>
            <RoleChip role={doc.role} />
          </div>
          <div className="flex items-center justify-between border-b border-border py-2">
            <span className="text-caption text-muted-foreground">{status}</span>
            <SyncBadge state={isDirty ? "draft" : "saved"} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-caption text-muted-foreground">
              {created}
            </span>
            <span className="text-ui">{relativeTime(doc.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-caption text-muted-foreground">
              {updated}
            </span>
            <span className="text-ui">{relativeTime(doc.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <CollaboratorList
          label={members}
          collaborators={collaborators.data ?? []}
          currentUserId={currentUserId}
        />
      </div>
    </PanelShell>
  );
}
