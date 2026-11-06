/**
 * GET /records — the public track record.
 *
 * The source of truth is Arkiv (interface #5). Until B6 wires the SDK up, and
 * as a fallback if the Arkiv RPC is unreachable during judging, this serves the
 * local mirror of everything we wrote. The shape is identical either way, so
 * the public record page never has to care which one it got.
 */
import { Router } from "express";
import * as store from "../store.js";

export const recordsRouter: Router = Router();

recordsRouter.get("/records", async (_req, res) => {
  // TODO(B6): read from Arkiv first, fall back to the mirror on failure.
  const records = store.listArkivMirror();
  res.json({ source: "mirror" as const, records });
});
