import { z } from "zod";

export const submitAssemblyCaseSchema = z.object({
  assessmentMemberId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(20).max(2000),
}).strict();

export type SubmitAssemblyCaseInput = z.infer<typeof submitAssemblyCaseSchema>;
