/**
 * GET /report/:id      — one report envelope. The frontend polls this ~every 2s.
 * GET /reports         — every report, newest first (the company's inbox).
 */
import { Router } from "express";
import * as store from "../store.js";

export const reportRouter: Router = Router();

reportRouter.get("/report/:id", (req, res) => {
  const envelope = store.getReport(req.params.id);
  if (!envelope) {
    res.status(404).json({ error: `no report with id ${req.params.id}` });
    return;
  }
  res.json(envelope);
});

reportRouter.get("/reports", (_req, res) => {
  res.json(store.listReports());
});
