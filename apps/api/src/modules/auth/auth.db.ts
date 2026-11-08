import { prisma } from "@playgeng/database";
import type { RegisterInput } from "./auth.validator.js";

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });

export const findUserById = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

export const createUser = (input: RegisterInput, passwordHash: string) =>
  prisma.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    },
  });

export const createSession = (data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}) =>
  prisma.authSession.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ...(data.userAgent ? { userAgent: data.userAgent } : {}),
      ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
    },
  });

export const findActiveSessionByTokenHash = (tokenHash: string) =>
  prisma.authSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

export const rotateSession = async (input: {
  sessionId: string;
  oldTokenHash: string;
  newTokenHash: string;
  expiresAt: Date;
}) =>
  prisma.$transaction(async (tx) => {
    const revoked = await tx.authSession.updateMany({
      where: {
        id: input.sessionId,
        tokenHash: input.oldTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) return false;

    const current = await tx.authSession.findUniqueOrThrow({
      where: { id: input.sessionId },
    });

    await tx.authSession.create({
      data: {
        userId: current.userId,
        tokenHash: input.newTokenHash,
        expiresAt: input.expiresAt,
        userAgent: current.userAgent,
        ipAddress: current.ipAddress,
      },
    });

    return true;
  });

export const revokeSessionByTokenHash = (tokenHash: string) =>
  prisma.authSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

export const createEmailVerificationToken = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) =>
  prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.deleteMany({
      where: { userId, consumedAt: null },
    });
    return tx.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  });

export const consumeEmailVerificationToken = async (tokenHash: string) =>
  prisma.$transaction(async (tx) => {
    const token = await tx.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) return null;

    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) return null;

    return tx.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
  });
