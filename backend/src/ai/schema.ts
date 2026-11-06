/**
 * Zod schema for the evidence report (interface #3).
 *
 * The SDK validates the model's output against this, so we never hand-parse the
 * response. These are the five fields the frontend renders; `fallback` is set by
 * us, not the model, so it is not in the schema.
 */
import { z } from "zod";

export const ReportSchema = z.object({
  summary: z.string().describe("1-2 plain sentences a non-technical reader understands"),
  steps: z
    .array(z.string())
    .describe("the attack as ordered, plain-language steps"),
  rootCause: z.string().describe("why the bug exists, in plain language"),
  suggestedSeverity: z
    .enum(["critical", "high", "medium"])
    .describe("the AI's suggestion only; it does NOT decide what gets paid"),
  suggestedFixSummary: z.string().describe("how to fix it, briefly"),
});

export type ReportShape = z.infer<typeof ReportSchema>;
