import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createOpaqueToken, hashPassword, hashToken, verifyPassword } from "../../shared/utils/crypto.js";
import { signAccessToken } from "../../shared/utils/jwt.js";
import * as authDb from "./auth.db.js";
import type { LoginInput, RegisterInput } from "./auth.validator.js";

const refreshExpiry = () =>
  new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const dummyPasswordHash = hashPassword("playgeng-invalid-login-dummy-password");

const createSessionTokens = async (
  userId: string,
  sessionId: string,
  refreshToken: string,
) => ({
  accessToken: await signAccessToken({ userId, sessionId }),
  refreshToken,
  tokenType: "Bearer" as const,
  expiresIn: env.JWT_ACCESS_TTL_SECONDS,
});

const sendVerificationEmail = async (email: string, firstName: string, token: string) => {
  if (!env.RESEND_API_KEY) {
    logger.warn({ email }, "Email verification was not delivered because RESEND_API_KEY is not configured");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Verify your PlayGeng account",
      text: `Hi ${firstName},\n\nYour PlayGeng verification code is:\n\n${token}\n\nThis code expires in 24 hours. If you did not create this account, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "Email verification delivery failed");
    throw new AppError("Unable to send verification email. Please try again later.", 502);
  }

  return true;
};

export const register = async (
  input: RegisterInput,
  metadata: { userAgent?: string; ipAddress?: string },
) => {
  const passwordHash = await hashPassword(input.password);
  const existing = await authDb.findUserByEmail(input.email);
  if (existing) {
    if (existing.status === "ACTIVE" && !existing.emailVerifiedAt) {
      const verificationToken = createOpaqueToken();
      await authDb.createEmailVerificationToken(
        existing.id,
        hashToken(verificationToken),
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      const emailSent = await sendVerificationEmail(
        existing.email,
        existing.firstName,
        verificationToken,
      );

      return {
        message: "If the account can be registered, verification instructions will be sent to the supplied email address.",
        ...(env.NODE_ENV !== "production" && !emailSent
          ? { developmentVerificationToken: verificationToken }
          : {}),
      };
    }

    return {
      message: "If the account can be registered, verification instructions will be sent to the supplied email address.",
    };
  }
 
  const user = await authDb.createUser(input, passwordHash);
  const verificationToken = createOpaqueToken();

  await authDb.createEmailVerificationToken(
    user.id,
    hashToken(verificationToken),
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );

  const emailSent = await sendVerificationEmail(user.email, user.firstName, verificationToken);

  return {
    message: "If the account can be registered, verification instructions will be sent to the supplied email address.",
    ...(env.NODE_ENV !== "production" && !emailSent
      ? { developmentVerificationToken: verificationToken }
      : {}),
  };
};

export const login = async (
  input: LoginInput,
  metadata: { userAgent?: string; ipAddress?: string },
) => {
  const user = await authDb.findUserByEmail(input.email);
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
  const passwordMatches = await verifyPassword(input.password, passwordHash);

  if (!user || user.status !== "ACTIVE" || !passwordMatches || !user.emailVerifiedAt) {
    throw new AppError("Unable to sign in. Check your credentials and account status.", 401);
  }

  const refreshToken = createOpaqueToken();
  const session = await authDb.createSession({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiry(),
    ...metadata,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: true,
    },
    tokens: await createSessionTokens(user.id, session.id, refreshToken),
  };
};

export const refresh = async (refreshToken: string) => {
  const oldHash = hashToken(refreshToken);
  const session = await authDb.findActiveSessionByTokenHash(oldHash);

  if (!session || session.user.status !== "ACTIVE" || !session.user.emailVerifiedAt) {
    throw new AppError("Refresh token is invalid or expired.", 401);
  }

  const nextRefreshToken = createOpaqueToken();
  const rotated = await authDb.rotateSession({
    sessionId: session.id,
    oldTokenHash: oldHash,
    newTokenHash: hashToken(nextRefreshToken),
    expiresAt: refreshExpiry(),
  });

  if (!rotated) {
    throw new AppError("Refresh token is invalid or expired.", 401);
  }

  return {
    tokens: await createSessionTokens(session.userId, rotated.id, nextRefreshToken),
  };
};

export const logout = async (refreshToken?: string) => {
  if (refreshToken) {
    await authDb.revokeSessionByTokenHash(hashToken(refreshToken));
  }
};

export const verifyEmail = async (token: string) => {
  const user = await authDb.consumeEmailVerificationToken(hashToken(token));

  if (!user) {
    throw new AppError("Verification code is invalid or expired.", 400);
  }

  return {
    user,
    message: "Email address verified. You can now sign in.",
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await authDb.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("User account is unavailable.", 401);
  }

  return user;
};

export const forgotPassword = async (email: string) => {
  const genericMessage = "If an eligible account exists, password reset instructions will be sent to its email address.";
  const user = await authDb.findUserByEmail(email);

  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
    return { message: genericMessage };
  }

  const token = createOpaqueToken();
  await authDb.createPasswordResetToken(
    user.id,
    hashToken(token),
    new Date(Date.now() + 60 * 60 * 1000),
  );

  if (env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [user.email],
        subject: "Reset your PlayGeng password",
        text: `Hi ${user.firstName},\n\nYour password reset code is:\n\n${token}\n\nThis code expires in one hour. If you did not request this, ignore this email.`,
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Password reset email delivery failed");
      throw new AppError("Unable to send password reset instructions.", 502);
    }
  } else {
    logger.warn({ email: user.email }, "Password reset email was not delivered because RESEND_API_KEY is not configured");
  }

  return {
    message: genericMessage,
    ...(env.NODE_ENV !== "production" && !env.RESEND_API_KEY
      ? { developmentResetToken: token }
      : {}),
  };
};

export const resetPassword = async (token: string, password: string) => {
  const passwordHash = await hashPassword(password);
  const updated = await authDb.consumePasswordResetToken(hashToken(token), passwordHash);

  if (!updated) {
    throw new AppError("Password reset code is invalid or expired.", 400);
  }

  return { message: "Password reset successfully. Sign in with your new password." };
};
