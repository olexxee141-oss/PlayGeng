import type { RequestHandler } from "express";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { verifyAccessToken } from "../../shared/utils/jwt.js";

export type AuthContext = {
  userId: string;
  sessionId: string;
};

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const authorization = req.header("authorization");
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new AppError("Authentication is required.", 401);
    }

    const claims = await verifyAccessToken(token);
    const session = await prisma.authSession.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: {
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
        },
      },
      select: { id: true },
    });

    if (!session) {
      throw new AppError("Your session is no longer valid.", 401);
    }

    (res.locals as { auth?: AuthContext }).auth = {
      userId: claims.userId,
      sessionId: claims.sessionId,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError("Invalid or expired access token.", 401));
  }
};
