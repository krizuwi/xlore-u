import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.routes.js";
import { schoolsRouter } from "./routes/schools.routes.js";
import { programsRouter } from "./routes/programs.routes.js";
import { assessmentsRouter } from "./routes/assessments.routes.js";
import { savedRouter } from "./routes/saved.routes.js";
import { comparisonRouter } from "./routes/comparison.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { errorHandler, notFound } from "./routes/middleware/errors.js";
import { getSystemHealth } from "./utils/api-health-check.js";

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

app.get(["/api/health", "/api/health-check"], async (req, res) => {
  // Probe this server directly, without relying on the client's Host header.
  const apiUrl = `http://127.0.0.1:${req.socket.localPort ?? config.port}/api`;
  const health = await getSystemHealth(apiUrl);
  res.set("Cache-Control", "no-store");
  res.status(health.status === "ok" ? 200 : 503).json(health);
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
app.use("/api/admin", adminRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
