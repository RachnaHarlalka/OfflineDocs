import type { Request, Response } from "express";
import type {
  CollaboratorRole,
  CreateDocRequest,
  DocDetail,
  DocDetailResponse,
  DocResponse,
  DocSummary,
  DocsResponse,
  RenameDocRequest,
  SaveRequest,
} from "@docsync/shared";
import { AppError } from "../lib/http-error.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { getDocAccess } from "../middleware/require-role.js";
import {
  createDoc,
  deleteDoc,
  duplicateDoc,
  getDocById,
  listDocsForUser,
  renameDoc,
  saveDoc,
  type DocDetailRecord,
  type DocSummaryRecord,
} from "../services/docs.js";

function toDocSummary(
  doc: DocSummaryRecord,
  role: CollaboratorRole,
): DocSummary {
  return {
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    role,
    collaborators: doc.collaborators.map(({ user }) => ({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    })),
  };
}

export async function list(
  req: Request,
  res: Response<DocsResponse>,
): Promise<void> {
  const { id } = getAuthenticatedUser(req);
  const rows = await listDocsForUser(id);
  res.json({ docs: rows.map(({ role, doc }) => toDocSummary(doc, role)) });
}

export async function create(
  req: Request,
  res: Response<DocResponse>,
): Promise<void> {
  const { id: ownerId } = getAuthenticatedUser(req);
  const { title } = req.body as unknown as CreateDocRequest;
  const { role, doc } = await createDoc({ ownerId, title });
  res.status(201).json({ doc: toDocSummary(doc, role) });
}

function toDocDetail(doc: DocDetailRecord, role: CollaboratorRole): DocDetail {
  return {
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    role,
    snapshot: doc.snapshot
      ? Buffer.from(doc.snapshot).toString("base64")
      : null,
  };
}

export async function detail(
  req: Request,
  res: Response<DocDetailResponse>,
): Promise<void> {
  const { docId, role } = getDocAccess(req);
  const doc = await getDocById(docId);
  if (!doc) throw AppError.notFound("Document not found");
  res.json({ doc: toDocDetail(doc, role) });
}

export async function rename(req: Request, res: Response<DocResponse>): Promise<void> {
  const { docId, role } = getDocAccess(req);
  const { title } = req.body as unknown as RenameDocRequest;
  const doc = await renameDoc(docId, title);
  res.json({ doc: toDocSummary(doc, role) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { docId } = getDocAccess(req);
  await deleteDoc(docId);
  res.status(204).send();
}

export async function save(req: Request, res: Response<DocResponse>): Promise<void> {
  const { docId, role } = getDocAccess(req);
  const { update } = req.body as unknown as SaveRequest;
  const doc = await saveDoc(docId, update);
  res.json({ doc: toDocSummary(doc, role) });
}

export async function duplicate(req: Request, res: Response<DocResponse>): Promise<void> {
  const { docId } = getDocAccess(req);
  const { id: callerId } = getAuthenticatedUser(req);
  const { role, doc } = await duplicateDoc(docId, callerId);
  res.status(201).json({ doc: toDocSummary(doc, role) });
}
