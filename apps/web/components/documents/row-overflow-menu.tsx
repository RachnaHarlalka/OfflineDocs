import {
  Copy,
  DoorOpen,
  Info,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import type { CollaboratorRole } from "@docsync/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOCUMENT_ROW_LABELS } from "@/constants/labels";

// Owner: rename/share/duplicate/delete. Non-owner: duplicate/leave.
type RowAction = "rename" | "share" | "duplicate" | "leave" | "delete";

const ACTIONS_BY_ROLE: Record<CollaboratorRole, readonly RowAction[]> = {
  owner: ["rename", "share", "duplicate", "delete"],
  editor: ["duplicate", "leave"],
  viewer: ["duplicate", "leave"],
};

export function RowOverflowMenu({
  role,
  onOpenDetails,
  onRename,
  onShare,
  onDuplicate,
  onLeave,
  onDelete,
  busy,
}: {
  role: CollaboratorRole;
  onOpenDetails: () => void;
  onRename?: () => void;
  onShare?: () => void;
  onDuplicate?: () => void;
  onLeave?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const allowed = ACTIONS_BY_ROLE[role];
  const {
    rowActions,
    viewDetails,
    rename,
    share,
    duplicate,
    leave,
    delete: deleteLabel,
  } = DOCUMENT_ROW_LABELS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={rowActions}
            disabled={busy}
          />
        }
      >
        <MoreVertical />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" finalFocus={false}>
        <DropdownMenuItem onClick={onOpenDetails}>
          <Info />
          {viewDetails}
        </DropdownMenuItem>

        {allowed.includes("rename") && onRename ? (
          <DropdownMenuItem onClick={onRename}>
            <Pencil />
            {rename}
          </DropdownMenuItem>
        ) : null}

        {allowed.includes("share") && onShare ? (
          <DropdownMenuItem onClick={onShare}>
            <Share2 />
            {share}
          </DropdownMenuItem>
        ) : null}

        {allowed.includes("duplicate") && onDuplicate ? (
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy />
            {duplicate}
          </DropdownMenuItem>
        ) : null}

        {allowed.includes("delete") && onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {deleteLabel}
            </DropdownMenuItem>
          </>
        ) : null}

        {allowed.includes("leave") && onLeave ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onLeave}>
              <DoorOpen />
              {leave}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
