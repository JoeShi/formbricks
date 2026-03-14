import "server-only";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateObject } from "ai";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { type TStructuredSummary, ZStructuredSummary } from "./types";

const REQUIRED_ENV_VARS = [
  "AWS_BEDROCK_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "BEDROCK_MODEL_ID",
] as const;
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-6";
const CACHE_TTL_MS = 3_600_000; // 1 hour
const SAMPLING_THRESHOLD = 500;
const MAX_SERIALIZED_BYTES = 100_000; // 100 KB
const TIMEOUT_MS = 180_000;

/**
 * Validate that all required AWS environment variables are set.
 * Returns an array of missing variable names, or empty if all present.
 */
function getMissingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
}

/**
 * Sample responses to stay within token limits.
 * Strategy: uniform time-based sampling, prioritising finished responses.
 */
export function sampleResponses<T extends { finished: boolean; createdAt: Date }>(
  responses: T[],
  maxCount: number
): T[] {
  if (responses.length <= maxCount) return responses;

  // Sort by creation time ascending
  const sorted = [...responses].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Separate finished and unfinished
  const finished = sorted.filter((r) => r.finished);
  const unfinished = sorted.filter((r) => !r.finished);

  // Prioritise finished responses: allocate proportionally but at least 80% to finished
  const finishedSlots = Math.min(
    finished.length,
    Math.max(Math.ceil(maxCount * 0.8), maxCount - unfinished.length)
  );
  const unfinishedSlots = Math.min(unfinished.length, maxCount - finishedSlots);

  return [...uniformSample(finished, finishedSlots), ...uniformSample(unfinished, unfinishedSlots)];
}

function uniformSample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]);
}

/**
 * Build the prompt string from survey questions and response data.
 */
export function buildPrompt(
  surveyName: string,
  questions: { id: string; headline: string }[],
  responses: { data: Record<string, unknown>; finished: boolean }[],
  sampledFromTotal?: number
): string {
  const questionList = questions.map((q, i) => `${i + 1}. [${q.id}] ${q.headline}`).join("\n");

  const responseList = responses
    .map((r, i) => {
      const answers = questions
        .map((q) => {
          const val = r.data[q.id];
          return `  ${q.headline}: ${val !== undefined && val !== null ? String(val) : "(no answer)"}`;
        })
        .join("\n");
      return `Response #${i + 1} (${r.finished ? "completed" : "partial"}):\n${answers}`;
    })
    .join("\n\n");

  const samplingNote =
    sampledFromTotal && sampledFromTotal > responses.length
      ? `\n\nNote: These are ${responses.length} sampled responses out of ${sampledFromTotal} total. The sample is time-distributed to be representative.`
      : "";

  return `You are an expert survey analyst. Analyse the following survey responses and produce a structured summary.

Survey: "${surveyName}"

Questions:
${questionList}

Responses:
${responseList}${samplingNote}

Provide your analysis as a JSON object with:
- keyThemes: array of themes with title, description, and responseCount
- sentiment: overall sentiment (positive/negative/neutral/mixed) with percentage breakdown summing to 100 and details
- keyFindings: array of findings with evidence quotes from responses
- recommendations: array of actionable recommendations with priority (high/medium/low)`;
}

/**
 * Generate an AI summary for a survey's responses.
 * Uses Amazon Bedrock Claude Sonnet 4.6 via Vercel AI SDK.
 */
export async function generateAiSummary(surveyId: string, skipCache?: boolean): Promise<TStructuredSummary> {
  logger.info({ surveyId, skipCache }, "AI summary generation started");

  // 1. Validate environment variables
  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const cacheKey = createCacheKey.custom("analytics", surveyId, "ai-summary");

  // 2. If not skipping cache, try cache first via withCache
  if (!skipCache) {
    logger.info({ surveyId }, "Attempting to retrieve AI summary from cache");
    return cache.withCache(() => generateFreshSummary(surveyId), cacheKey, CACHE_TTL_MS);
  }

  // 3. skipCache: generate fresh, then write to cache
  const fresh = await generateFreshSummary(surveyId);
  try {
    await cache.set(cacheKey, fresh, CACHE_TTL_MS);
    logger.info({ surveyId }, "AI summary cached successfully");
  } catch (cacheError) {
    logger.warn({ cacheError, surveyId }, "Failed to write AI summary to cache");
  }
  return fresh;
}

async function generateFreshSummary(surveyId: string): Promise<TStructuredSummary> {
  const startTime = Date.now();

  // Fetch survey
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error(`Survey not found: ${surveyId}`);
  }
  logger.info({ surveyId, surveyName: survey.name }, "Survey fetched for AI summary");

  // Fetch responses
  const responses = await prisma.response.findMany({
    where: { surveyId },
    select: {
      id: true,
      data: true,
      finished: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (responses.length === 0) {
    throw new Error("No responses available to generate an AI summary.");
  }

  logger.info({ surveyId, responseCount: responses.length }, "Responses fetched for AI summary");

  // Extract questions from survey blocks
  const elements = getElementsFromBlocks(survey.blocks);
  const questions = elements.map((el) => ({
    id: el.id,
    headline: getLocalizedValue(el.headline, "default"),
  }));

  // Sample if needed
  const serialized = JSON.stringify(responses.map((r) => r.data));
  const needsSampling =
    responses.length > SAMPLING_THRESHOLD || Buffer.byteLength(serialized) > MAX_SERIALIZED_BYTES;

  const sampled = needsSampling ? sampleResponses(responses, SAMPLING_THRESHOLD) : responses;

  if (needsSampling) {
    logger.info(
      { surveyId, totalResponses: responses.length, sampledResponses: sampled.length },
      "Responses sampled for AI summary"
    );
  }

  const responseData = sampled.map((r) => ({
    data: r.data as Record<string, unknown>,
    finished: r.finished,
  }));

  // Build prompt
  const prompt = buildPrompt(
    survey.name,
    questions,
    responseData,
    needsSampling ? responses.length : undefined
  );

  logger.info(
    { surveyId, promptLength: prompt.length, modelId: MODEL_ID },
    "Calling Amazon Bedrock for AI summary"
  );

  // Call Amazon Bedrock
  const bedrock = createAmazonBedrock({
    region: process.env.AWS_BEDROCK_REGION!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  try {
    const { object } = await generateObject({
      model: bedrock(MODEL_ID),
      schema: ZStructuredSummary,
      prompt,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const durationMs = Date.now() - startTime;
    logger.info(
      { surveyId, durationMs, themesCount: object.keyThemes.length },
      "AI summary generation completed"
    );

    // Attach metadata
    return {
      ...object,
      metadata: {
        totalResponsesAnalyzed: sampled.length,
        generatedAt: new Date().toISOString(),
        modelId: MODEL_ID,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown AI generation error";
    logger.error({ error, surveyId, durationMs }, "AI summary generation failed");
    throw new Error(`AI summary generation failed: ${message}`);
  }
}
