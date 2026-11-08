import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type RequestPart = "body" | "query" | "params";

export const validate = (
  schema: ZodType,
  part: RequestPart = "body",
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(result.error);
      return;
    }

    if (part === "body") {
      req.body = result.data;
    }

    next();
  };
};