/**
 * POST /submit — a hacker submits an attack as a runnable test.
 *
 * Returns 202 with a reportId immediately. The fork run takes 10-60s and we
 * never hold the request open for it; the frontend polls GET /report/:id.
 */
import { Router } from "express";
import { env } from "../env.js";
import { guardExploitSource, hashExploit } from "../checker/guard.js";
import { enqueue } from "../pipeline/index.js";
import * as store from "../store.js";
import type { SubmitRequest, SubmitResponse } from "../types.js";

export const submitRouter: Router = Router();

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

submitRouter.post("/submit", (req, res) => {
  const body = req.body as Partial<SubmitRequest> | undefined;

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "expected a JSON body" });
    return;
  }

  const { bountyId, hackerAddress, worldIdNullifier, exploitSource } = body;

  if (typeof bountyId !== "string" || !bountyId) {
    res.status(400).json({ error: "bountyId is required" });
    return;
  }
  if (typeof hackerAddress !== "string" || !ADDRESS.test(hackerAddress)) {
    res.status(400).json({ error: "hackerAddress must be a 0x address" });
    return;
  }
  if (typeof exploitSource !== "string") {
    res.status(400).json({ error: "exploitSource must be the text of Exploit.t.sol" });
    return;
  }

  const nullifier = typeof worldIdNullifier === "string" ? worldIdNullifier : "";

  // One submission per verified human. Skipped while World ID is not wired up
  // (B7) so the rest of the flow stays testable.
  if (env.worldAppId) {
    if (!nullifier) {
      res.status(401).json({ error: "verify with World ID before submitting" });
      return;
    }
    if (!store.isNullifierVerified(nullifier)) {
      res.status(401).json({ error: "this World ID proof was never verified with us" });
      return;
    }
    if (store.isNullifierSpent(nullifier)) {
      res.status(409).json({ error: "this World ID has already submitted once" });
      return;
    }
  }

  // Safety guard before anything expensive. Treat every submission as hostile.
  const guard = guardExploitSource(exploitSource, env.maxExploitBytes);
  if (!guard.ok) {
    res.status(400).json({ error: `submission rejected: ${guard.reason}` });
    return;
  }

  const exploitHash = hashExploit(exploitSource);

  const meta = { bountyId, hackerAddress, worldIdNullifier: nullifier };

  // Duplicate: the same attack, already seen. The company does not pay twice.
  const earlier = store.findDuplicate(exploitHash);
  if (earlier) {
    const envelope = store.createReport(meta);
    store.setStatus(
      envelope.reportId,
      "duplicate",
      `This exact attack was already submitted as ${earlier}.`,
    );
    const payload: SubmitResponse = {
      reportId: envelope.reportId,
      status: "duplicate",
    };
    res.status(202).json(payload);
    return;
  }

  const envelope = store.createReport(meta);
  store.rememberExploitHash(exploitHash, envelope.reportId);
  if (nullifier) store.spendNullifier(nullifier);

  enqueue(envelope.reportId, meta, exploitSource, exploitHash);

  const payload: SubmitResponse = {
    reportId: envelope.reportId,
    status: "checking",
  };
  res.status(202).json(payload);
});
