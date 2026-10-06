import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import { id } from "../services/admin-validation.js";

export const schoolMediaRouter = Router();
schoolMediaRouter.get("/:id", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute("SELECT content_type, image_data FROM school_media_assets WHERE asset_id = ?", [id(req.params.id)]);
  assert(rows[0], 404, "Image not found.");
  res.set({ "Content-Type": rows[0].content_type, "Cache-Control": "public, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" }).send(rows[0].image_data);
}));
