import { z } from "zod";

export const ZKeyTheme = z.object({
  title: z.string(),
  description: z.string(),
  responseCount: z.number().int().nonnegative(),
});

export type TKeyTheme = z.infer<typeof ZKeyTheme>;

export const ZSentimentAnalysis = z.object({
  overall: z.enum(["positive", "negative", "neutral", "mixed"]),
  positivePercentage: z.number().min(0).max(100),
  negativePercentage: z.number().min(0).max(100),
  neutralPercentage: z.number().min(0).max(100),
  details: z.string(),
});

export type TSentimentAnalysis = z.infer<typeof ZSentimentAnalysis>;

export const ZKeyFinding = z.object({
  finding: z.string(),
  evidence: z.string(),
});

export type TKeyFinding = z.infer<typeof ZKeyFinding>;

export const ZRecommendation = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

export type TRecommendation = z.infer<typeof ZRecommendation>;

export const ZStructuredSummary = z.object({
  keyThemes: z.array(ZKeyTheme),
  sentiment: ZSentimentAnalysis,
  keyFindings: z.array(ZKeyFinding),
  recommendations: z.array(ZRecommendation),
  metadata: z.object({
    totalResponsesAnalyzed: z.number().int().nonnegative(),
    generatedAt: z.string().datetime(),
    modelId: z.string(),
  }),
});

export type TStructuredSummary = z.infer<typeof ZStructuredSummary>;
