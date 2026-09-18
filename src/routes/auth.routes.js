import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../db/pool.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert, HttpError } from "../utils/http-error.js";
import {
  createAccessToken,
  createRefreshToken,
  createVerificationCode,
  sha256,
  verifyRefreshToken
} from "../utils/security.js";

export const authRouter = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user.user_id,
    email: user.email,
    fullName: user.full_name,
    emailVerified: Boolean(user.email_verified_at)
  };
}

async function createSession(connection, user, req) {
  const sessionId = crypto.randomUUID();
  const refreshToken = createRefreshToken(user, sessionId);
  const expiresAt = new Date(Date.now() + config.jwt.refreshDays * 86400000);
  await connection.execute(
    `INSERT INTO user_sessions
      (session_id, user_id, refresh_token_hash, device_type, browser, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      user.user_id,
      sha256(refreshToken),
      req.get("sec-ch-ua-mobile") === "?1" ? "mobile" : "desktop",
      (req.get("user-agent") ?? "unknown").slice(0, 255),
      req.ip,
      expiresAt
    ]
  );
  return { accessToken: createAccessToken(user), refreshToken };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const fullName = String(req.body.fullName ?? "").trim();
    const password = String(req.body.password ?? "");
    assert(emailPattern.test(email), 400, "Enter a valid email address.");
    assert(fullName.length >= 2 && fullName.length <= 120, 400, "Full name must be 2-120 characters.");
    assert(password.length >= 8, 400, "Password must contain at least 8 characters.");

    const [existing] = await pool.execute("SELECT user_id FROM users WHERE email = ?", [email]);
    assert(!existing[0], 409, "An account already exists for this email.");

    const code = createVerificationCode();
    const userId = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO users
        (user_id, email, password_hash, full_name, verification_code_hash, verification_expires_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      [userId, email, await bcrypt.hash(password, 12), fullName, sha256(code)]
    );

    res.status(201).json({
      message: "Account created. Verify the email before signing in.",
      userId,
      ...(config.returnVerificationCode ? { verificationCode: code } : {})
    });
  })
);

authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const code = String(req.body.code ?? "").trim();
    const [result] = await pool.execute(
      `UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, verification_code_hash = NULL,
        verification_expires_at = NULL
       WHERE email = ? AND verification_code_hash = ?
         AND verification_expires_at > CURRENT_TIMESTAMP AND email_verified_at IS NULL`,
      [email, sha256(code)]
    );
    assert(result.affectedRows === 1, 400, "The verification code is invalid or expired.");
    res.json({ message: "Email verified. You can now sign in." });
  })
);

authRouter.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const code = createVerificationCode();
    const [result] = await pool.execute(
      `UPDATE users SET verification_code_hash = ?,
        verification_expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
       WHERE email = ? AND email_verified_at IS NULL AND is_active = TRUE`,
      [sha256(code), email]
    );
    assert(result.affectedRows === 1, 404, "Unverified account not found.");
    res.json({
      message: "A new verification code was generated.",
      ...(config.returnVerificationCode ? { verificationCode: code } : {})
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ? AND is_active = TRUE",
      [email]
    );
    const user = rows[0];
    assert(user && (await bcrypt.compare(password, user.password_hash)), 401, "Incorrect email or password.");
    assert(user.email_verified_at, 403, "Verify your email before signing in.");
    const tokens = await withTransaction((connection) => createSession(connection, user, req));
    res.json({ user: publicUser(user), ...tokens });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = String(req.body.refreshToken ?? "");
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token.");
    }

    const [rows] = await pool.execute(
      `SELECT u.* FROM user_sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.session_id = ? AND s.user_id = ? AND s.refresh_token_hash = ?
         AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE`,
      [payload.sid, payload.sub, sha256(refreshToken)]
    );
    assert(rows[0], 401, "Refresh session is no longer valid.");
    res.json({ accessToken: createAccessToken(rows[0]) });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const refreshToken = String(req.body.refreshToken ?? "");
    if (refreshToken) {
      await pool.execute(
        "UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = ?",
        [sha256(refreshToken)]
      );
    }
    res.status(204).end();
  })
);

authRouter.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fullName = req.body.fullName == null ? null : String(req.body.fullName).trim();
    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = req.body.newPassword == null ? null : String(req.body.newPassword);
    assert(fullName === null || (fullName.length >= 2 && fullName.length <= 120), 400, "Full name must be 2-120 characters.");
    assert(newPassword === null || newPassword.length >= 8, 400, "New password must contain at least 8 characters.");

    const [rows] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [req.user.user_id]);
    const user = rows[0];
    if (newPassword) {
      assert(await bcrypt.compare(currentPassword, user.password_hash), 401, "Current password is incorrect.");
    }
    const nextHash = newPassword ? await bcrypt.hash(newPassword, 12) : user.password_hash;
    await pool.execute("UPDATE users SET full_name = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", [
      fullName ?? user.full_name,
      nextHash,
      user.user_id
    ]);
    res.json({
      user: publicUser({ ...user, full_name: fullName ?? user.full_name }),
      message: "Profile updated."
    });
  })
);
