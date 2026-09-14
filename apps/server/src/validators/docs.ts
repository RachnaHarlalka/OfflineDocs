import { z } from "zod";

// .trim() before .min(1): whitespace-only titles must fail, not become "".
export const createDocSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export type CreateDocBody = z.infer<typeof createDocSchema>;

export const renameDocSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export type RenameDocBody = z.infer<typeof renameDocSchema>;

// Base64-shape only — whether it decodes into a valid Yjs update is checked
// by actually applying it (services/docs.ts), not by regex here.
export const saveDocSchema = z.object({
  update: z.string().min(1),
});

export type SaveDocBody = z.infer<typeof saveDocSchema>;
