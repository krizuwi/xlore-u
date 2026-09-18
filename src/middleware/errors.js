import { HttpError } from "../utils/http-error.js";

export function notFound(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status ?? (error.code === "23505" ? 409 : 500);
  const message =
    status === 500 ? "An unexpected server error occurred." : error.message;

  if (status === 500) console.error(error);

  res.status(status).json({
    error: {
      message,
      ...(error.details ? { details: error.details } : {})
    }
  });
}
