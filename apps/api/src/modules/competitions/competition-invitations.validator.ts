import { z } from "zod";

const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const createCompetitionInvitationSchema = z.object({
  teamId: z.string().min(1).optional(),
  playerUserId: z.string().min(1).optional(),
  expiresAt: dateTime.optional(),
}).strict().refine((value) => Boolean(value.teamId) !== Boolean(value.playerUserId), {
  message: "Provide exactly one teamId or playerUserId.",
});

export type CreateCompetitionInvitationInput = z.infer<typeof createCompetitionInvitationSchema>;
