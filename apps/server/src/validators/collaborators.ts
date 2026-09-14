import { z } from "zod";

const assignableRoleSchema = z.literal(["editor", "viewer"]);

export const inviteCollaboratorSchema = z.object({
  email: z.string().trim().min(1).pipe(z.email()),
  role: assignableRoleSchema,
});

export type InviteCollaboratorBody = z.infer<typeof inviteCollaboratorSchema>;

export const changeRoleSchema = z.object({
  role: assignableRoleSchema,
});

export type ChangeRoleBody = z.infer<typeof changeRoleSchema>;
