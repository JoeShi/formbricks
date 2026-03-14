import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCacheKey } from "@formbricks/cache";
import { buildPrompt, sampleResponses } from "./ai-summary-service";

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Cache key uniqueness and format
// Validates: Requirement 3.7
// ─────────────────────────────────────────────────────────────────────────────
describe("Feature: ai-summary, Property 4: Cache key uniqueness and format", () => {
  // Arbitrary: non-empty alphanumeric strings (valid CUID-like IDs)
  const surveyIdArb = fc.stringMatching(/^[a-z0-9]{8,30}$/);

  test("cache key should match fb:analytics:{surveyId}:ai-summary pattern", () => {
    fc.assert(
      fc.property(surveyIdArb, (surveyId) => {
        const key = createCacheKey.custom("analytics", surveyId, "ai-summary");
        expect(key).toBe(`fb:analytics:${surveyId}:ai-summary`);
      }),
      { numRuns: 100 }
    );
  });

  test("different surveyIds should produce different cache keys", () => {
    fc.assert(
      fc.property(surveyIdArb, surveyIdArb, (idA, idB) => {
        fc.pre(idA !== idB);
        const keyA = createCacheKey.custom("analytics", idA, "ai-summary");
        const keyB = createCacheKey.custom("analytics", idB, "ai-summary");
        expect(keyA).not.toBe(keyB);
      }),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Response sampling preserves representativeness
// Validates: Requirement 3.8
// ─────────────────────────────────────────────────────────────────────────────
describe("Feature: ai-summary, Property 5: Response sampling preserves representativeness", () => {
  // Generate a response with a date and finished flag
  const responseArb = fc.record({
    finished: fc.boolean(),
    createdAt: fc.date({ min: new Date("2020-01-01"), max: new Date("2026-12-31") }),
    id: fc.uuid(),
  });

  // Generate a list that always exceeds the sampling threshold
  const maxCount = 50; // Use a smaller threshold for testing
  const largeResponseListArb = fc.array(responseArb, { minLength: maxCount + 1, maxLength: maxCount * 3 });

  test("sampled subset should be smaller than the original set", () => {
    fc.assert(
      fc.property(largeResponseListArb, (responses) => {
        const sampled = sampleResponses(responses, maxCount);
        expect(sampled.length).toBeLessThanOrEqual(maxCount);
        expect(sampled.length).toBeLessThan(responses.length);
      }),
      { numRuns: 100 }
    );
  });

  test("sampled results should only contain items from the original set", () => {
    fc.assert(
      fc.property(largeResponseListArb, (responses) => {
        const sampled = sampleResponses(responses, maxCount);
        for (const item of sampled) {
          expect(responses).toContainEqual(item);
        }
      }),
      { numRuns: 100 }
    );
  });

  test("sampled results should include responses from earliest and latest time quartiles", () => {
    fc.assert(
      fc.property(largeResponseListArb, (responses) => {
        const sampled = sampleResponses(responses, maxCount);

        // Sort original by time to determine quartile boundaries
        const sorted = [...responses].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const q1Boundary = sorted[Math.floor(sorted.length * 0.25)].createdAt.getTime();
        const q4Boundary = sorted[Math.floor(sorted.length * 0.75)].createdAt.getTime();

        const hasEarlyQuartile = sampled.some((r) => r.createdAt.getTime() <= q1Boundary);
        const hasLateQuartile = sampled.some((r) => r.createdAt.getTime() >= q4Boundary);

        expect(hasEarlyQuartile).toBe(true);
        expect(hasLateQuartile).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test("should return all responses when count is below threshold", () => {
    fc.assert(
      fc.property(fc.array(responseArb, { minLength: 1, maxLength: maxCount }), (responses) => {
        const sampled = sampleResponses(responses, maxCount);
        expect(sampled.length).toBe(responses.length);
      }),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Missing environment variable detection
// Validates: Requirement 5.3
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("server-only", () => ({}));
vi.mock("@ai-sdk/amazon-bedrock", () => ({ createAmazonBedrock: vi.fn() }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/cache", () => ({
  cache: { withCache: vi.fn(), set: vi.fn() },
}));
vi.mock("@formbricks/database", () => ({
  prisma: { response: { findMany: vi.fn() } },
}));
vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: vi.fn(),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((val: unknown) => (typeof val === "string" ? val : "Question")),
}));

// Dynamic import so mocks are applied before module loads
const { generateAiSummary } = await import("./ai-summary-service");

const ENV_VARS = ["AWS_BEDROCK_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] as const;

describe("Feature: ai-summary, Property 7: Missing environment variable detection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set all env vars to valid values
    for (const key of ENV_VARS) {
      process.env[key] = "test-value";
    }
  });

  afterEach(() => {
    // Restore original env
    for (const key of ENV_VARS) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  // Generate all non-empty subsets of the env vars to test
  const subsetArb = fc.subarray([...ENV_VARS], { minLength: 1 }).filter((arr) => arr.length > 0);

  test("error message should mention each missing variable name", async () => {
    await fc.assert(
      fc.asyncProperty(subsetArb, async (missingVars) => {
        // Restore all first, then remove selected
        for (const key of ENV_VARS) {
          process.env[key] = "test-value";
        }
        for (const key of missingVars) {
          delete process.env[key];
        }

        let errorMessage = "";
        try {
          await generateAiSummary("test-survey-id");
        } catch (error) {
          errorMessage = (error as Error).message;
        }

        expect(errorMessage).toMatch(/Missing required environment variables/);
        for (const varName of missingVars) {
          expect(errorMessage).toContain(varName);
        }
      }),
      { numRuns: 20 }
    );
  });

  test("should not throw when all env vars are present", async () => {
    // All env vars are set in beforeEach, but generateAiSummary will fail
    // at a later stage (DB/AI call). We just verify it doesn't throw the
    // "Missing required environment variables" error.
    try {
      await generateAiSummary("test-survey-id");
    } catch (error) {
      expect((error as Error).message).not.toMatch(/Missing required environment variables/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: AI summary service
// Validates: Requirements 3.9, 3.10, 5.3
// ─────────────────────────────────────────────────────────────────────────────
describe("Unit tests: AI summary service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_VARS) {
      process.env[key] = "test-value";
    }
  });

  afterEach(() => {
    for (const key of ENV_VARS) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test("should return empty state error when survey has no responses (Req 3.10)", async () => {
    const { getSurvey } = await import("@/lib/survey/service");
    const { prisma } = await import("@formbricks/database");
    const { cache } = await import("@/lib/cache");

    vi.mocked(cache.withCache).mockImplementation(async (fn) => fn());
    vi.mocked(getSurvey).mockResolvedValue({ id: "survey1", name: "Test", blocks: [] } as any);
    vi.mocked(prisma.response.findMany).mockResolvedValue([]);

    await expect(generateAiSummary("survey1")).rejects.toThrow(
      "No responses available to generate an AI summary."
    );
  });

  test("should return error with missing variable names when env vars are absent (Req 5.3)", async () => {
    delete process.env.AWS_BEDROCK_REGION;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    await expect(generateAiSummary("survey1")).rejects.toThrow("AWS_BEDROCK_REGION");
    try {
      await generateAiSummary("survey1");
    } catch (error) {
      expect((error as Error).message).toContain("AWS_SECRET_ACCESS_KEY");
    }
  });

  test("should throw descriptive error when Bedrock API call fails (Req 3.9)", async () => {
    const { getSurvey } = await import("@/lib/survey/service");
    const { prisma } = await import("@formbricks/database");
    const { cache } = await import("@/lib/cache");
    const { getElementsFromBlocks } = await import("@/lib/survey/utils");
    const { generateObject } = await import("ai");
    const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock");

    vi.mocked(cache.withCache).mockImplementation(async (fn) => fn());
    vi.mocked(getSurvey).mockResolvedValue({
      id: "survey1",
      name: "Test Survey",
      blocks: [{ elements: [{ id: "q1", headline: { default: "How are you?" } }] }],
    } as any);
    vi.mocked(getElementsFromBlocks).mockReturnValue([
      { id: "q1", headline: { default: "How are you?" } },
    ] as any);
    vi.mocked(prisma.response.findMany).mockResolvedValue([
      { id: "r1", data: { q1: "Good" }, finished: true, createdAt: new Date() },
    ]);
    vi.mocked(createAmazonBedrock).mockReturnValue((() => "mock-model") as any);
    vi.mocked(generateObject).mockRejectedValue(new Error("Bedrock API rate limit exceeded"));

    await expect(generateAiSummary("survey1")).rejects.toThrow(
      "AI summary generation failed: Bedrock API rate limit exceeded"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: buildPrompt
// Validates: Requirement 3.4 (prompt contains complete survey context)
// ─────────────────────────────────────────────────────────────────────────────
describe("Unit tests: buildPrompt", () => {
  test("prompt should contain every question headline and every response data value", () => {
    const questions = [
      { id: "q1", headline: "How satisfied are you?" },
      { id: "q2", headline: "Any suggestions?" },
    ];
    const responses = [
      { data: { q1: "Very satisfied", q2: "Add dark mode" }, finished: true },
      { data: { q1: "Not great", q2: "Improve speed" }, finished: false },
    ];

    const prompt = buildPrompt("My Survey", questions, responses);

    // Every question headline should appear
    for (const q of questions) {
      expect(prompt).toContain(q.headline);
    }
    // Every response value should appear
    for (const r of responses) {
      for (const val of Object.values(r.data)) {
        expect(prompt).toContain(String(val));
      }
    }
  });

  test("prompt should include sampling note when sampledFromTotal is provided", () => {
    const questions = [{ id: "q1", headline: "Question 1" }];
    const responses = [{ data: { q1: "Answer" }, finished: true }];

    const prompt = buildPrompt("Survey", questions, responses, 1000);
    expect(prompt).toContain("1 sampled responses out of 1000 total");
  });
});
