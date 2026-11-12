import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./governance.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const create: RequestHandler = async (req, res) => {
  const election = await service.createElection(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { election } });
};

export const list: RequestHandler = async (req, res) => {
  const elections = await service.listElections(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { elections } });
};

export const getOne: RequestHandler = async (req, res) => {
  const election = await service.getElection(param(req, "communityId"), param(req, "electionId"), auth(res).userId);
  res.status(200).json({ success: true, data: { election } });
};

export const nominate: RequestHandler = async (req, res) => {
  const nomination = await service.nominateSelf(param(req, "communityId"), param(req, "electionId"), auth(res).userId);
  res.status(201).json({ success: true, data: { nomination } });
};

export const withdrawNomination: RequestHandler = async (req, res) => {
  await service.withdrawSelfNomination(param(req, "communityId"), param(req, "electionId"), auth(res).userId);
  res.status(204).send();
};

export const vote: RequestHandler = async (req, res) => {
  const ballot = await service.castBallot(param(req, "communityId"), param(req, "electionId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { ballot } });
};
