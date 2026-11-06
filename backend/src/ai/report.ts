/**
 * The live evidence report.
 *
 * One grounded Claude call turns the measured checker result + the exploit
 * source into the plain-language report the company reads (interface #3). The
 * facts come from the fork; the model only describes them.
 *
 * Three guarantees the demo depends on:
 *   - No API key configured  -> canned fallback, no call attempted.
 *   - Call slow / errors / unparseable -> canned fallback, flagged.
 *   - Hard timeout (AI_TIMEOUT_MS)      -> canned fallback.
 * The live demo must never hang on a model call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "../env.js";
import type { CheckerResult, EvidenceReport } from "../types.js";
import { cannedReport } from "./fallback.js";
import { ReportSchema } from "./schema.js";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

function buildPrompt(checker: CheckerResult, exploitSource: string): string {
  return [
    "You are writing a short evidence report for a company that received a",
    "security bug report. A checker already ran the attack on a copy of the",
    "chain and measured the result — those numbers are below and are the",
    "ground truth. Describe what happened in plain language a non-technical",
    "reader can follow. Do NOT decide what gets paid; `suggestedSeverity` is",
    "only your opinion for the company to weigh.",
    "",
    "Measured checker result (ground truth):",
    JSON.stringify(
      {
        ruleBroken: checker.ruleBroken,
        severityFromRule: checker.severity,
        valueMovedUsdc: checker.valueMovedUsdc,
      },
      null,
      2,
    ),
    "",
    "The submitted exploit source:",
    "```solidity",
    exploitSource.slice(0, 8000),
    "```",
  ].join("\n");
}

export async function generateReport(
  checker: CheckerResult,
  exploitSource: string,
): Promise<EvidenceReport> {
  if (!env.anthropicApiKey) {
    return cannedReport(checker);
  }

  try {
    const res = await getClient().messages.parse(
      {
        model: env.anthropicModel,
        max_tokens: 2000,
        messages: [{ role: "user", content: buildPrompt(checker, exploitSource) }],
        output_config: { format: zodOutputFormat(ReportSchema) },
      },
      { timeout: env.aiTimeoutMs },
    );

    const parsed = res.parsed_output;
    if (!parsed) {
      console.error("[ai] model output did not parse; using fallback");
      return cannedReport(checker);
    }
    return { ...parsed, fallback: false };
  } catch (err) {
    console.error("[ai] report generation failed; using fallback:", err);
    return cannedReport(checker);
  }
}
