import { z } from "zod";

export const castAssemblyBallotSchema = z.object({
  vote: z.enum(["YES", "NO"]),
}).strict();

export type CastAssemblyBallotInput = z.infer<typeof castAssemblyBallotSchema>;
