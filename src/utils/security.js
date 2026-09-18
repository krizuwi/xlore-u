import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const createVerificationCode = () =>
  crypto.randomInt(100000, 1000000).toString();

export function createAccessToken(user) {
  return jwt.sign(
    { sub: user.user_id, email: user.email, type: "access" },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl }
  );
}

export function createRefreshToken(user, sessionId) {
  return jwt.sign(
    { sub: user.user_id, sid: sessionId, type: "refresh" },
    config.jwt.refreshSecret,
    { expiresIn: `${config.jwt.refreshDays}d` }
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwt.accessSecret);
  if (payload.type !== "access") throw new Error("Invalid token type");
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret);
  if (payload.type !== "refresh") throw new Error("Invalid token type");
  return payload;
}
