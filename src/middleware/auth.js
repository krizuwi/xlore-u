import { pool } from "../db/pool.js";
import { HttpError } from "../utils/http-error.js";
import { verifyAccessToken } from "../utils/security.js";

export async function requireAuth(req, _res, next) {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "A Bearer access token is required."));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new HttpError(401, "Invalid or expired access token."));
  }

  try {
    const [rows] = await pool.execute(
      `SELECT user_id, email, full_name, first_name, middle_name, last_name,
        address, email_verified_at, password_hash
       FROM users WHERE user_id = ? AND is_active = TRUE`,
      [payload.sub]
    );
    if (!rows[0]) throw new HttpError(401, "The account is unavailable.");
    req.user = rows[0];
    next();
  } catch (error) {
    return next(error);
  }
}
