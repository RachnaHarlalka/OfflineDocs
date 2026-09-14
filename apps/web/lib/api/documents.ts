import type {
  DocDetail,
  DocDetailResponse,
  DocResponse,
  DocSummary,
  DocsResponse,
} from "@docsync/shared";
import { API } from "@/constants/routes";
import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export async function fetchDocs(): Promise<DocSummary[]> {
  const { docs } = await apiGet<DocsResponse>(API.docs);
  return docs;
}

export async function fetchDoc(id: string): Promise<DocDetail> {
  const { doc } = await apiGet<DocDetailResponse>(API.doc(id));
  return doc;
}

export async function saveDoc(id: string, update: string): Promise<DocSummary> {
  const { doc } = await apiPost<DocResponse>(API.docSave(id), { update });
  return doc;
}

export async function createDoc(title?: string): Promise<DocSummary> {
  const { doc } = await apiPost<DocResponse>(API.docs, { title });
  return doc;
}

export async function renameDoc(id: string, title: string): Promise<DocSummary> {
  const { doc } = await apiPatch<DocResponse>(API.doc(id), { title });
  return doc;
}

export async function deleteDoc(id: string): Promise<void> {
  await apiDelete(API.doc(id));
}

export async function duplicateDoc(id: string): Promise<DocSummary> {
  const { doc } = await apiPost<DocResponse>(API.docDuplicate(id));
  return doc;
}
