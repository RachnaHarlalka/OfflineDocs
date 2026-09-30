"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AssignableCollaboratorRole, Doc } from "@docsync/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ASSIGNABLE_ROLE_LABEL, ASSIGNABLE_ROLES, CollaboratorList } from "@/components/documents/collaborator-list";
import { PanelShell } from "@/components/documents/panel-shell";
import { docErrorMessage, FALLBACK_DOC_ERROR } from "@/constants/errors";
import { SHARE_PANEL_LABELS } from "@/constants/labels";
import { ApiError } from "@/lib/api/client";
import {
  useChangeCollaboratorRole,
  useCollaborators,
  useInviteCollaborator,
  useRemoveCollaborator,
} from "@/lib/documents/use-collaborators";
import { useOnlineStatus } from "@/lib/offline/use-online-status";

function mutationErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError)
    return docErrorMessage(error.code) ?? FALLBACK_DOC_ERROR;
  return FALLBACK_DOC_ERROR;
}

export function SharePanel({
  doc,
  currentUserId,
  onClose,
}: {
  /** Mount only while open — closing unmounts it, which also discards a half-typed invite. */
  doc: Pick<Doc, "id" | "title">;
  currentUserId: string | undefined;
  onClose: () => void;
}) {
  const {
    title,
    invitePeople,
    emailPlaceholder,
    sendInvite: sendInviteLabel,
    sendInviteShort: sendInviteShortLabel,
    sending,
    roleHint,
    peopleWithAccess,
    removeAccess,
    confirmRemoveTitle,
    removeDescriptionSuffix,
    removing: removingLabel,
    cancel,
    done,
    offlineNotice,
    membersOffline,
  } = SHARE_PANEL_LABELS;

  const collaborators = useCollaborators(doc.id);
  const invite = useInviteCollaborator(doc.id);
  const changeRole = useChangeCollaboratorRole(doc.id);
  const remove = useRemoveCollaborator(doc.id);

  // Access changes aren't queued offline. A transport failure counts too:
  // navigator.onLine stays true on a network that can't reach the API.
  const online = useOnlineStatus();
  const unreachable =
    !online || (collaborators.isError && !(collaborators.error instanceof ApiError));

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<AssignableCollaboratorRole>("editor");
  const [removing, setRemoving] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function sendInvite() {
    const trimmed = email.trim();
    if (!trimmed || invite.isPending) return;
    invite.mutate(
      { email: trimmed, role: inviteRole },
      { onSuccess: () => setEmail("") },
    );
  }

  return (
    <>
      <PanelShell
        onOpenChange={handleOpenChange}
        title={title}
        subtitle={doc.title}
        footer={
          <DialogClose render={<Button variant="outline" className="w-full" />}>
            {done}
          </DialogClose>
        }
      >
        {unreachable ? (
          <p
            role="status"
            className="mb-5 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-caption text-warning"
          >
            {offlineNotice}
          </p>
        ) : null}

        <div>
          <p className="text-label uppercase text-muted-foreground">
            {invitePeople}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={email}
              placeholder={emailPlaceholder}
              disabled={invite.isPending || unreachable}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendInvite();
                }
              }}
              className="w-full md:w-auto md:flex-1"
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-between md:flex-none"
                    disabled={invite.isPending || unreachable}
                  />
                }
              >
                {ASSIGNABLE_ROLE_LABEL[inviteRole]}
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={inviteRole}
                  onValueChange={(value) =>
                    setInviteRole(value as AssignableCollaboratorRole)
                  }
                >
                  {ASSIGNABLE_ROLES.map(({ value, label: roleLabel }) => (
                    <DropdownMenuRadioItem key={value} value={value}>
                      {roleLabel}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="shrink-0 md:w-full"
              disabled={invite.isPending || unreachable || !email.trim()}
              onClick={sendInvite}
            >
              {invite.isPending ? (
                sending
              ) : (
                <>
                  <span className="md:hidden">{sendInviteShortLabel}</span>
                  <span className="hidden md:inline">{sendInviteLabel}</span>
                </>
              )}
            </Button>
          </div>

          <p className="mt-2.5 text-caption text-muted-foreground">
            {roleHint}
          </p>

          {mutationErrorMessage(invite.error) ? (
            <p className="mt-2 text-caption text-destructive">
              {mutationErrorMessage(invite.error)}
            </p>
          ) : null}
        </div>
        <div className="mt-5 border-t border-border pt-5">
          {unreachable && !collaborators.data ? (
            <p className="text-caption text-muted-foreground">{membersOffline}</p>
          ) : (
            <CollaboratorList
              label={peopleWithAccess}
              collaborators={collaborators.data ?? []}
              currentUserId={currentUserId}
              disabled={unreachable}
              onChangeRole={(userId, role) => changeRole.mutate({ userId, role })}
              onRequestRemove={(userId, name) => setRemoving({ userId, name })}
            />
          )}
        </div>
      </PanelShell>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={confirmRemoveTitle}
        description={`${removing?.name ?? ""} ${removeDescriptionSuffix}`}
        error={mutationErrorMessage(remove.error)}
        cancelLabel={cancel}
        confirmLabel={removeAccess}
        confirmingLabel={removingLabel}
        isConfirming={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.userId, {
            onSuccess: () => setRemoving(null),
          });
        }}
      />
    </>
  );
}
