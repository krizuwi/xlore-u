import { pool } from "../db/pool.js";
import { HttpError } from "../utils/http-error.js";
import { verifyAccessToken } from "../utils/security.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "A Bearer access token is required.");
    }

    const payload = verifyAccessToken(token);
    const [rows] = await pool.execute(
      `SELECT user_id, email, full_name, email_verified_at
       FROM users WHERE user_id = ? AND is_active = TRUE`,
      [payload.sub]
    );
    if (!rows[0]) throw new HttpError(401, "The account is unavailable.");
    req.user = rows[0];
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, "Invalid or expired access token."));
  }
}
