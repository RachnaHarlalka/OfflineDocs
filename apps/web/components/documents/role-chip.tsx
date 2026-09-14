import type { CollaboratorRole } from "@docsync/shared";
import { Badge } from "@/components/ui/badge";

const ROLE_VARIANT = {
  owner: "brand",
  editor: "neutral",
  viewer: "neutral",
} as const;

const ROLE_LABEL: Record<CollaboratorRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function RoleChip({ role, className }: { role: CollaboratorRole; className?: string }) {
  return (
    <Badge variant={ROLE_VARIANT[role]} size="md" className={className}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}
