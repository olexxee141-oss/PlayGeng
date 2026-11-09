import { z } from "zod";

const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const createMatchSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  venue: z.string().trim().max(200).optional(),
  startsAt: dateTime,
  endsAt: dateTime.optional(),
  capacity: z.number().int().min(2).max(1000).nullable().optional(),
}).refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
  message: "End time must be later than start time.",
  path: ["endsAt"],
});

export const updateMatchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  venue: z.string().trim().max(200).nullable().optional(),
  startsAt: dateTime.optional(),
  endsAt: dateTime.nullable().optional(),
  capacity: z.number().int().min(2).max(1000).nullable().optional(),
}).refine((value) => value.startsAt === undefined || value.endsAt === undefined || value.endsAt === null || value.endsAt > value.startsAt, {
  message: "End time must be later than start time.",
  path: ["endsAt"],
});

export const attendanceSchema = z.object({
  status: z.enum(["ATTENDED", "NO_SHOW"]),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
