import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./competitions.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const create: RequestHandler = async (req, res) => {
  const competition = await service.createCompetition(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { competition } });
};
export const list: RequestHandler = async (req, res) => {
  const competitions = await service.listCompetitions(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { competitions } });
};
export const getOne: RequestHandler = async (req, res) => {
  const competition = await service.getCompetition(param(req, "communityId"), param(req, "competitionId"), auth(res).userId);
  res.status(200).json({ success: true, data: { competition } });
};
export const transition: RequestHandler = async (req, res) => {
  const competition = await service.transitionCompetition(param(req, "communityId"), param(req, "competitionId"), auth(res).userId, req.body.status);
  res.status(200).json({ success: true, data: { competition } });
};
export const register: RequestHandler = async (req, res) => {
  const entry = await service.registerEntry(param(req, "communityId"), param(req, "competitionId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { entry } });
};
export const listEntries: RequestHandler = async (req, res) => {
  const entries = await service.listEntries(param(req, "communityId"), param(req, "competitionId"), auth(res).userId);
  res.status(200).json({ success: true, data: { entries } });
};
export const reviewEntry: RequestHandler = async (req, res) => {
  const entry = await service.reviewEntry(param(req, "communityId"), param(req, "competitionId"), param(req, "entryId"), auth(res).userId, req.body);
  res.status(200).json({ success: true, data: { entry } });
};
export const withdrawEntry: RequestHandler = async (req, res) => {
  await service.withdrawEntry(param(req, "communityId"), param(req, "competitionId"), param(req, "entryId"), auth(res).userId);
  res.status(204).send();
};

export const setSeed: RequestHandler = async (req, res) => {
  const entry = await service.setEntrySeed(
    param(req, "communityId"),
    param(req, "competitionId"),
    param(req, "entryId"),
    auth(res).userId,
    req.body.seed,
  );
  res.status(200).json({ success: true, data: { entry } });
};

export const getSchedule: RequestHandler = async (req, res) => {
  const schedule = await service.getSchedule(param(req, "communityId"), param(req, "competitionId"), auth(res).userId);
  res.status(200).json({ success: true, data: { schedule } });
};

export const generateSchedule: RequestHandler = async (req, res) => {
  const schedule = await service.generateSchedule(param(req, "communityId"), param(req, "competitionId"), auth(res).userId);
  res.status(201).json({ success: true, data: { schedule } });
};
