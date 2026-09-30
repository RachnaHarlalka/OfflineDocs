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
  /** Keeps the role menus visible but inert, e.g. while offline. */
  disabled?: boolean;
  onChangeRole?: (userId: string, role: AssignableCollaboratorRole) => void;
  onRequestRemove?: (userId: string, name: string) => void;
}

export function CollaboratorList({
  label,
  collaborators,
  currentUserId,
  disabled = false,
  onChangeRole,
  onRequestRemove,
}: CollaboratorListProps) {
  const { you, removeAccess, unnamedCollaborator } = SHARE_PANEL_LABELS;
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
          const { userId, name, email, role } = collaborator;
          const isSelf = userId === currentUserId;
          // `email` is null for anyone but an owner, so a member with no Google
          // display name needs a fallback that doesn't depend on it.
          const displayName = name ?? email ?? unnamedCollaborator;

          return (
            <li key={userId} className="flex items-center gap-2.5 py-1.5">
              <span
                className={
                  role === "owner"
                    ? "grid size-7 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground"
                    : "grid size-7 shrink-0 place-items-center rounded-full bg-muted text-caption font-semibold text-muted-foreground"
                }
              >
                {displayName.slice(0, 2).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-ui font-medium">
                  {displayName}
                  {isSelf ? ` ${you}` : ""}
                </p>
                {email ? (
                  <p className="truncate text-caption text-muted-foreground">
                    {email}
                  </p>
                ) : null}
              </div>

              {interactive && role !== "owner" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" disabled={disabled} />}
                  >
                    {ASSIGNABLE_ROLE_LABEL[role]}
                    <ChevronDown />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={role}
                      onValueChange={(value) =>
                        onChangeRole?.(
                          userId,
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
                      onClick={() => onRequestRemove?.(userId, displayName)}
                    >
                      {removeAccess}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <RoleChip role={role} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
