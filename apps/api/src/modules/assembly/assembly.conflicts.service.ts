import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./assembly.conflicts.db.js";

const fail = (kind: string): never => {
  const errors: Record<string, [string, number]> = {
    NOT_FOUND: ["Community not found.", 404],
    CASE_NOT_FOUND: ["Assembly case not found.", 404],
    NOT_MEMBER: ["Only active community members may declare a conflict.", 403],
    SUBJECT_NOT_MEMBER: ["The conflict subject must be an active community member.", 400],
    REQUESTER_SUBJECT: ["The case requester is already excluded from their own case electorate.", 400],
    DECLARATIONS_CLOSED: ["Conflict declarations are closed because independent review has started.", 409],
    DECLARATION_NOT_FOUND: ["Open conflict declaration not found.", 404],
    NOT_PRIMARY_COUNCIL: ["Only an active primary Review Council member may perform this action.", 403],
    REQUESTER_RECUSED: ["The case requester cannot participate in conflict review or electorate administration.", 403],
    ALREADY_STARTED: ["Conflict review has already started.", 409],
    REVIEW_NOT_OPEN: ["Conflict determinations are not currently open.", 409],
    REVIEWER_CONFLICTED: ["A requester, declarant, subject, or potentially conflicted Council member cannot determine this declaration.", 403],
    REVIEW_NOT_STARTED: ["A primary Review Council member must first close declarations and start independent review.", 409],
    ALREADY_FROZEN: ["The Assembly electorate is already frozen.", 409],
    UNRESOLVED_CONFLICTS: ["The electorate cannot be frozen while any material-conflict declaration remains unresolved.", 409],
    NO_ELIGIBLE_VOTERS: ["The case has no eligible Assembly voters.", 409],
  };
  const [message, status] = errors[kind] ?? ["Unable to complete Assembly conflict review.", 409];
  throw new AppError(message, status);
};

export const declareConflict = async (communityId: string, caseId: string, userId: string, input: { subjectUserId: string; reason: string }) => {
  try {
    const result = await db.declareConflict(communityId, caseId, userId, input);
    if (result.kind !== "CREATED") fail(result.kind);
    return result.declaration;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("An open conflict declaration already exists for this person in this case.", 409);
    }
    throw error;
  }
};

export const withdrawConflictDeclaration = async (communityId: string, caseId: string, declarationId: string, userId: string) => {
  const result = await db.withdrawConflictDeclaration(communityId, caseId, declarationId, userId);
  if (result.kind !== "WITHDRAWN") fail(result.kind);
};

export const startConflictReview = async (communityId: string, caseId: string, userId: string) => {
  const result = await db.startConflictReview(communityId, caseId, userId);
  if (result.kind !== "STARTED") fail(result.kind);
  return result;
};

export const decideConflict = async (communityId: string, caseId: string, declarationId: string, userId: string, input: { conflictExists: boolean; reason: string }) => {
  try {
    const result = await db.decideConflict(communityId, caseId, declarationId, userId, input);
    if (result.kind !== "RECORDED") fail(result.kind);
    return result;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("You have already submitted an independent determination for this declaration.", 409);
    }
    throw error;
  }
};

export const freezeElectorate = async (communityId: string, caseId: string, userId: string) => {
  const result = await db.freezeElectorate(communityId, caseId, userId);
  if (result.kind !== "FROZEN") fail(result.kind);
  return result;
};

export const listMyConflictDeclarations = (communityId: string, caseId: string, userId: string) =>
  db.listMyConflictDeclarations(communityId, caseId, userId);

export const respondToConflictDeclaration = async (communityId: string, caseId: string, declarationId: string, userId: string, response: string) => {
  const result = await db.respondToConflictDeclaration(communityId, caseId, declarationId, userId, response);
  if (result.kind !== "RESPONDED") fail(result.kind);
  return result.declaration;
};

export const listConflictDeclarationsForCouncil = async (communityId: string, caseId: string, userId: string) => {
  const result = await db.listConflictDeclarationsForCouncil(communityId, caseId, userId);
  if (result.kind !== "LISTED") fail(result.kind);
  return result.declarations;
};
