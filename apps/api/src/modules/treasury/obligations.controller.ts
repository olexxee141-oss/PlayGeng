import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./obligations.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};
const pagination = (req: Request) => {
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("Invalid page limit.", 400);
  return { cursor, limit };
};

export const create: RequestHandler = async (req, res) => {
  const obligation = await service.create(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { obligation } });
};
export const cancel: RequestHandler = async (req, res) => {
  const obligation = await service.cancel(param(req, "communityId"), auth(res).userId, param(req, "obligationId"), req.body);
  res.status(200).json({ success: true, data: { obligation } });
};
export const listMine: RequestHandler = async (req, res) => {
  const page = pagination(req);
  const obligations = await service.listForMember(param(req, "communityId"), auth(res).userId, page.cursor, page.limit);
  res.status(200).json({ success: true, data: { obligations } });
};
export const listAll: RequestHandler = async (req, res) => {
  const page = pagination(req);
  const obligations = await service.listForFinance(param(req, "communityId"), auth(res).userId, page.cursor, page.limit);
  res.status(200).json({ success: true, data: { obligations } });
};
export const getOne: RequestHandler = async (req, res) => {
  const obligation = await service.getOne(param(req, "communityId"), auth(res).userId, param(req, "obligationId"));
  res.status(200).json({ success: true, data: { obligation } });
};
