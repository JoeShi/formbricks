"use client";

import { useTranslation } from "react-i18next";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Loading = () => {
  const { t } = useTranslation();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.ai_summary")} />
      <div className="space-y-4">
        <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-36 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-36 w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
    </PageContentWrapper>
  );
};

export default Loading;
