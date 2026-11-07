/**
 * GET /records — the public track record.
 *
 * Arkiv is the source of truth (interface #5), so we read it directly: the whole
 * argument in /arkiv/why-arkiv.md is that this record does NOT live in our own
 * database, and serving it from our mirror would quietly contradict that.
 *
 * The local mirror remains the fallback. If Arkiv is unconfigured, unreachable,
 * or has nothing yet, the page still renders — and `source` says which one you
 * are looking at, so the demo never overstates where the data came from.
 */
import { Router } from "express";
import * as store from "../store.js";
import { readArkivRecords } from "../arkiv/client.js";

export const recordsRouter: Router = Router();

recordsRouter.get("/records", async (_req, res) => {
  const fromArkiv = await readArkivRecords();

  if (fromArkiv && fromArkiv.length > 0) {
    res.json({ source: "arkiv" as const, records: fromArkiv });
    return;
  }

  res.json({ source: "mirror" as const, records: store.listArkivMirror() });
});
