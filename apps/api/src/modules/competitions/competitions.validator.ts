import { z } from "zod";

const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const createCompetitionSchema = z.object({
  name: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional(),
  sport: z.enum(["FOOTBALL", "BASKETBALL", "VOLLEYBALL", "TENNIS", "TABLE_TENNIS", "BADMINTON", "CRICKET", "RUGBY", "ESPORTS", "OTHER"]),
  format: z.enum(["ROUND_ROBIN", "KNOCKOUT"]),
  participantType: z.enum(["TEAM", "PLAYER"]),
  registrationMode: z.enum(["OPEN", "APPROVAL_REQUIRED", "INVITE_ONLY"]).default("APPROVAL_REQUIRED"),
  maxEntries: z.number().int().min(2).max(512).nullable().optional(),
  registrationOpensAt: dateTime.nullable().optional(),
  registrationClosesAt: dateTime.nullable().optional(),
  startsAt: dateTime.nullable().optional(),
}).refine((value) =>
  !value.registrationOpensAt || !value.registrationClosesAt || value.registrationOpensAt < value.registrationClosesAt,
{ message: "Registration opening must be before registration closing.", path: ["registrationClosesAt"] });

export const updateCompetitionStatusSchema = z.object({
  status: z.enum(["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export const registerCompetitionEntrySchema = z.object({
  teamId: z.string().min(1).optional(),
}).strict();

export const reviewCompetitionEntrySchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
}).refine((value) => value.decision !== "REJECTED" || Boolean(value.rejectionReason), {
  message: "A rejection reason is required.",
  path: ["rejectionReason"],
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type UpdateCompetitionStatusInput = z.infer<typeof updateCompetitionStatusSchema>;
export type RegisterCompetitionEntryInput = z.infer<typeof registerCompetitionEntrySchema>;
export type ReviewCompetitionEntryInput = z.infer<typeof reviewCompetitionEntrySchema>;
