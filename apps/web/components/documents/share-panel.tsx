"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AssignableCollaboratorRole } from "@docsync/shared";
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
import { useDocs } from "@/lib/documents/use-documents";
import {
  useChangeCollaboratorRole,
  useCollaborators,
  useInviteCollaborator,
  useRemoveCollaborator,
} from "@/lib/documents/use-collaborators";

function mutationErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError)
    return docErrorMessage(error.code) ?? FALLBACK_DOC_ERROR;
  return FALLBACK_DOC_ERROR;
}

export function SharePanel({
  docId,
  currentUserId,
  onClose,
}: {
  docId: string | null;
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
  } = SHARE_PANEL_LABELS;

  const { data: docs } = useDocs();
  const doc = docs?.find((d) => d.id === docId);

  const collaborators = useCollaborators(docId);
  const invite = useInviteCollaborator(docId ?? "");
  const changeRole = useChangeCollaboratorRole(docId ?? "");
  const remove = useRemoveCollaborator(docId ?? "");

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<AssignableCollaboratorRole>("editor");
  const [removing, setRemoving] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) return;
    setEmail("");
    invite.reset();
    onClose();
  }

  function sendInvite() {
    const trimmed = email.trim();
    if (!trimmed || invite.isPending) return;
    invite.mutate(
      { email: trimmed, role: inviteRole },
      { onSuccess: () => setEmail("") },
    );
  }

  if (!doc) return null;

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
        <div>
          <p className="text-label uppercase text-muted-foreground">
            {invitePeople}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={email}
              placeholder={emailPlaceholder}
              disabled={invite.isPending}
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
                    disabled={invite.isPending}
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
              disabled={invite.isPending || !email.trim()}
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
          <CollaboratorList
            label={peopleWithAccess}
            collaborators={collaborators.data ?? []}
            currentUserId={currentUserId}
            onChangeRole={(userId, role) => changeRole.mutate({ userId, role })}
            onRequestRemove={(userId, name) => setRemoving({ userId, name })}
          />
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
