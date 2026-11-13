import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./assembly.db.js";
import type { SubmitAssemblyCaseInput } from "./assembly.validator.js";

const isConflict = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error &&
  (error.code === "P2002" || error.code === "P2034");

export const submitCase = async (communityId: string, requesterId: string, input: SubmitAssemblyCaseInput) => {
  let result: Awaited<ReturnType<typeof db.submitCase>>;
  try {
    result = await db.submitCase(communityId, requesterId, input);
  } catch (error) {
    if (isConflict(error)) throw new AppError("A case already exists for this issued assessment, or the request conflicted with another update. Reload and try again.", 409);
    throw error;
  }
  if (result.kind === "COMMUNITY_NOT_FOUND") throw new AppError("Community not found.", 404);
  if (result.kind === "NOT_MEMBER") throw new AppError("Only an active community member can submit an Assembly case.", 403);
  if (result.kind === "ASSESSMENT_NOT_FOUND") throw new AppError("An issued contribution assessment belonging to you is required.", 404);
  if (result.kind === "OBLIGATION_CANCELLED") throw new AppError("A cancelled obligation cannot be challenged through this process.", 409);
  if (result.kind === "CASE_ALREADY_EXISTS") throw new AppError("A case has already been submitted for this issued assessment.", 409);
  if (result.kind === "CREATED") return result.case;
  throw new AppError("Unable to submit Assembly case.", 409);
};

export const listMyCases = async (communityId: string, requesterId: string) => {
  return db.listMyCases(communityId, requesterId);
};

export const withdrawCase = async (communityId: string, caseId: string, requesterId: string) => {
  const withdrawn = await db.withdrawCase(communityId, caseId, requesterId);
  if (!withdrawn) throw new AppError("Only your own case that is still awaiting review can be withdrawn.", 409);
};
