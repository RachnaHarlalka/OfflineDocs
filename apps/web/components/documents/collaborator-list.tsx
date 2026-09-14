import { ChevronDown } from "lucide-react";
import type {
  AssignableCollaboratorRole,
  DocCollaboratorDto,
} from "@docsync/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleChip } from "@/components/documents/role-chip";
import { SHARE_PANEL_LABELS } from "@/constants/labels";

export const ASSIGNABLE_ROLES: {
  value: AssignableCollaboratorRole;
  label: string;
}[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export const ASSIGNABLE_ROLE_LABEL = Object.fromEntries(
  ASSIGNABLE_ROLES.map(({ value, label }) => [value, label]),
) as Record<AssignableCollaboratorRole, string>;

export interface CollaboratorListProps {
  label: string;
  collaborators: DocCollaboratorDto[];
  currentUserId?: string;
  onChangeRole?: (userId: string, role: AssignableCollaboratorRole) => void;
  onRequestRemove?: (userId: string, name: string) => void;
}

export function CollaboratorList({
  label,
  collaborators,
  currentUserId,
  onChangeRole,
  onRequestRemove,
}: CollaboratorListProps) {
  const { you, removeAccess } = SHARE_PANEL_LABELS;
  const interactive = !!onChangeRole && !!onRequestRemove;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <p className="text-label uppercase text-muted-foreground">{label}</p>
        <Badge variant="neutral" size="sm">
          {collaborators.length}
        </Badge>
      </div>

      <ul className="space-y-1">
        {collaborators.map((collaborator) => {
          const isSelf = collaborator.userId === currentUserId;
          return (
            <li
              key={collaborator.userId}
              className="flex items-center gap-2.5 py-1.5"
            >
              <span
                className={
                  collaborator.role === "owner"
                    ? "grid size-7 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground"
                    : "grid size-7 shrink-0 place-items-center rounded-full bg-muted text-caption font-semibold text-muted-foreground"
                }
              >
                {(collaborator.name ?? collaborator.email)
                  .slice(0, 2)
                  .toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-ui font-medium">
                  {collaborator.name ?? collaborator.email}
                  {isSelf ? ` ${you}` : ""}
                </p>
                <p className="truncate text-caption text-muted-foreground">
                  {collaborator.email}
                </p>
              </div>

              {interactive && collaborator.role !== "owner" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" />}
                  >
                    {ASSIGNABLE_ROLE_LABEL[collaborator.role]}
                    <ChevronDown />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={collaborator.role}
                      onValueChange={(value) =>
                        onChangeRole?.(
                          collaborator.userId,
                          value as AssignableCollaboratorRole,
                        )
                      }
                    >
                      {ASSIGNABLE_ROLES.map(({ value, label: roleLabel }) => (
                        <DropdownMenuRadioItem key={value} value={value}>
                          {roleLabel}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        onRequestRemove?.(
                          collaborator.userId,
                          collaborator.name ?? collaborator.email,
                        )
                      }
                    >
                      {removeAccess}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <RoleChip role={collaborator.role} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
