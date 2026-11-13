import { z } from "zod";

export const declareAssemblyConflictSchema = z.object({
  subjectUserId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(30).max(2000),
}).strict();

export const decideAssemblyConflictSchema = z.object({
  conflictExists: z.boolean(),
  reason: z.string().trim().min(20).max(1000),
}).strict();

export type DeclareAssemblyConflictInput = z.infer<typeof declareAssemblyConflictSchema>;
export type DecideAssemblyConflictInput = z.infer<typeof decideAssemblyConflictSchema>;
