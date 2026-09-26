import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../db/pool.js";
import { config } from "../config.js";
import { googleClient, googleTrustInfo, classifyGoogleError } from "../services/google-auth.js";
import {
  isEmailDeliveryEnabled,
  sendPasswordResetEmail,
  sendVerificationEmail
} from "../services/email.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert, HttpError } from "../utils/http-error.js";
import { splitLegacyName, userNameParts, validateNameParts } from "../utils/user-name.js";
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
    ...userNameParts(user),
    address: user.address ?? "",
    emailVerified: Boolean(user.email_verified_at),
    hasPassword: Boolean(user.password_hash)
  };
}

function googleCredentialMetadata(credential) {
  try {
    const encodedPayload = credential.split(".")[1];
    if (!encodedPayload) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return {
      audienceMatches: payload.aud === config.google.clientId,
      issuerValid: ["accounts.google.com", "https://accounts.google.com"].includes(payload.iss),
      expiresAt: Number(payload.exp),
      issuedAt: Number(payload.iat)
    };
  } catch {
    return null;
  }
}

function googleVerificationFailure(error, credential) {
  const metadata = googleCredentialMetadata(credential);
  const now = Math.floor(Date.now() / 1000);
  if (!metadata) return "Google returned a malformed sign-in credential.";
  if (!metadata.audienceMatches) {
    return "The Google token was issued for a different OAuth client ID. Restart the frontend after updating VITE_GOOGLE_CLIENT_ID.";
  }
  if (!metadata.issuerValid) return "The sign-in credential was not issued by Google.";
  if (metadata.expiresAt && metadata.expiresAt < now - 300) {
    return "The Google sign-in credential expired. Refresh the page and try again.";
  }
  if (metadata.issuedAt && metadata.issuedAt > now + 300) {
    return "The computer clock is behind Google. Synchronize Windows date and time, then try again.";
  }

  const message = String(error?.message ?? "").toLowerCase();
  if (classifyGoogleError(error) === "GOOGLE_TLS_TRUST") {
    return "The backend could not validate Google's HTTPS certificate.";
  }
  if (classifyGoogleError(error) === "GOOGLE_KEYS_UNAVAILABLE") {
    return "The backend could not download Google's signing keys. Please try again shortly.";
  }
  if (message.includes("no pem") || message.includes("signature")) {
    return "Google's signing key did not validate this credential. Refresh the page and try again.";
  }
  if (message.includes("wrong recipient") || message.includes("audience")) {
    return "The Google token was issued for a different OAuth client ID.";
  }
  if (message.includes("too late") || message.includes("expired")) {
    return "The Google sign-in credential expired. Refresh the page and try again.";
  }
  return "Google rejected the ID token. Check the backend terminal for the verification details.";
}

async function verifyGoogleCredential(credential) {
  assert(config.google.clientId, 503, "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and restart the backend.");
  assert(credential, 400, "Google did not return a sign-in credential.");
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.google.clientId
    });
    const profile = ticket.getPayload();
    assert(profile?.sub && profile?.email, 401, "Google sign-in could not be verified.");
    assert(profile.email_verified, 401, "The Google account email is not verified.");
    return profile;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const reason = googleVerificationFailure(error, credential);
    console.error("Google ID token verification failed:", {
      reason,
      code: classifyGoogleError(error),
      networkCode: String(error?.code ?? error?.cause?.code ?? ""),
      ...googleTrustInfo
    });
    const code = classifyGoogleError(error);
    const unavailable = ["GOOGLE_TLS_TRUST", "GOOGLE_KEYS_UNAVAILABLE"].includes(code);
    throw new HttpError(unavailable ? 503 : 401, `Google sign-in could not be verified. ${reason}`,
      config.nodeEnv === "development" ? { code, ...googleTrustInfo } : undefined);
  }
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
    const { firstName, middleName, lastName, fullName } = validateNameParts(req.body);
    const address = String(req.body.address ?? "").trim();
    const password = String(req.body.password ?? "");
    assert(emailPattern.test(email), 400, "Enter a valid email address.");
    assert(address.length >= 5 && address.length <= 255, 400, "Address must be 5-255 characters.");
    assert(password.length >= 8, 400, "Password must contain at least 8 characters.");
    assert(isEmailDeliveryEnabled(), 503, "Account creation email is not configured on the server yet.");

    const [existing] = await pool.execute("SELECT user_id FROM users WHERE email = ?", [email]);
    assert(!existing[0], 409, "An account already exists for this email.");

    const code = createVerificationCode();
    const userId = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO users
        (user_id, email, password_hash, full_name, first_name, middle_name, last_name,
          address, verification_code_hash, verification_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      [userId, email, await bcrypt.hash(password, 12), fullName, firstName, middleName, lastName, address, sha256(code)]
    );

    try {
      await sendVerificationEmail({ to: email, name: fullName, code });
    } catch (error) {
      await pool.execute(
        "DELETE FROM users WHERE user_id = ? AND email_verified_at IS NULL",
        [userId]
      );
      throw error;
    }

    res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      userId
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
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    assert(emailPattern.test(email), 400, "Enter a valid email address.");
    assert(isEmailDeliveryEnabled(), 503, "Password reset email is not configured on the server yet.");
    const code = createVerificationCode();
    const [rows] = await pool.execute(
      "SELECT user_id, full_name FROM users WHERE email = ? AND is_active = TRUE",
      [email]
    );
    const user = rows[0];
    if (user) {
      await pool.execute(
        `UPDATE users SET password_reset_code_hash = ?,
        password_reset_expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
       WHERE user_id = ?`,
        [sha256(code), user.user_id]
      );
      await sendPasswordResetEmail({ to: email, name: user.full_name, code });
    }
    res.json({
      message: "If an active account uses that email, a reset code was sent."
    });
  })
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const code = String(req.body.code ?? "").trim();
    const newPassword = String(req.body.newPassword ?? "");
    assert(emailPattern.test(email), 400, "Enter a valid email address.");
    assert(/^\d{6}$/.test(code), 400, "Enter the six-digit reset code.");
    assert(newPassword.length >= 8, 400, "New password must contain at least 8 characters.");

    await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT * FROM users
         WHERE email = ? AND password_reset_code_hash = ?
           AND password_reset_expires_at > CURRENT_TIMESTAMP AND is_active = TRUE
         FOR UPDATE`,
        [email, sha256(code)]
      );
      const user = rows[0];
      assert(user, 400, "The reset code is invalid or expired.");
      await connection.execute(
        `UPDATE users SET password_hash = ?, password_reset_code_hash = NULL,
          password_reset_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [await bcrypt.hash(newPassword, 12), user.user_id]
      );
      await connection.execute(
        `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND revoked_at IS NULL`,
        [user.user_id]
      );
    });

    res.json({ message: "Password updated. Sign in with your new password." });
  })
);

authRouter.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    assert(emailPattern.test(email), 400, "Enter a valid email address.");
    assert(isEmailDeliveryEnabled(), 503, "Verification email is not configured on the server yet.");
    const code = createVerificationCode();
    const [rows] = await pool.execute(
      `SELECT user_id, full_name FROM users
       WHERE email = ? AND email_verified_at IS NULL AND is_active = TRUE`,
      [email]
    );
    const user = rows[0];
    assert(user, 404, "Unverified account not found.");
    await pool.execute(
      `UPDATE users SET verification_code_hash = ?,
        verification_expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
       WHERE user_id = ?`,
      [sha256(code), user.user_id]
    );
    await sendVerificationEmail({ to: email, name: user.full_name, code });
    res.json({
      message: "A new verification code was sent to your email."
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
    assert(user?.password_hash && (await bcrypt.compare(password, user.password_hash)), 401, "Incorrect email or password.");
    assert(user.email_verified_at, 403, "Verify your email before signing in.");
    const tokens = await withTransaction((connection) => createSession(connection, user, req));
    res.json({ user: publicUser(user), ...tokens });
  })
);

authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const profile = await verifyGoogleCredential(String(req.body.credential ?? ""));
    const email = profile.email.trim().toLowerCase();
    const fallbackName = splitLegacyName(profile.name ?? email.split("@")[0]);
    const firstName = String(profile.given_name ?? fallbackName.firstName).trim().slice(0, 120);
    const middleName = "";
    const lastName = String(profile.family_name ?? fallbackName.lastName).trim().slice(0, 120);
    const fullName = [firstName, lastName].filter(Boolean).join(" ").slice(0, 120) || "Google user";

    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        "SELECT * FROM users WHERE email = ? FOR UPDATE",
        [email]
      );
      let user = rows[0];
      if (user) {
        assert(user.is_active, 403, "This account is disabled.");
        assert(!user.google_subject || user.google_subject === profile.sub, 409, "This email is linked to another Google account.");
        const googleIsAuthoritative = email.endsWith("@gmail.com") || Boolean(profile.hd);
        assert(user.google_subject || googleIsAuthoritative, 409, "Sign in with your password for this email address.");
        await connection.execute(
          `UPDATE users SET google_subject = ?,
            email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [profile.sub, user.user_id]
        );
        user = { ...user, google_subject: profile.sub, email_verified_at: user.email_verified_at ?? new Date() };
      } else {
        const userId = crypto.randomUUID();
        await connection.execute(
          `INSERT INTO users
            (user_id, email, password_hash, full_name, first_name, middle_name, last_name,
              email_verified_at, google_subject)
           VALUES (?, ?, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [userId, email, fullName, firstName, middleName, lastName, profile.sub]
        );
        user = {
          user_id: userId,
          email,
          full_name: fullName,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email_verified_at: new Date()
        };
      }
      const tokens = await createSession(connection, user, req);
      return { user: publicUser(user), ...tokens };
    });

    res.json(result);
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
    const address = req.body.address == null ? null : String(req.body.address).trim();
    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = req.body.newPassword == null ? null : String(req.body.newPassword);
    assert(address === null || (address.length >= 5 && address.length <= 255), 400, "Address must be 5-255 characters.");
    assert(newPassword === null || newPassword.length >= 8, 400, "New password must contain at least 8 characters.");

    const [rows] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [req.user.user_id]);
    const user = rows[0];
    const { firstName, middleName, lastName, fullName } = validateNameParts(req.body, user);
    if (newPassword) {
      if (user.password_hash) {
        assert(await bcrypt.compare(currentPassword, user.password_hash), 401, "Current password is incorrect.");
      }
    }
    const nextHash = newPassword ? await bcrypt.hash(newPassword, 12) : user.password_hash;
    await pool.execute("UPDATE users SET full_name = ?, first_name = ?, middle_name = ?, last_name = ?, address = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", [
      fullName,
      firstName,
      middleName,
      lastName,
      address ?? user.address,
      nextHash,
      user.user_id
    ]);
    res.json({
      user: publicUser({
        ...user,
        full_name: fullName,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        address: address ?? user.address,
        password_hash: nextHash
      }),
      message: "Profile updated."
    });
  })
);
