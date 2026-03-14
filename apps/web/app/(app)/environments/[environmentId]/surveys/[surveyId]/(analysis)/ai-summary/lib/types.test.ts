import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { ZStructuredSummary } from "./types";

// Arbitrary for generating valid TStructuredSummary objects
const keyThemeArb = fc.record({
  title: fc.string({ minLength: 1 }),
  description: fc.string({ minLength: 1 }),
  responseCount: fc.nat(),
});

// Generate sentiment with percentages that always sum to exactly 100
const sentimentArb = fc
  .tuple(
    fc.constantFrom("positive" as const, "negative" as const, "neutral" as const, "mixed" as const),
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 0, max: 100 }),
    fc.string({ minLength: 1 })
  )
  .map(([overall, a, b]) => {
    const sorted = [Math.min(a, b), Math.max(a, b)];
    return {
      overall,
      positivePercentage: sorted[0],
      negativePercentage: sorted[1] - sorted[0],
      neutralPercentage: 100 - sorted[1],
      details: "sentiment details",
    };
  });

const keyFindingArb = fc.record({
  finding: fc.string({ minLength: 1 }),
  evidence: fc.string({ minLength: 1 }),
});

const recommendationArb = fc.record({
  title: fc.string({ minLength: 1 }),
  description: fc.string({ minLength: 1 }),
  priority: fc.constantFrom("high" as const, "medium" as const, "low" as const),
});

// Generate ISO datetime strings within a safe range
const isoDatetimeArb = fc
  .date({ min: new Date("2000-01-01T00:00:00.000Z"), max: new Date("2099-12-31T23:59:59.999Z") })
  .filter((d) => !isNaN(d.getTime()))
  .map((d) => d.toISOString());

const structuredSummaryArb = fc.record({
  keyThemes: fc.array(keyThemeArb, { minLength: 1 }),
  sentiment: sentimentArb,
  keyFindings: fc.array(keyFindingArb, { minLength: 1 }),
  recommendations: fc.array(recommendationArb, { minLength: 1 }),
  metadata: fc.record({
    totalResponsesAnalyzed: fc.nat(),
    generatedAt: isoDatetimeArb,
    modelId: fc.string({ minLength: 1 }),
  }),
});

describe("Feature: ai-summary, Property 3: Structured Summary Schema Validation", () => {
  test("ZStructuredSummary should parse any valid TStructuredSummary object", () => {
    fc.assert(
      fc.property(structuredSummaryArb, (summary) => {
        const result = ZStructuredSummary.safeParse(summary);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test("sentiment percentages should sum to approximately 100", () => {
    fc.assert(
      fc.property(structuredSummaryArb, (summary) => {
        const { positivePercentage, negativePercentage, neutralPercentage } = summary.sentiment;
        const total = positivePercentage + negativePercentage + neutralPercentage;
        expect(total).toBeCloseTo(100, 5);
      }),
      { numRuns: 100 }
    );
  });

  test("every recommendation priority should be one of high, medium, or low", () => {
    fc.assert(
      fc.property(structuredSummaryArb, (summary) => {
        for (const rec of summary.recommendations) {
          expect(["high", "medium", "low"]).toContain(rec.priority);
        }
      }),
      { numRuns: 100 }
    );
  });
});
