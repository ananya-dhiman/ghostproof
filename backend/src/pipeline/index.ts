/**
 * Pipeline dispatcher.
 *
 * One submission at a time: a fork run spawns anvil and a forge compile, both
 * of which are hungry, and two concurrent runs on a laptop during a live demo
 * is how you get a timeout on stage. Submissions queue instead.
 */
import { env } from "../env.js";
import * as store from "../store.js";
import type { SubmissionMetadata } from "../types.js";
import { runMockPipeline } from "./mock.js";

let queue: Promise<void> = Promise.resolve();

/**
 * Hands the submission to the pipeline and returns immediately. The HTTP
 * request must never wait on this — the frontend polls GET /report/:id.
 */
export function enqueue(
  reportId: string,
  meta: SubmissionMetadata,
  exploitSource: string,
  exploitHash: `0x${string}`,
): void {
  queue = queue
    .then(() => run(reportId, meta, exploitSource, exploitHash))
    .catch((err: unknown) => {
      // A failure in one submission must never stall the queue for the next.
      console.error(`[pipeline] ${reportId} failed:`, err);
      store.setStatus(
        reportId,
        "error",
        "The checker hit an internal problem. This is on us, not on the submission.",
      );
    });
}

async function run(
  reportId: string,
  meta: SubmissionMetadata,
  exploitSource: string,
  exploitHash: `0x${string}`,
): Promise<void> {
  if (env.mockPipeline) {
    console.log(`[pipeline] ${reportId} running in MOCK mode`);
    await runMockPipeline(reportId, meta, exploitHash);
    return;
  }

  // B1-B6 replace this with: anvil fork -> forge measure -> rule tests ->
  // evidence report -> autoPayout -> Arkiv record.
  // TODO(B1): real fork runner.
  void exploitSource;
  throw new Error("live pipeline not implemented yet — set MOCK_PIPELINE=true");
}
