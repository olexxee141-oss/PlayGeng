import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./teams.service.js";
import { sportSchema } from "./teams.validator.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const listSports: RequestHandler = async (req, res) => {
  const sports = await service.listSports(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { sports } });
};
export const enableSport: RequestHandler = async (req, res) => {
  const sport = await service.enableSport(param(req, "communityId"), auth(res).userId, req.body.sport);
  res.status(201).json({ success: true, data: { sport } });
};
export const removeSport: RequestHandler = async (req, res) => {
  await service.removeSport(param(req, "communityId"), auth(res).userId, sportSchema.parse(param(req, "sport")));
  res.status(204).send();
};
export const listTeams: RequestHandler = async (req, res) => {
  const teams = await service.listTeams(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { teams } });
};
export const getTeam: RequestHandler = async (req, res) => {
  const team = await service.getTeam(param(req, "communityId"), param(req, "teamId"), auth(res).userId);
  res.status(200).json({ success: true, data: { team } });
};
export const createTeam: RequestHandler = async (req, res) => {
  const team = await service.createTeam(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { team } });
};
export const updateTeam: RequestHandler = async (req, res) => {
  const team = await service.updateTeam(param(req, "communityId"), param(req, "teamId"), auth(res).userId, req.body);
  res.status(200).json({ success: true, data: { team } });
};
export const archiveTeam: RequestHandler = async (req, res) => {
  await service.archiveTeam(param(req, "communityId"), param(req, "teamId"), auth(res).userId);
  res.status(204).send();
};
export const addTeamMember: RequestHandler = async (req, res) => {
  const member = await service.addTeamMember(param(req, "communityId"), param(req, "teamId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { member } });
};
export const updateTeamMemberRole: RequestHandler = async (req, res) => {
  const member = await service.updateTeamMemberRole(param(req, "communityId"), param(req, "teamId"), auth(res).userId, param(req, "userId"), req.body.role);
  res.status(200).json({ success: true, data: { member } });
};
export const removeTeamMember: RequestHandler = async (req, res) => {
  await service.removeTeamMember(param(req, "communityId"), param(req, "teamId"), auth(res).userId, param(req, "userId"));
  res.status(204).send();
};
