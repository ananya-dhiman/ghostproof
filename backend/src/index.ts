/**
 * Ghostproof backend — the checker service.
 *
 * Five endpoints, all consumed by the frontend (Person C):
 *   POST /submit        a hacker submits an attack        -> 202 { reportId }
 *   GET  /report/:id    poll one report's progress
 *   GET  /reports       the company's inbox
 *   GET  /records       the public track record (Arkiv)
 *   POST /verify-human  World ID proof check
 *   GET  /health        what is wired up right now
 */
import cors from "cors";
import express from "express";
import { describeBoot, env } from "./env.js";
import { healthRouter } from "./routes/health.js";
import { recordsRouter } from "./routes/records.js";
import { reportRouter } from "./routes/report.js";
import { submitRouter } from "./routes/submit.js";
import { worldIdRouter } from "./routes/worldid.js";

const app = express();

app.use(cors({ origin: env.corsOrigins }));
// Exploit sources are text, and the guard enforces the real size limit.
app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use(submitRouter);
app.use(reportRouter);
app.use(recordsRouter);
app.use(worldIdRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "no such endpoint" });
});

// Express 5 forwards async rejections here, so a thrown error cannot take the
// process down mid-demo.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[http] unhandled:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal error" });
  },
);

app.listen(env.port, () => {
  console.log(`\nGhostproof backend on http://localhost:${env.port}`);
  console.log(`  ${describeBoot()}\n`);
});
