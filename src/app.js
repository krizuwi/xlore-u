import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { authRouter } from "./routes/auth.routes.js";
import { schoolsRouter } from "./routes/schools.routes.js";
import { programsRouter } from "./routes/programs.routes.js";
import { assessmentsRouter } from "./routes/assessments.routes.js";
import { savedRouter } from "./routes/saved.routes.js";
import { comparisonRouter } from "./routes/comparison.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "unavailable", database: "disconnected", timestamp: new Date().toISOString() });
  }
});

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
  }),
  authRouter
);
app.use("/api/schools", schoolsRouter);
app.use("/api/programs", programsRouter);
app.use("/api/assessments", assessmentsRouter);
app.use("/api/saved", savedRouter);
app.use("/api/comparison", comparisonRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/catalog", catalogRouter);

app.use(notFound);
app.use(errorHandler);
