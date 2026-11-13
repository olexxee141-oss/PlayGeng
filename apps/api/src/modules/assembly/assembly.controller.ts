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
