import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./assembly.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const submitCase: RequestHandler = async (req, res) => {
  const result = await service.submitCase(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { case: result } });
};

export const listMyCases: RequestHandler = async (req, res) => {
  const cases = await service.listMyCases(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { cases } });
};

export const withdrawCase: RequestHandler = async (req, res) => {
  await service.withdrawCase(param(req, "communityId"), param(req, "caseId"), auth(res).userId);
  res.status(204).send();
};

import * as conflictService from "./assembly.conflicts.service.js";

export const declareConflict: RequestHandler = async (req, res) => {
  const declaration = await conflictService.declareConflict(param(req, "communityId"), param(req, "caseId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { declaration } });
};

export const withdrawConflict: RequestHandler = async (req, res) => {
  await conflictService.withdrawConflictDeclaration(param(req, "communityId"), param(req, "caseId"), param(req, "declarationId"), auth(res).userId);
  res.status(204).send();
};

export const listMyConflicts: RequestHandler = async (req, res) => {
  const declarations = await conflictService.listMyConflictDeclarations(param(req, "communityId"), param(req, "caseId"), auth(res).userId);
  res.status(200).json({ success: true, data: { declarations } });
};

export const startConflictReview: RequestHandler = async (req, res) => {
  const result = await conflictService.startConflictReview(param(req, "communityId"), param(req, "caseId"), auth(res).userId);
  res.status(200).json({ success: true, data: result });
};

export const decideConflict: RequestHandler = async (req, res) => {
  const result = await conflictService.decideConflict(param(req, "communityId"), param(req, "caseId"), param(req, "declarationId"), auth(res).userId, req.body);
  res.status(200).json({ success: true, data: result });
};

export const freezeElectorate: RequestHandler = async (req, res) => {
  const result = await conflictService.freezeElectorate(param(req, "communityId"), param(req, "caseId"), auth(res).userId);
  res.status(200).json({ success: true, data: result });
};
