import { z } from "zod";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(140);

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  description: z.string().trim().max(1000).optional(),
  sport: z.enum(["FOOTBALL","BASKETBALL","VOLLEYBALL","TENNIS","TABLE_TENNIS","BADMINTON","CRICKET","RUGBY","ESPORTS","OTHER"]).default("FOOTBALL"),
});

export const updateCommunitySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sport: z.enum(["FOOTBALL","BASKETBALL","VOLLEYBALL","TENNIS","TABLE_TENNIS","BADMINTON","CRICKET","RUGBY","ESPORTS","OTHER"]).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["ADMIN","TREASURER","ORGANIZER","MEMBER"]).default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN","TREASURER","ORGANIZER","MEMBER"]),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
