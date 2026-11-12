import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./receipts.service.js";

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

export const verifyManual: RequestHandler = async (req, res) => {
  const receipt = await service.verifyManualReceipt(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { receipt } });
};
export const listMine: RequestHandler = async (req, res) => {
  const page = pagination(req);
  const receipts = await service.listMine(param(req, "communityId"), auth(res).userId, page.cursor, page.limit);
  res.status(200).json({ success: true, data: { receipts } });
};
export const listAll: RequestHandler = async (req, res) => {
  const page = pagination(req);
  const receipts = await service.listForFinance(param(req, "communityId"), auth(res).userId, page.cursor, page.limit);
  res.status(200).json({ success: true, data: { receipts } });
};
export const getOne: RequestHandler = async (req, res) => {
  const receipt = await service.getOne(param(req, "communityId"), auth(res).userId, param(req, "receiptId"));
  res.status(200).json({ success: true, data: { receipt } });
};
