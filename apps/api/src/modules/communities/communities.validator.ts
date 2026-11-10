import { z } from "zod";

const timezone = z.string().trim().min(1).max(64).refine((value) => { try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; } }, "Timezone must be a valid IANA timezone.");

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(140);

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  description: z.string().trim().max(1000).optional(),
  sport: z.enum(["FOOTBALL","BASKETBALL","VOLLEYBALL","TENNIS","TABLE_TENNIS","BADMINTON","CRICKET","RUGBY","ESPORTS","OTHER"]).default("FOOTBALL"),
  timezone: timezone.optional(),
});

export const updateCommunitySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sport: z.enum(["FOOTBALL","BASKETBALL","VOLLEYBALL","TENNIS","TABLE_TENNIS","BADMINTON","CRICKET","RUGBY","ESPORTS","OTHER"]).optional(),
  timezone: timezone.optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN","TREASURER","ORGANIZER","MEMBER"]),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
