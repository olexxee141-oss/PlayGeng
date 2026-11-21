import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./assembly.voting.db.js";

const fail = (kind: string): never => {
  const errors: Record<string, [string, number]> = {
    NOT_FOUND: ["Community not found.", 404],
    CASE_NOT_FOUND: ["Assembly case not found.", 404],
    NOT_PRIMARY_COUNCIL: ["Only an active primary Review Council member may administer this Assembly lifecycle step.", 403],
    REQUESTER_RECUSED: ["The case requester cannot administer this Assembly lifecycle step.", 403],
    REVIEWER_CONFLICTED: ["A conflicted participant cannot administer this Assembly lifecycle step.", 403],
    ELECTORATE_NOT_FROZEN: ["The electorate must be frozen before a case notice can be published.", 409],
    NOTICE_NOT_AVAILABLE: ["A notice cannot be published in the case's current state.", 409],
    VOTING_NOT_AVAILABLE: ["Voting cannot be opened in the case's current state.", 409],
    NOTICE_PERIOD_ACTIVE: ["The mandatory 48-hour notice period has not elapsed.", 409],
    VOTING_CLOSED: ["Assembly voting is not currently open.", 409],
    NOT_ELIGIBLE: ["You are not eligible in this case's frozen electorate.", 403],
    OUTCOME_NOT_AVAILABLE: ["A voting outcome cannot be recorded in the case's current state.", 409],
    VOTING_STILL_OPEN: ["Voting cannot be finalized before the 72-hour voting window closes.", 409],
  };
  const [message,status]=errors[kind]??["Unable to complete the Assembly voting action.",409];
  throw new AppError(message,status);
};

export const publishAssemblyNotice = async (communityId:string,caseId:string,userId:string) => {
  const result=await db.publishAssemblyNotice(communityId,caseId,userId);
  if(result.kind!=="PUBLISHED") fail(result.kind);
  return result;
};

export const openAssemblyVoting = async (communityId:string,caseId:string,userId:string) => {
  const result=await db.openAssemblyVoting(communityId,caseId,userId);
  if(result.kind!=="OPENED") fail(result.kind);
  return result;
};

export const castAssemblyBallot = async (communityId:string,caseId:string,userId:string,vote:"YES"|"NO") => {
  try {
    const result=await db.castAssemblyBallot(communityId,caseId,userId,vote);
    if(result.kind!=="CAST") fail(result.kind);
    return result.ballot;
  } catch(error) {
    if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002") throw new AppError("You have already cast your immutable ballot for this case.",409);
    throw error;
  }
};

export const finalizeAssemblyVoting = async (communityId:string,caseId:string,userId:string) => {
  const result=await db.finalizeAssemblyVoting(communityId,caseId,userId);
  if(result.kind!=="FINALIZED") fail(result.kind);
  return result;
};

export const getAssemblyVotingStatus = async (communityId:string,caseId:string,userId:string) => {
  const result=await db.getAssemblyVotingStatus(communityId,caseId,userId);
  if(result.kind!=="STATUS") fail(result.kind);
  return result;
};
