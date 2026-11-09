import { z } from "zod";

export const sportSchema = z.enum([
  "FOOTBALL", "BASKETBALL", "VOLLEYBALL", "TENNIS", "TABLE_TENNIS",
  "BADMINTON", "CRICKET", "RUGBY", "ESPORTS", "OTHER",
]);

export const enableSportSchema = z.object({ sport: sportSchema });

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(100),
  sport: sportSchema,
  shortName: z.string().trim().min(2).max(20).optional(),
  description: z.string().trim().max(500).optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  shortName: z.string().trim().min(2).max(20).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["CAPTAIN", "COACH", "PLAYER"]).default("PLAYER"),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(["CAPTAIN", "COACH", "PLAYER"]),
});

export type SportInput = z.infer<typeof sportSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamMemberInput = z.infer<typeof addTeamMemberSchema>;
