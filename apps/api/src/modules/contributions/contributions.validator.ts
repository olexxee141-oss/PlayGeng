import { z } from "zod";

const amountMinor = z.string().regex(/^[1-9]\d{0,17}$/, "Amount must be a positive integer string in minor units.");
const reason = z.string().trim().min(5).max(500);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).optional(),
  amountMinor,
  frequency: z.enum(["ONE_OFF", "MONTHLY"]),
  assessmentGenerationMode: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
}).strict();

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  amountMinor: amountMinor.optional(),
  assessmentGenerationMode: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const transitionSchema = z.object({ reason }).strict();

export const createAssessmentSchema = z.object({
  periodKey: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$|^ONE_OFF$/),
  description: z.string().trim().min(2).max(500).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export const updateAssessmentSchema = z.object({
  description: z.string().trim().min(2).max(500).optional(),
  dueAt: z.string().datetime({ offset: true }),
}).strict();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;


export const contributionReportQuerySchema = z.object({
  cursor: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
