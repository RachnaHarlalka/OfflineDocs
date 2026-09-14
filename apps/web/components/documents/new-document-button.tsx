"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_SHELL_LABELS } from "@/constants/labels";
import { useCreateDoc } from "@/lib/documents/use-documents";

export function NewDocumentButton({ className }: { className?: string }) {
  const { mutate: createDoc, isPending: creating } = useCreateDoc();

  return (
    <Button
      className={className}
      disabled={creating}
      onClick={() => createDoc(undefined)}
    >
      <Plus />
      {creating
        ? APP_SHELL_LABELS.creatingDocument
        : APP_SHELL_LABELS.newDocument}
    </Button>
  );
}
