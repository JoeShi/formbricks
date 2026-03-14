"use client";

import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { generateAiSummaryAction } from "../lib/actions";
import { TStructuredSummary } from "../lib/types";

interface AiSummaryPageProps {
  surveyId: string;
  environmentId: string;
}

export const AiSummaryPage = ({ surveyId }: AiSummaryPageProps) => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<TStructuredSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  const fetchSummary = useCallback(
    async (skipCache = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await generateAiSummaryAction({ surveyId, skipCache });
        if (result?.data) {
          setSummary(result.data);
          setHasTriggered(true);
        } else if (result?.serverError) {
          setError(result.serverError);
          setHasTriggered(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("environments.surveys.ai_summary.generation_failed"));
        setHasTriggered(true);
      } finally {
        setIsLoading(false);
      }
    },
    [surveyId, t]
  );

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Data privacy notice — visible before first trigger
  if (!hasTriggered && !isLoading) {
    return (
      <div className="space-y-4">
        <DataPrivacyNotice t={t} />
        <div className="flex justify-center">
          <Button onClick={() => fetchSummary()} size="lg">
            <SparklesIcon className="mr-2 h-4 w-4" />
            {t("environments.surveys.ai_summary.generate")}
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <DataPrivacyNotice t={t} />
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white p-12">
          <Loader2Icon className="h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-sm text-slate-500">{t("environments.surveys.ai_summary.generating")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <DataPrivacyNotice t={t} />
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white p-12">
          <AlertTriangleIcon className="h-8 w-8 text-red-400" />
          <p className="mt-4 text-sm text-slate-700">{error}</p>
          <Button onClick={() => fetchSummary()} variant="secondary" className="mt-4">
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!summary) {
    return (
      <div className="space-y-4">
        <DataPrivacyNotice t={t} />
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white p-12">
          <p className="text-sm text-slate-500">{t("environments.surveys.ai_summary.no_responses")}</p>
        </div>
      </div>
    );
  }

  // Summary content
  return (
    <div className="space-y-4">
      <DataPrivacyNotice t={t} />

      {/* AI Disclaimer + Regenerate */}
      <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <SparklesIcon className="h-4 w-4" />
          <span>{t("environments.surveys.ai_summary.ai_disclaimer")}</span>
        </div>
        <Button onClick={() => fetchSummary(true)} variant="secondary" size="sm" disabled={isLoading}>
          <RefreshCwIcon className="mr-2 h-3 w-3" />
          {t("environments.surveys.ai_summary.regenerate")}
        </Button>
      </div>

      <KeyThemesCard themes={summary.keyThemes} t={t} />
      <SentimentCard sentiment={summary.sentiment} t={t} />
      <KeyFindingsCard findings={summary.keyFindings} t={t} />
      <RecommendationsCard recommendations={summary.recommendations} t={t} />

      {/* Metadata */}
      <div className="text-center text-xs text-slate-400">
        {t("environments.surveys.ai_summary.metadata", {
          count: summary.metadata.totalResponsesAnalyzed,
          date: new Date(summary.metadata.generatedAt).toLocaleDateString(),
          model: summary.metadata.modelId,
        })}
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function DataPrivacyNotice({ t }: { t: (key: string) => string }) {
  return (
    <Alert variant="info" size="small">
      <AlertTitle>{t("environments.surveys.ai_summary.privacy_notice")}</AlertTitle>
    </Alert>
  );
}

function KeyThemesCard({
  themes,
  t,
}: {
  themes: TStructuredSummary["keyThemes"];
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-800">
        {t("environments.surveys.ai_summary.key_themes")}
      </h3>
      <ul className="space-y-3">
        {themes.map((theme, i) => (
          <li key={i} className="flex items-start justify-between">
            <div>
              <p className="font-medium text-slate-700">{theme.title}</p>
              <p className="text-sm text-slate-500">{theme.description}</p>
            </div>
            <span className="ml-4 shrink-0 text-sm text-slate-400">
              {t("environments.surveys.ai_summary.response_count", { count: theme.responseCount })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SentimentCard({
  sentiment,
  t,
}: {
  sentiment: TStructuredSummary["sentiment"];
  t: (key: string) => string;
}) {
  const bars = [
    {
      label: t("environments.surveys.ai_summary.positive"),
      pct: sentiment.positivePercentage,
      color: "bg-emerald-500",
    },
    {
      label: t("environments.surveys.ai_summary.neutral"),
      pct: sentiment.neutralPercentage,
      color: "bg-slate-400",
    },
    {
      label: t("environments.surveys.ai_summary.negative"),
      pct: sentiment.negativePercentage,
      color: "bg-red-500",
    },
  ];

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">
          {t("environments.surveys.ai_summary.sentiment_analysis")}
        </h3>
        <span className="text-sm font-medium text-slate-600">
          {t(`environments.surveys.ai_summary.sentiment_${sentiment.overall}`)}
        </span>
      </div>
      <div className="space-y-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="w-16 text-sm text-slate-600">{bar.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
            </div>
            <span className="w-10 text-right text-sm text-slate-500">{Math.round(bar.pct)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">{sentiment.details}</p>
    </div>
  );
}

function KeyFindingsCard({
  findings,
  t,
}: {
  findings: TStructuredSummary["keyFindings"];
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-800">
        {t("environments.surveys.ai_summary.key_findings")}
      </h3>
      <ol className="space-y-4">
        {findings.map((finding, i) => (
          <li key={i}>
            <p className="font-medium text-slate-700">
              {i + 1}. {finding.finding}
            </p>
            <p className="mt-1 text-sm italic text-slate-500">📎 {finding.evidence}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecommendationsCard({
  recommendations,
  t,
}: {
  recommendations: TStructuredSummary["recommendations"];
  t: (key: string) => string;
}) {
  const priorityConfig = {
    high: { emoji: "🔴", label: t("environments.surveys.ai_summary.priority_high") },
    medium: { emoji: "🟡", label: t("environments.surveys.ai_summary.priority_medium") },
    low: { emoji: "🟢", label: t("environments.surveys.ai_summary.priority_low") },
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-800">
        {t("environments.surveys.ai_summary.recommendations")}
      </h3>
      <div className="space-y-4">
        {recommendations.map((rec, i) => {
          const config = priorityConfig[rec.priority];
          return (
            <div key={i}>
              <p className="font-medium text-slate-700">
                {config.emoji} {config.label}: {rec.title}
              </p>
              <p className="mt-1 text-sm text-slate-500">{rec.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
