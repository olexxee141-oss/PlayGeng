import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./contributions.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const createCampaign: RequestHandler = async (req, res) => {
  const campaign = await service.createCampaign(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { campaign } });
};
export const listCampaigns: RequestHandler = async (req, res) => {
  const campaigns = await service.listCampaigns(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { campaigns } });
};
export const getCampaign: RequestHandler = async (req, res) => {
  const campaign = await service.getCampaign(param(req, "communityId"), auth(res).userId, param(req, "campaignId"));
  res.status(200).json({ success: true, data: { campaign } });
};
export const updateCampaign: RequestHandler = async (req, res) => {
  const campaign = await service.updateCampaign(param(req, "communityId"), auth(res).userId, param(req, "campaignId"), req.body);
  res.status(200).json({ success: true, data: { campaign } });
};
export const transition = (event: "PAUSED" | "RESUMED" | "ENDED" | "CANCELLED"): RequestHandler => async (req, res) => {
  const campaign = await service.transitionCampaign(param(req, "communityId"), auth(res).userId, param(req, "campaignId"), event, req.body.reason);
  res.status(200).json({ success: true, data: { campaign } });
};
export const createAssessment: RequestHandler = async (req, res) => {
  const assessment = await service.createAssessment(param(req, "communityId"), auth(res).userId, param(req, "campaignId"), req.body);
  res.status(201).json({ success: true, data: { assessment } });
};
export const listAssessments: RequestHandler = async (req, res) => {
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;
  const assessments = await service.listAssessments(param(req, "communityId"), auth(res).userId, campaignId);
  res.status(200).json({ success: true, data: { assessments } });
};
export const updateAssessment: RequestHandler = async (req, res) => {
  const assessment = await service.updateAssessment(param(req, "communityId"), auth(res).userId, param(req, "assessmentId"), req.body);
  res.status(200).json({ success: true, data: { assessment } });
};

export const issueAssessment: RequestHandler = async (req, res) => {
  const assessment = await service.issueAssessment(param(req, "communityId"), auth(res).userId, param(req, "assessmentId"));
  res.status(200).json({ success: true, data: { assessment } });
};
