import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AccessTokenClaims = {
  userId: string;
  sessionId: string;
};

export const signAccessToken = async (claims: AccessTokenClaims): Promise<string> =>
  new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.JWT_ACCESS_TTL_SECONDS)
    .sign(secret);

export const verifyAccessToken = async (token: string): Promise<AccessTokenClaims> => {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
    throw new Error("Invalid access token claims");
  }

  return { userId: payload.sub, sessionId: payload.sid };
};
