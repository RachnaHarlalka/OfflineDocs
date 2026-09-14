import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RoleChip } from "@/components/documents/role-chip";
import { SyncBadge } from "@/components/documents/sync-badge";
import { DOC_DRAWER_LABELS } from "@/constants/labels";
import { ROUTES } from "@/constants/routes";
import { relativeTime } from "@/lib/documents/relative-time";
import { useDocs } from "@/lib/documents/use-documents";


const PANEL_CLASSNAME =
  "inset-y-0 top-0 right-0 left-auto flex h-full w-full max-w-105 flex-col " +
  "translate-x-0 translate-y-0 gap-4 rounded-none border-l border-border p-5 sm:max-w-105 " +
  "data-open:zoom-in-100 data-closed:zoom-out-100 " +
  "data-open:slide-in-from-right data-closed:slide-out-to-right " +
  "max-md:inset-x-0 max-md:inset-y-auto max-md:top-auto max-md:right-auto " +
  "max-md:bottom-0 max-md:h-auto max-md:max-h-[85vh] max-md:max-w-full " +
  "max-md:rounded-t-xl max-md:border-t max-md:border-l-0 " +
  "max-md:data-open:slide-in-from-bottom max-md:data-closed:slide-out-to-bottom";

export function DocumentDetailsDrawer({
  docId,
  isDirty,
  onClose,
}: {
  docId: string | null;
  isDirty: boolean;
  onClose: () => void;
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
    manageAccessComingSoon,
  } = DOC_DRAWER_LABELS;

  const router = useRouter();
  const { data } = useDocs();
  const doc = data?.find((d) => d.id === docId);
  const owner = doc?.collaborators.find((c) => c.id === doc.ownerId);

  return (
    <Dialog open={docId !== null && !!doc} onOpenChange={(open) => !open && onClose()}>
      {doc ? (
        <DialogContent className={PANEL_CLASSNAME}>
          <DialogHeader>
            <DialogTitle className="text-page-title">{doc.title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto">
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
                  <span className="text-caption text-muted-foreground">
                    {status}
                  </span>
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

            <div>
              <p className="text-label uppercase text-muted-foreground">
                {members} · {doc.collaborators.length}
              </p>
              <ul className="mt-2 space-y-2">
                {doc.collaborators.map((collaborator) => {
                  const isOwner = collaborator.id === doc.ownerId;
                  return (
                    <li key={collaborator.id} className="flex items-center gap-2.5">
                      <span
                        className={
                          isOwner
                            ? "grid size-7 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground"
                            : "grid size-7 shrink-0 place-items-center rounded-full bg-muted text-caption font-semibold text-muted-foreground"
                        }
                      >
                        {(collaborator.name ?? collaborator.id).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-ui">{collaborator.name ?? collaborator.id}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <DialogFooter className="-mx-5 -mb-5">
            <DialogClose
              render={
                <Button className="flex-1" onClick={() => router.push(ROUTES.doc(doc.id))} />
              }
            >
              {openLabel}
            </DialogClose>
            {doc.role === "owner" ? (
              <Button
                variant="outline"
                className="flex-1"
                disabled
                title={manageAccessComingSoon}
              >
                {manageAccess}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
