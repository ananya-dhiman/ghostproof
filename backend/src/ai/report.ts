/**
 * The live evidence report — generated via OpenRouter (OpenAI-compatible
 * gateway, free models).
 *
 * One grounded call turns the measured checker result + the exploit source into
 * the plain-language report the company reads (interface #3). The facts come
 * from the fork; the model only describes them — it never decides the severity
 * that triggers a payout.
 *
 * Guarantees the demo depends on (provider-independent):
 *   - No API key        -> canned fallback, no call attempted.
 *   - Error / bad JSON   -> canned fallback, flagged.
 *   - Hard timeout       -> request aborted, canned fallback.
 * We validate the model's JSON against the Zod schema before trusting it.
 */
import { env } from "../env.js";
import type { CheckerResult, EvidenceReport } from "../types.js";
import { cannedReport } from "./fallback.js";
import { ReportSchema } from "./schema.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

/** A small hardcoded fallback in case the live free-model list can't be fetched. */
const FREE_FALLBACK = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
];

let freeModelsCache: string[] | null = null;

/**
 * Current free model slugs, fetched once per process. OpenRouter rotates which
 * free models exist, so we discover them rather than pin one. The result feeds
 * the request's `models` fallback list, so OpenRouter routes to whichever free
 * model is available and skips rate-limited ones automatically.
 */
async function getFreeModels(signal: AbortSignal): Promise<string[]> {
  if (freeModelsCache) return freeModelsCache;
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: { authorization: `Bearer ${env.openRouterApiKey}` },
      signal,
    });
    const body = (await res.json()) as {
      data?: { id: string; pricing?: { prompt?: string } }[];
    };
    const free = (body.data ?? [])
      .filter((m) => m.id.endsWith(":free") && m.pricing?.prompt === "0")
      .map((m) => m.id);
    freeModelsCache = free.length ? free : FREE_FALLBACK;
  } catch {
    freeModelsCache = FREE_FALLBACK;
  }
  return freeModelsCache;
}

/** JSON schema for the five report fields (OpenAI-style structured output). */
const jsonSchema = {
  name: "evidence_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      steps: { type: "array", items: { type: "string" } },
      rootCause: { type: "string" },
      suggestedSeverity: { type: "string", enum: ["critical", "high", "medium"] },
      suggestedFixSummary: { type: "string" },
    },
    required: ["summary", "steps", "rootCause", "suggestedSeverity", "suggestedFixSummary"],
  },
};

function buildPrompt(checker: CheckerResult, exploitSource: string): string {
  return [
    "A security checker already ran the attack on a copy of the chain and",
    "measured the result — the numbers below are the ground truth. Write a short",
    "evidence report for a company in plain language a non-technical reader can",
    "follow. Do NOT decide what gets paid; `suggestedSeverity` is only your",
    "opinion for the company to weigh. Respond with JSON only.",
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

/** Strip ``` fences a model may wrap JSON in, then return the JSON substring. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export async function generateReport(
  checker: CheckerResult,
  exploitSource: string,
): Promise<EvidenceReport> {
  if (!env.openRouterApiKey) {
    return cannedReport(checker);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);
  try {
    // "auto-free" → let OpenRouter pick among the currently-free models (and
    // fall through rate-limited ones). Otherwise pin the configured slug.
    const autoFree = env.openRouterModel === "auto-free";
    // OpenRouter's `models` fallback list is capped at 3 entries.
    const freeModels = autoFree
      ? (await getFreeModels(controller.signal)).slice(0, 3)
      : [];
    const routing = autoFree
      ? { model: freeModels[0], models: freeModels }
      : { model: env.openRouterModel };

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.openRouterApiKey}`,
        "content-type": "application/json",
        "x-title": "Ghostproof",
      },
      body: JSON.stringify({
        ...routing,
        messages: [
          {
            role: "system",
            content:
              "You write concise, grounded security evidence reports and reply with JSON only.",
          },
          { role: "user", content: buildPrompt(checker, exploitSource) },
        ],
        response_format: { type: "json_schema", json_schema: jsonSchema },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[ai] openrouter ${res.status}: ${detail.slice(0, 300)}`);
      return cannedReport(checker);
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[ai] openrouter returned no content; using fallback");
      return cannedReport(checker);
    }

    const parsed = ReportSchema.safeParse(JSON.parse(extractJson(content)));
    if (!parsed.success) {
      console.error("[ai] openrouter output failed schema validation; using fallback");
      return cannedReport(checker);
    }
    return { ...parsed.data, fallback: false };
  } catch (err) {
    console.error("[ai] report generation failed; using fallback:", err);
    return cannedReport(checker);
  } finally {
    clearTimeout(timer);
  }
}
