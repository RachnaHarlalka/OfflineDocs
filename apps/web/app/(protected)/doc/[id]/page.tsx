import type { Metadata } from "next";
import { DocEditor } from "@/components/documents/doc-editor";

export const metadata: Metadata = { title: "Document · DocSync" };

export default async function DocPage({ params }: PageProps<"/doc/[id]">) {
  // Next 16: params is async.
  const { id } = await params;

  return <DocEditor id={id} />;
}
